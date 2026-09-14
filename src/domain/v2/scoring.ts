import {
  ArchitecturalProgram,
  CandidateScore,
  FloorTopology,
  GeometryIssue,
  LayoutSpace,
  SiteConstraints,
} from "./types";
import { boundaryBetween, getSpaceBounds } from "./topology";
import { hardConstraintsPass } from "./constraints";
import {
  desiredEntryDepth,
  exteriorSideAzimuth,
  normalizedEntryDepth,
  solarExposurePreference,
} from "./architecturalGrammarV3";
import { scoreFurnitureFit } from "./habitability";

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

function byProgramId(spaces: LayoutSpace[]): Map<string, LayoutSpace> {
  return new Map(spaces.map((space) => [space.programSpaceId, space]));
}

function hasDoor(topology: FloorTopology, aId: string, bId: string): boolean {
  return topology.openings.some(
    (opening) =>
      opening.type === "door" &&
      ((opening.spaceAId === aId && opening.spaceBId === bId) ||
        (opening.spaceAId === bId && opening.spaceBId === aId))
  );
}

function centerDistance(a: LayoutSpace, b: LayoutSpace): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function relationSatisfaction(
  kind: string,
  a: LayoutSpace,
  b: LayoutSpace,
  topology: FloorTopology
): number {
  if (a.floor !== b.floor) return 0;
  const shared = boundaryBetween(topology, a.id, b.id);

  switch (kind) {
    case "must_touch":
    case "prefer_touch":
      return shared ? 1 : 0;
    case "direct_access":
      return shared && hasDoor(topology, a.id, b.id) ? 1 : 0;
    case "must_not_touch":
      return shared ? 0 : 1;
    case "near": {
      const distance = centerDistance(a, b);
      return clamp01(1 - Math.max(0, distance - 2) / 8);
    }
    default:
      return 0;
  }
}

function scoreAdjacency(
  program: ArchitecturalProgram,
  spaces: LayoutSpace[],
  topology: FloorTopology
): number {
  const layout = byProgramId(spaces);
  let achieved = 0;
  let possible = 0;

  for (const relation of program.relations) {
    const a = layout.get(relation.a);
    const b = layout.get(relation.b);
    if (!a || !b || a.floor !== b.floor) continue;

    const weight = Math.max(0.05, relation.weight);
    possible += weight;
    achieved += weight * relationSatisfaction(relation.kind, a, b, topology);
  }

  if (possible === 0) return 20;
  return 20 * (achieved / possible);
}

function connectGraph(graph: Map<string, Set<string>>, a: string, b: string): void {
  graph.get(a)?.add(b);
  graph.get(b)?.add(a);
}

function doorConnectivityRatio(spaces: LayoutSpace[], topology: FloorTopology): number {
  const interior = spaces.filter(
    (space) => space.type !== "patio" && space.type !== "terrace"
  );
  if (interior.length <= 1) return 1;

  const ids = new Set(interior.map((space) => space.id));
  const graph = new Map(interior.map((space) => [space.id, new Set<string>()]));
  for (const opening of topology.openings) {
    if (opening.type !== "door" || !opening.spaceBId) continue;
    if (!ids.has(opening.spaceAId) || !ids.has(opening.spaceBId)) continue;
    connectGraph(graph, opening.spaceAId, opening.spaceBId);
  }

  const stacks = new Map<string, LayoutSpace[]>();
  for (const space of interior) {
    if (!space.verticalStackKey) continue;
    const group = stacks.get(space.verticalStackKey) ?? [];
    group.push(space);
    stacks.set(space.verticalStackKey, group);
  }
  for (const group of stacks.values()) {
    const ordered = [...group].sort((a, b) => a.floor - b.floor);
    for (let i = 0; i < ordered.length - 1; i++) {
      connectGraph(graph, ordered[i].id, ordered[i + 1].id);
    }
  }

  const mainEntry = topology.openings.find(
    (opening) => opening.type === "door" && opening.role === "main_entry"
  );
  const root =
    (mainEntry ? interior.find((space) => space.id === mainEntry.spaceAId) : undefined) ??
    interior.find((space) => space.floor === 0 && space.type === "corridor") ??
    interior.find((space) => space.floor === 0 && space.type === "living") ??
    interior.find((space) => space.floor === 0 && space.type === "stair") ??
    interior[0];
  const visited = new Set<string>([root.id]);
  const queue = [root.id];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbor of graph.get(current) ?? []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push(neighbor);
    }
  }

  return visited.size / interior.length;
}

function scoreCirculation(
  program: ArchitecturalProgram,
  spaces: LayoutSpace[],
  topology: FloorTopology
): number {
  const layout = byProgramId(spaces);
  const directRelations = program.relations.filter((relation) => relation.kind === "direct_access");
  let possible = 0;
  let valid = 0;

  for (const relation of directRelations) {
    const a = layout.get(relation.a);
    const b = layout.get(relation.b);
    if (!a || !b || a.floor !== b.floor) continue;
    possible++;
    if (hasDoor(topology, a.id, b.id)) valid++;
  }
  const directRatio = possible > 0 ? valid / possible : 1;

  const connected = doorConnectivityRatio(spaces, topology);
  const hasMainEntry = topology.openings.some(
    (opening) => opening.type === "door" && opening.role === "main_entry"
  );
  const entryFactor = hasMainEntry ? 1 : 0;
  return 20 * (connected * 0.62 + directRatio * 0.23 + entryFactor * 0.15);
}

function compactnessRatio(spaces: LayoutSpace[]): number {
  if (spaces.length === 0) return 0;
  const bounds = spaces.map(getSpaceBounds);
  const minX = Math.min(...bounds.map((bound) => bound.minX));
  const maxX = Math.max(...bounds.map((bound) => bound.maxX));
  const minY = Math.min(...bounds.map((bound) => bound.minY));
  const maxY = Math.max(...bounds.map((bound) => bound.maxY));
  const envelopeArea = Math.max(0.001, (maxX - minX) * (maxY - minY));
  const roomArea = spaces.reduce((sum, space) => sum + space.w * space.h, 0);
  return clamp01(roomArea / envelopeArea);
}

function scoreCompactness(spaces: LayoutSpace[]): number {
  const floors = [...new Set(spaces.map((space) => space.floor))];
  if (floors.length === 0) return 0;
  const average = floors.reduce(
    (sum, floor) => sum + compactnessRatio(spaces.filter((space) => space.floor === floor)),
    0
  ) / floors.length;
  return 4 * average;
}

function scoreDaylight(
  program: ArchitecturalProgram,
  spaces: LayoutSpace[],
  topology: FloorTopology
): number {
  const layout = byProgramId(spaces);
  const required = program.spaces.filter((space) => space.requiresExteriorOpening);
  if (required.length === 0) return 10;

  let valid = 0;
  for (const programSpace of required) {
    const layoutSpace = layout.get(programSpace.id);
    if (!layoutSpace) continue;

    const externalBoundaryIds = new Set(
      topology.exteriorBoundaries
        .filter((boundary) => boundary.spaceId === layoutSpace.id)
        .map((boundary) => boundary.id)
    );

    const hasWindow = topology.openings.some(
      (opening) =>
        opening.type === "window" &&
        opening.spaceAId === layoutSpace.id &&
        externalBoundaryIds.has(opening.hostBoundaryId)
    );

    if (hasWindow) valid++;
  }

  return 10 * (valid / required.length);
}

function scoreSolarOrientation(
  spaces: LayoutSpace[],
  topology: FloorTopology,
  site: SiteConstraints
): number {
  const primaryTypes = new Set(["living", "dining", "bedroom", "kitchen", "studio"]);
  const relevant = spaces.filter((space) => primaryTypes.has(space.type));
  if (relevant.length === 0) return 8;

  const exteriorById = new Map(topology.exteriorBoundaries.map((boundary) => [boundary.id, boundary]));
  let total = 0;
  let count = 0;

  for (const space of relevant) {
    const windowBoundaries = topology.openings
      .filter((opening) => opening.type === "window" && opening.spaceAId === space.id)
      .map((opening) => exteriorById.get(opening.hostBoundaryId))
      .filter((boundary): boundary is NonNullable<typeof boundary> => Boolean(boundary));

    if (windowBoundaries.length === 0) {
      count++;
      continue;
    }

    const best = Math.max(
      ...windowBoundaries.map((boundary) =>
        solarExposurePreference(space.type, exteriorSideAzimuth(boundary.side, site), site)
      )
    );
    total += best;
    count++;
  }

  return count === 0 ? 0 : 8 * (total / count);
}

function scorePrivacy(
  program: ArchitecturalProgram,
  spaces: LayoutSpace[],
  topology: FloorTopology
): number {
  const layout = byProgramId(spaces);
  const explicitPrivacyRelations = program.relations.filter(
    (relation) => relation.kind === "must_not_touch"
  );
  const adjacencyRules = (program.pairRules ?? []).filter((rule) => rule.kind === "avoid_adjacency");

  let achieved = 0;
  let possible = 0;

  for (const relation of explicitPrivacyRelations) {
    const a = layout.get(relation.a);
    const b = layout.get(relation.b);
    if (!a || !b || a.floor !== b.floor) continue;
    possible += Math.max(0.1, relation.weight);
    if (!boundaryBetween(topology, a.id, b.id)) achieved += Math.max(0.1, relation.weight);
  }

  for (const rule of adjacencyRules) {
    const a = layout.get(rule.a);
    const b = layout.get(rule.b);
    if (!a || !b || a.floor !== b.floor) continue;
    possible += Math.max(0.1, rule.weight);
    if (!boundaryBetween(topology, a.id, b.id)) achieved += Math.max(0.1, rule.weight);
  }

  return possible === 0 ? 10 : 10 * (achieved / possible);
}

function scoreAreaEfficiency(program: ArchitecturalProgram, spaces: LayoutSpace[]): number {
  const layout = byProgramId(spaces);
  let score = 0;
  let count = 0;

  for (const programSpace of program.spaces) {
    const actual = layout.get(programSpace.id);
    const targetArea = programSpace.targetArea;
    if (!actual || !targetArea || targetArea <= 0) continue;

    const actualArea = actual.w * actual.h;
    const relativeError = Math.abs(actualArea - targetArea) / targetArea;
    score += clamp01(1 - relativeError);
    count++;
  }

  return count === 0 ? 8 : 8 * (score / count);
}

function scoreStructuralRegularity(spaces: LayoutSpace[], grid = 0.1): number {
  if (spaces.length === 0) return 0;

  const aligned = spaces.filter((space) => {
    const values = [space.x, space.y, space.w, space.h];
    return values.every((value) => Math.abs(value / grid - Math.round(value / grid)) < 0.001);
  }).length;

  return 4 * (aligned / spaces.length);
}

function scoreZoning(
  program: ArchitecturalProgram,
  spaces: LayoutSpace[],
  site: SiteConstraints
): number {
  const layout = byProgramId(spaces);
  let achieved = 0;
  let count = 0;

  for (const programSpace of program.spaces) {
    const actual = layout.get(programSpace.id);
    if (!actual) continue;
    const normalizedDepth = normalizedEntryDepth(actual, site);
    const error = Math.abs(normalizedDepth - desiredEntryDepth(programSpace.type));
    achieved += clamp01(1 - error / 0.55);
    count++;
  }

  return count === 0 ? 0 : 8 * (achieved / count);
}

/**
 * Heuristic design score, separate from regulatory compliance.
 * v3.1 totals 100 points and introduces an explicit habitability/furniture-fit
 * component while preserving strong weight for circulation and adjacency.
 */
export function scoreCandidate(
  program: ArchitecturalProgram,
  spaces: LayoutSpace[],
  topology: FloorTopology,
  site: SiteConstraints,
  issues: GeometryIssue[]
): CandidateScore {
  const adjacency = scoreAdjacency(program, spaces, topology);
  const circulation = scoreCirculation(program, spaces, topology);
  const compactness = scoreCompactness(spaces);
  const daylight = scoreDaylight(program, spaces, topology);
  const solarOrientation = scoreSolarOrientation(spaces, topology, site);
  const privacy = scorePrivacy(program, spaces, topology);
  const habitability = 8 * scoreFurnitureFit(spaces);
  const areaEfficiency = scoreAreaEfficiency(program, spaces);
  const structuralRegularity = scoreStructuralRegularity(spaces);
  const zoning = scoreZoning(program, spaces, site);

  const total =
    adjacency + circulation + compactness + daylight + solarOrientation + privacy +
    habitability + areaEfficiency + structuralRegularity + zoning;

  return {
    total: Number(total.toFixed(2)),
    hardConstraintPass: hardConstraintsPass(issues),
    adjacency: Number(adjacency.toFixed(2)),
    circulation: Number(circulation.toFixed(2)),
    compactness: Number(compactness.toFixed(2)),
    daylight: Number(daylight.toFixed(2)),
    solarOrientation: Number(solarOrientation.toFixed(2)),
    privacy: Number(privacy.toFixed(2)),
    habitability: Number(habitability.toFixed(2)),
    areaEfficiency: Number(areaEfficiency.toFixed(2)),
    structuralRegularity: Number(structuralRegularity.toFixed(2)),
    zoning: Number(zoning.toFixed(2)),
    issues,
  };
}
