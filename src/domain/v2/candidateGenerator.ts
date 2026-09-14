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

export interface CandidateGeneratorConfig {
  candidateCount: number;
  gridSize: number;
  scanStep: number;
  dimensionJitter: number;
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
  other: 1.8,
};

const snap = (value: number, grid: number): number =>
  Number((Math.round(value / grid) * grid).toFixed(4));

function buildableBounds(site: SiteConstraints) {
  return {
    minX: site.setbackLeft,
    maxX: site.width - site.setbackRight,
    minY: site.setbackFront,
    maxY: site.length - site.setbackBack,
  };
}

function desiredDepth(type: SpaceType): number {
  switch (type) {
    case "garage": return 0.1;
    case "living": return 0.25;
    case "dining": return 0.32;
    case "kitchen": return 0.42;
    case "corridor": return 0.48;
    case "studio": return 0.55;
    case "laundry": return 0.62;
    case "bathroom": return 0.65;
    case "bedroom": return 0.72;
    case "terrace":
    case "patio": return 0.78;
    default: return 0.5;
  }
}

function anchorPriority(type: SpaceType): number {
  switch (type) {
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

  // Corridors behave as circulation spines rather than square rooms.
  if (programSpace.type === "corridor") {
    const shortSide = Math.min(Math.max(minWidth, 1.2), Math.min(maxW, maxH));
    const longSide = Math.min(Math.max(shortSide, targetArea / shortSide), Math.max(maxW, maxH));
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
  return shuffled.sort(
    (a, b) =>
      anchorPriority(b.type) + relationDegree(program, b.id) -
      (anchorPriority(a.type) + relationDegree(program, a.id))
  );
}

function relatedPlacedSpaces(
  program: ArchitecturalProgram,
  programSpaceId: string,
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
    if (other) related.push({ space: other, weight: relation.weight });
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
    if (!other) continue;

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

  return cost;
}

function zoningCost(trial: LayoutSpace, site: SiteConstraints): number {
  const buildable = buildableBounds(site);
  const depth = Math.max(0.001, buildable.maxY - buildable.minY);
  const normalized = Math.max(0, Math.min(1, (trial.y - buildable.minY) / depth));
  const error = Math.abs(normalized - desiredDepth(trial.type));
  const weight = trial.type === "garage" || trial.type === "bedroom" ? 22 : 14;
  return error * weight;
}

function trialCost(
  trial: LayoutSpace,
  placed: LayoutSpace[],
  program: ArchitecturalProgram,
  site: SiteConstraints
): number {
  if (!fitsBuildable(trial, site)) return Number.POSITIVE_INFINITY;
  if (overlapsAny(trial, placed)) return Number.POSITIVE_INFINITY;

  const buildable = buildableBounds(site);
  const centerX = (buildable.minX + buildable.maxX) / 2;
  const compactnessBias = Math.abs(trial.x - centerX) * 0.05;

  return relationCost(trial, placed, program) + zoningCost(trial, site) + compactnessBias;
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
  const anchors = relatedPlacedSpaces(program, template.programSpaceId, placed);
  const fallbackAnchors = anchors.length > 0 ? anchors : placed;
  const trials: LayoutSpace[] = [];

  for (const anchor of fallbackAnchors) {
    trials.push(...touchingTrials(anchor, template, config.gridSize, rng));
  }

  let best: LayoutSpace | null = null;
  let bestCost = Number.POSITIVE_INFINITY;

  for (const trial of trials) {
    const cost = trialCost(trial, placed, program, site);
    if (cost < bestCost) {
      best = trial;
      bestCost = cost;
    }
  }

  if (best) return best;

  for (const trial of scanTrials(template, site, config, rng)) {
    const cost = trialCost(trial, placed, program, site);
    if (cost < bestCost) {
      best = trial;
      bestCost = cost;
    }
  }

  if (best) return best;

  const buildable = buildableBounds(site);
  return {
    ...template,
    x: snap((buildable.minX + buildable.maxX) / 2, config.gridSize),
    y: snap((buildable.minY + buildable.maxY) / 2, config.gridSize),
  };
}

function initialPlacement(
  template: LayoutSpace,
  site: SiteConstraints,
  grid: number
): LayoutSpace {
  const buildable = buildableBounds(site);
  const centerX = (buildable.minX + buildable.maxX) / 2;
  const depth = Math.max(0, buildable.maxY - buildable.minY);
  const targetY = buildable.minY + depth * desiredDepth(template.type);
  const minY = buildable.minY + template.h / 2;
  const maxY = buildable.maxY - template.h / 2;

  return {
    ...template,
    x: snap(centerX, grid),
    y: snap(Math.max(minY, Math.min(maxY, targetY)), grid),
  };
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
    };

    if (placed.length === 0) {
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
