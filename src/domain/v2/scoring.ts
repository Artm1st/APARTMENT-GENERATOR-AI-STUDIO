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
    if (!a || !b) continue;

    const weight = Math.max(0.05, relation.weight);
    possible += weight;
    achieved += weight * relationSatisfaction(relation.kind, a, b, topology);
  }

  if (possible === 0) return 25;
  return 25 * (achieved / possible);
}

function scoreCirculation(
  program: ArchitecturalProgram,
  spaces: LayoutSpace[],
  topology: FloorTopology
): number {
  const layout = byProgramId(spaces);
  const directRelations = program.relations.filter((relation) => relation.kind === "direct_access");
  if (directRelations.length === 0) return 20;

  let valid = 0;
  for (const relation of directRelations) {
    const a = layout.get(relation.a);
    const b = layout.get(relation.b);
    if (!a || !b) continue;
    if (hasDoor(topology, a.id, b.id)) valid++;
  }

  return 20 * (valid / directRelations.length);
}

function scoreCompactness(spaces: LayoutSpace[]): number {
  if (spaces.length === 0) return 0;

  const bounds = spaces.map(getSpaceBounds);
  const minX = Math.min(...bounds.map((bound) => bound.minX));
  const maxX = Math.max(...bounds.map((bound) => bound.maxX));
  const minY = Math.min(...bounds.map((bound) => bound.minY));
  const maxY = Math.max(...bounds.map((bound) => bound.maxY));
  const envelopeArea = Math.max(0.001, (maxX - minX) * (maxY - minY));
  const roomArea = spaces.reduce((sum, space) => sum + space.w * space.h, 0);

  return 15 * clamp01(roomArea / envelopeArea);
}

function scoreDaylight(
  program: ArchitecturalProgram,
  spaces: LayoutSpace[],
  topology: FloorTopology
): number {
  const layout = byProgramId(spaces);
  const required = program.spaces.filter((space) => space.requiresExteriorOpening);
  if (required.length === 0) return 15;

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

  return 15 * (valid / required.length);
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
  if (explicitPrivacyRelations.length === 0) return 10;

  let valid = 0;
  for (const relation of explicitPrivacyRelations) {
    const a = layout.get(relation.a);
    const b = layout.get(relation.b);
    if (!a || !b) continue;
    if (!boundaryBetween(topology, a.id, b.id)) valid++;
  }

  return 10 * (valid / explicitPrivacyRelations.length);
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

  return count === 0 ? 10 : 10 * (score / count);
}

function scoreStructuralRegularity(spaces: LayoutSpace[], grid = 0.1): number {
  if (spaces.length === 0) return 0;

  const aligned = spaces.filter((space) => {
    const values = [space.x, space.y, space.w, space.h];
    return values.every((value) => Math.abs(value / grid - Math.round(value / grid)) < 0.001);
  }).length;

  return 5 * (aligned / spaces.length);
}

/**
 * Heuristic design score. This is intentionally separate from regulatory
 * compliance: a high soft score can never turn a failed hard constraint into
 * a valid solution.
 */
export function scoreCandidate(
  program: ArchitecturalProgram,
  spaces: LayoutSpace[],
  topology: FloorTopology,
  _site: SiteConstraints,
  issues: GeometryIssue[]
): CandidateScore {
  const adjacency = scoreAdjacency(program, spaces, topology);
  const circulation = scoreCirculation(program, spaces, topology);
  const compactness = scoreCompactness(spaces);
  const daylight = scoreDaylight(program, spaces, topology);
  const privacy = scorePrivacy(program, spaces, topology);
  const areaEfficiency = scoreAreaEfficiency(program, spaces);
  const structuralRegularity = scoreStructuralRegularity(spaces);

  const total =
    adjacency +
    circulation +
    compactness +
    daylight +
    privacy +
    areaEfficiency +
    structuralRegularity;

  return {
    total: Number(total.toFixed(2)),
    hardConstraintPass: hardConstraintsPass(issues),
    adjacency: Number(adjacency.toFixed(2)),
    circulation: Number(circulation.toFixed(2)),
    compactness: Number(compactness.toFixed(2)),
    daylight: Number(daylight.toFixed(2)),
    privacy: Number(privacy.toFixed(2)),
    areaEfficiency: Number(areaEfficiency.toFixed(2)),
    structuralRegularity: Number(structuralRegularity.toFixed(2)),
    issues,
  };
}
