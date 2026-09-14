import {
  ArchitecturalProgram,
  LayoutCandidate,
  LayoutSpace,
  ProgramSpace,
  SiteConstraints,
  SpaceType,
} from "./types";
import { findSharedBoundary, getSpaceBounds, spacesOverlap } from "./topology";
import { prepareCandidate, rankCandidates } from "./candidatePipeline";
import { createSeededRandom, RandomFn, randomBetween, shuffleSeeded } from "./random";
import {
  buildableBounds,
  desiredEntryDepth,
  entryTargetPoint,
  normalizedEntryDepth,
} from "./architecturalGrammarV3";
import {
  spatialGrammarPlacementCost,
  type SpatialGrammarContext,
} from "./spatialGrammarCost";

export interface CandidateGeneratorConfig {
  candidateCount: number;
  gridSize: number;
  scanStep: number;
  dimensionJitter: number;
  grammar?: SpatialGrammarContext;
}

export const DEFAULT_CANDIDATE_GENERATOR_CONFIG: CandidateGeneratorConfig = {
  candidateCount: 20,
  gridSize: 0.1,
  scanStep: 0.5,
  dimensionJitter: 0.16,
};

// Design heuristics only. These values are not regulatory requirements.
const DEFAULT_TARGET_AREA: Record<SpaceType, number> = {
  living: 16,
  bedroom: 10,
  bathroom: 4,
  kitchen: 8,
  dining: 10,
  corridor: 5,
  garage: 15,
  laundry: 4,
  terrace: 8,
  patio: 9,
  studio: 8,
  stair: 5,
  other: 7,
};

const DEFAULT_MIN_WIDTH: Record<SpaceType, number> = {
  living: 2.8,
  bedroom: 2.4,
  bathroom: 1.2,
  kitchen: 1.8,
  dining: 2.4,
  corridor: 1.2,
  garage: 2.8,
  laundry: 1.5,
  terrace: 1.8,
  patio: 2,
  studio: 2.2,
  stair: 1,
  other: 1.8,
};

const snap = (value: number, grid: number): number =>
  Number((Math.round(value / grid) * grid).toFixed(4));

function anchorPriority(type: SpaceType): number {
  switch (type) {
    case "stair": return 16;
    case "corridor": return 14;
    case "living": return 11;
    case "dining": return 10;
    case "kitchen": return 9;
    case "garage": return 8;
    case "bedroom": return 6;
    case "bathroom": return 5;
    case "laundry": return 5;
    case "studio": return 4;
    default: return 2;
  }
}

function fitsBuildable(space: LayoutSpace, site: SiteConstraints, tolerance = 0.001): boolean {
  const bounds = getSpaceBounds(space);
  const buildable = buildableBounds(site);
  return (
    bounds.minX >= buildable.minX - tolerance &&
    bounds.maxX <= buildable.maxX + tolerance &&
    bounds.minY >= buildable.minY - tolerance &&
    bounds.maxY <= buildable.maxY + tolerance
  );
}

function overlapsAny(space: LayoutSpace, placed: LayoutSpace[]): boolean {
  return placed.some((other) => spacesOverlap(space, other));
}

function resolveDimensions(
  programSpace: ProgramSpace,
  site: SiteConstraints,
  rng: RandomFn,
  config: CandidateGeneratorConfig
): { w: number; h: number } {
  const buildable = buildableBounds(site);
  const maxW = Math.max(config.gridSize, buildable.maxX - buildable.minX);
  const maxH = Math.max(config.gridSize, buildable.maxY - buildable.minY);
  const targetArea = Math.max(
    programSpace.minArea ?? 0,
    programSpace.targetArea ?? DEFAULT_TARGET_AREA[programSpace.type]
  );
  const minWidth = Math.max(
    config.gridSize,
    programSpace.minWidth ?? DEFAULT_MIN_WIDTH[programSpace.type]
  );

  if (programSpace.type === "corridor") {
    const shortSide = Math.min(Math.max(minWidth, 1.2), Math.min(maxW, maxH));
    const longSide = Math.min(Math.max(shortSide, targetArea / shortSide), Math.max(maxW, maxH));
    const alongDepth = maxH >= maxW;
    return {
      w: snap(Math.min(maxW, alongDepth ? shortSide : longSide), config.gridSize),
      h: snap(Math.min(maxH, alongDepth ? longSide : shortSide), config.gridSize),
    };
  }

  if (programSpace.type === "stair") {
    const shortSide = Math.max(minWidth, Math.sqrt(targetArea / 1.45));
    const longSide = Math.max(shortSide, targetArea / shortSide);
    const alongDepth = maxH >= maxW;
    return {
      w: snap(Math.min(maxW, alongDepth ? shortSide : longSide), config.gridSize),
      h: snap(Math.min(maxH, alongDepth ? longSide : shortSide), config.gridSize),
    };
  }

  const jitter = randomBetween(rng, 1 - config.dimensionJitter, 1 + config.dimensionJitter);
  const aspect = randomBetween(rng, 0.75, 1.35) * jitter;
  let w = Math.max(minWidth, Math.sqrt(targetArea * aspect));
  let h = Math.max(minWidth, targetArea / w);

  if (rng() > 0.5) [w, h] = [h, w];

  if (w > maxW && h <= maxW && w <= maxH) [w, h] = [h, w];
  w = Math.min(maxW, Math.max(minWidth, w));
  h = Math.min(maxH, Math.max(minWidth, h));

  return {
    w: snap(w, config.gridSize),
    h: snap(h, config.gridSize),
  };
}

function relationDegree(program: ArchitecturalProgram, spaceId: string): number {
  return program.relations.reduce((score, relation) => {
    if (relation.a !== spaceId && relation.b !== spaceId) return score;
    const multiplier =
      relation.kind === "direct_access" || relation.kind === "must_touch"
        ? 3
        : relation.kind === "prefer_touch"
          ? 2
          : 1;
    return score + Math.max(0.05, relation.weight) * multiplier;
  }, 0);
}

function placementOrder(program: ArchitecturalProgram, rng: RandomFn): ProgramSpace[] {
  const shuffled = shuffleSeeded(program.spaces, rng);
  return shuffled.sort((a, b) => {
    const scoreA = anchorPriority(a.type) + relationDegree(program, a.id);
    const scoreB = anchorPriority(b.type) + relationDegree(program, b.id);
    if (Math.abs(scoreB - scoreA) > 0.0001) return scoreB - scoreA;
    return (a.floor ?? 0) - (b.floor ?? 0);
  });
}

function relatedPlacedSpaces(
  program: ArchitecturalProgram,
  programSpaceId: string,
  floor: number,
  placed: LayoutSpace[]
): LayoutSpace[] {
  const placedByProgram = new Map(placed.map((space) => [space.programSpaceId, space]));
  const related: Array<{ space: LayoutSpace; weight: number }> = [];

  for (const relation of program.relations) {
    let otherId: string | null = null;
    if (relation.a === programSpaceId) otherId = relation.b;
    if (relation.b === programSpaceId) otherId = relation.a;
    if (!otherId) continue;

    const other = placedByProgram.get(otherId);
    if (other && other.floor === floor) related.push({ space: other, weight: relation.weight });
  }

  return related
    .sort((a, b) => b.weight - a.weight)
    .map((item) => item.space);
}

function relationCost(
  trial: LayoutSpace,
  placed: LayoutSpace[],
  program: ArchitecturalProgram
): number {
  const placedByProgram = new Map(placed.map((space) => [space.programSpaceId, space]));
  let cost = 0;

  for (const relation of program.relations) {
    let otherProgramId: string | null = null;
    if (relation.a === trial.programSpaceId) otherProgramId = relation.b;
    if (relation.b === trial.programSpaceId) otherProgramId = relation.a;
    if (!otherProgramId) continue;

    const other = placedByProgram.get(otherProgramId);
    if (!other || other.floor !== trial.floor) continue;

    const shared = findSharedBoundary(trial, other);
    const distance = Math.hypot(trial.x - other.x, trial.y - other.y);
    const weight = Math.max(0.05, relation.weight);

    if (relation.kind === "direct_access" || relation.kind === "must_touch") {
      cost += shared ? -40 * weight : 80 * weight + distance * weight;
    } else if (relation.kind === "prefer_touch") {
      cost += shared ? -20 * weight : distance * 2 * weight;
    } else if (relation.kind === "must_not_touch") {
      cost += shared ? 100 * weight : -2 * weight;
    } else if (relation.kind === "near") {
      cost += distance * weight;
    }
  }

  for (const rule of program.pairRules ?? []) {
    if (rule.kind !== "avoid_adjacency") continue;
    let otherProgramId: string | null = null;
    if (rule.a === trial.programSpaceId) otherProgramId = rule.b;
    if (rule.b === trial.programSpaceId) otherProgramId = rule.a;
    if (!otherProgramId) continue;
    const other = placedByProgram.get(otherProgramId);
    if (!other || other.floor !== trial.floor) continue;
    const shared = findSharedBoundary(trial, other);
    if (shared) cost += 45 * Math.max(0.1, rule.weight);
  }

  return cost;
}

function zoningCost(trial: LayoutSpace, site: SiteConstraints): number {
  const normalized = normalizedEntryDepth(trial, site);
  const error = Math.abs(normalized - desiredEntryDepth(trial.type));
  const weight = trial.type === "garage" || trial.type === "bedroom" ? 22 : 14;
  return error * weight;
}

function trialCost(
  trial: LayoutSpace,
  placed: LayoutSpace[],
  program: ArchitecturalProgram,
  site: SiteConstraints,
  config: CandidateGeneratorConfig
): number {
  if (!fitsBuildable(trial, site)) return Number.POSITIVE_INFINITY;
  if (overlapsAny(trial, placed)) return Number.POSITIVE_INFINITY;

  const buildable = buildableBounds(site);
  const centerX = (buildable.minX + buildable.maxX) / 2;
  const centerY = (buildable.minY + buildable.maxY) / 2;
  const compactnessBias = Math.hypot(trial.x - centerX, trial.y - centerY) * 0.025;
  const grammarCost = spatialGrammarPlacementCost(trial, site, config.grammar ?? {});

  return relationCost(trial, placed, program) + zoningCost(trial, site) + compactnessBias + grammarCost;
}

function touchingTrials(
  base: LayoutSpace,
  template: LayoutSpace,
  grid: number,
  rng: RandomFn
): LayoutSpace[] {
  const offsets = shuffleSeeded([0, grid, -grid, grid * 2, -grid * 2, grid * 3, -grid * 3], rng);
  const trials: LayoutSpace[] = [];

  for (const offset of offsets) {
    trials.push({
      ...template,
      x: snap(base.x + (base.w + template.w) / 2, grid),
      y: snap(base.y + offset, grid),
    });
    trials.push({
      ...template,
      x: snap(base.x - (base.w + template.w) / 2, grid),
      y: snap(base.y + offset, grid),
    });
    trials.push({
      ...template,
      x: snap(base.x + offset, grid),
      y: snap(base.y + (base.h + template.h) / 2, grid),
    });
    trials.push({
      ...template,
      x: snap(base.x + offset, grid),
      y: snap(base.y - (base.h + template.h) / 2, grid),
    });
  }

  return shuffleSeeded(trials, rng);
}

function scanTrials(
  template: LayoutSpace,
  site: SiteConstraints,
  config: CandidateGeneratorConfig,
  rng: RandomFn
): LayoutSpace[] {
  const buildable = buildableBounds(site);
  const points: LayoutSpace[] = [];
  const startX = buildable.minX + template.w / 2;
  const endX = buildable.maxX - template.w / 2;
  const startY = buildable.minY + template.h / 2;
  const endY = buildable.maxY - template.h / 2;

  for (let y = startY; y <= endY + 0.001; y += config.scanStep) {
    for (let x = startX; x <= endX + 0.001; x += config.scanStep) {
      points.push({
        ...template,
        x: snap(x, config.gridSize),
        y: snap(y, config.gridSize),
      });
    }
  }

  return shuffleSeeded(points, rng);
}

function choosePlacement(
  template: LayoutSpace,
  placed: LayoutSpace[],
  program: ArchitecturalProgram,
  site: SiteConstraints,
  config: CandidateGeneratorConfig,
  rng: RandomFn
): LayoutSpace {
  const sameFloor = placed.filter((space) => space.floor === template.floor);
  const anchors = relatedPlacedSpaces(program, template.programSpaceId, template.floor, placed);
  const fallbackAnchors = anchors.length > 0 ? anchors : sameFloor;
  const trials: LayoutSpace[] = [];

  for (const anchor of fallbackAnchors) {
    trials.push(...touchingTrials(anchor, template, config.gridSize, rng));
  }

  let best: LayoutSpace | null = null;
  let bestCost = Number.POSITIVE_INFINITY;

  for (const trial of trials) {
    const cost = trialCost(trial, placed, program, site, config);
    if (cost < bestCost) {
      best = trial;
      bestCost = cost;
    }
  }

  if (best) return best;

  for (const trial of scanTrials(template, site, config, rng)) {
    const cost = trialCost(trial, placed, program, site, config);
    if (cost < bestCost) {
      best = trial;
      bestCost = cost;
    }
  }

  if (best) return best;
  return initialPlacement(template, site, config.gridSize);
}

function initialPlacement(
  template: LayoutSpace,
  site: SiteConstraints,
  grid: number
): LayoutSpace {
  const target = entryTargetPoint(template.type, site, template.w, template.h);
  return {
    ...template,
    x: snap(target.x, grid),
    y: snap(target.y, grid),
  };
}

function stackedPlacement(
  template: LayoutSpace,
  placed: LayoutSpace[],
  site: SiteConstraints,
  grid: number
): LayoutSpace | null {
  if (!template.verticalStackKey) return null;
  const peer = placed.find(
    (space) => space.verticalStackKey === template.verticalStackKey && space.floor !== template.floor
  );
  if (!peer) return null;

  const aligned: LayoutSpace = {
    ...template,
    x: snap(peer.x, grid),
    y: snap(peer.y, grid),
  };
  if (!fitsBuildable(aligned, site) || overlapsAny(aligned, placed)) return null;
  return aligned;
}

export function generateSeededCandidate(
  program: ArchitecturalProgram,
  site: SiteConstraints,
  seed: number,
  config: CandidateGeneratorConfig = DEFAULT_CANDIDATE_GENERATOR_CONFIG
): LayoutCandidate {
  const rng = createSeededRandom(seed);
  const ordered = placementOrder(program, rng);
  const placed: LayoutSpace[] = [];

  for (const programSpace of ordered) {
    const { w, h } = resolveDimensions(programSpace, site, rng, config);
    const template: LayoutSpace = {
      id: `layout_${programSpace.id}`,
      programSpaceId: programSpace.id,
      type: programSpace.type,
      label: programSpace.label,
      x: 0,
      y: 0,
      w,
      h,
      floor: programSpace.floor ?? 0,
      verticalStackKey: programSpace.verticalStackKey,
    };

    const stacked = stackedPlacement(template, placed, site, config.gridSize);
    if (stacked) {
      placed.push(stacked);
      continue;
    }

    const sameFloor = placed.filter((space) => space.floor === template.floor);
    if (sameFloor.length === 0) {
      placed.push(initialPlacement(template, site, config.gridSize));
      continue;
    }

    placed.push(choosePlacement(template, placed, program, site, config, rng));
  }

  return prepareCandidate(`candidate_${seed}`, program, placed, site, seed);
}

export function generateRankedCandidates(
  program: ArchitecturalProgram,
  site: SiteConstraints,
  baseSeed = 1,
  config: CandidateGeneratorConfig = DEFAULT_CANDIDATE_GENERATOR_CONFIG
): LayoutCandidate[] {
  const candidates: LayoutCandidate[] = [];
  const count = Math.max(1, Math.floor(config.candidateCount));

  for (let i = 0; i < count; i++) {
    const seed = (baseSeed + i * 9973) >>> 0;
    candidates.push(generateSeededCandidate(program, site, seed, config));
  }

  return rankCandidates(candidates);
}
