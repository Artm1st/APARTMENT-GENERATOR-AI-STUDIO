import {
  ArchitecturalProgram,
  ExteriorBoundary,
  FloorTopology,
  LayoutSpace,
  SharedBoundary,
  SiteConstraints,
  TopologyOpening,
  WallSide,
} from "./types";
import { boundaryBetween, exteriorBoundariesForSpace } from "./topology";
import {
  exteriorSideAzimuth,
  normalizedEntryDepth,
  resolvedEntrySide,
  solarExposurePreference,
} from "./architecturalGrammarV3";

export interface OpeningPlannerConfig {
  defaultDoorWidth: number;
  defaultWindowWidth: number;
  edgeClearance: number;
  minWindowWidth: number;
}

export const DEFAULT_OPENING_PLANNER_CONFIG: OpeningPlannerConfig = {
  defaultDoorWidth: 0.9,
  defaultWindowWidth: 1.2,
  edgeClearance: 0.15,
  minWindowWidth: 0.6,
};

function openingCenter(start: number, end: number): number {
  return start + (end - start) / 2;
}

function availableWidth(length: number, clearance: number): number {
  return Math.max(0, length - clearance * 2);
}

function makeDoor(
  boundary: SharedBoundary,
  width: number,
  relationId: string
): TopologyOpening {
  return {
    id: `door_${relationId}_${boundary.id}`,
    type: "door",
    role: "interior",
    hostBoundaryId: boundary.id,
    spaceAId: boundary.spaceAId,
    spaceBId: boundary.spaceBId,
    center: openingCenter(boundary.start, boundary.end),
    width,
  };
}

function makeExteriorDoor(boundary: ExteriorBoundary, width: number): TopologyOpening {
  return {
    id: `door_main_entry_${boundary.id}`,
    type: "door",
    role: "main_entry",
    hostBoundaryId: boundary.id,
    spaceAId: boundary.spaceId,
    center: openingCenter(boundary.start, boundary.end),
    width,
  };
}

function makeWindow(
  boundary: ExteriorBoundary,
  width: number
): TopologyOpening {
  return {
    id: `window_${boundary.id}`,
    type: "window",
    role: "daylight",
    hostBoundaryId: boundary.id,
    spaceAId: boundary.spaceId,
    center: openingCenter(boundary.start, boundary.end),
    width,
  };
}

function entryWallSide(site: SiteConstraints): WallSide {
  switch (resolvedEntrySide(site)) {
    case "back": return "top";
    case "left": return "left";
    case "right": return "right";
    case "front":
    default: return "bottom";
  }
}

function entrySpacePriority(space: LayoutSpace): number {
  switch (space.type) {
    case "corridor": return 6;
    case "living": return 5;
    case "dining": return 4;
    case "stair": return 3;
    case "studio": return 2;
    default: return 0;
  }
}

/**
 * Creates one real exterior main-entry door on the chosen entry-facing facade.
 * Bedrooms, bathrooms, kitchens and service rooms are deliberately not used as
 * the primary entry receiver in this preliminary grammar.
 */
export function planMainEntryDoor(
  spaces: LayoutSpace[],
  topology: FloorTopology,
  site: SiteConstraints,
  config: OpeningPlannerConfig = DEFAULT_OPENING_PLANNER_CONFIG
): TopologyOpening[] {
  const byId = new Map(spaces.map((space) => [space.id, space]));
  const desiredSide = entryWallSide(site);

  const candidates = topology.exteriorBoundaries
    .map((boundary) => ({ boundary, space: byId.get(boundary.spaceId) }))
    .filter((item): item is { boundary: ExteriorBoundary; space: LayoutSpace } => Boolean(item.space))
    .filter(({ boundary, space }) =>
      space.floor === 0 &&
      entrySpacePriority(space) > 0 &&
      boundary.side === desiredSide &&
      availableWidth(boundary.length, config.edgeClearance) >= config.defaultDoorWidth
    )
    .sort((a, b) => {
      const priority = entrySpacePriority(b.space) - entrySpacePriority(a.space);
      if (priority !== 0) return priority;
      const depth = normalizedEntryDepth(a.space, site) - normalizedEntryDepth(b.space, site);
      if (Math.abs(depth) > 0.001) return depth;
      return b.boundary.length - a.boundary.length;
    });

  const selected = candidates[0];
  if (!selected) return [];
  return [makeExteriorDoor(selected.boundary, config.defaultDoorWidth)];
}

/**
 * Plans doors only for explicit `direct_access` relations.
 * A door is created only when both spaces have a real shared boundary long enough
 * to host the requested clear width plus edge clearances.
 */
export function planDoors(
  program: ArchitecturalProgram,
  spaces: LayoutSpace[],
  topology: FloorTopology,
  config: OpeningPlannerConfig = DEFAULT_OPENING_PLANNER_CONFIG
): TopologyOpening[] {
  const doors: TopologyOpening[] = [];
  const layoutByProgramId = new Map(spaces.map((space) => [space.programSpaceId, space]));

  for (const relation of program.relations) {
    if (relation.kind !== "direct_access") continue;

    const layoutA = layoutByProgramId.get(relation.a);
    const layoutB = layoutByProgramId.get(relation.b);
    if (!layoutA || !layoutB || layoutA.floor !== layoutB.floor) continue;

    const boundary = boundaryBetween(topology, layoutA.id, layoutB.id);
    if (!boundary) continue;

    const maxWidth = availableWidth(boundary.length, config.edgeClearance);
    if (maxWidth < config.defaultDoorWidth) continue;

    doors.push(makeDoor(boundary, config.defaultDoorWidth, relation.id));
  }

  return doors;
}

function windowBoundaryScore(
  boundary: ExteriorBoundary,
  space: LayoutSpace,
  site?: SiteConstraints
): number {
  const lengthScore = Math.min(1, boundary.length / 3);
  if (!site) return lengthScore;
  const solar = solarExposurePreference(
    space.type,
    exteriorSideAzimuth(boundary.side, site),
    site
  );
  return solar * 0.78 + lengthScore * 0.22;
}

/**
 * Plans one preliminary exterior window for spaces that explicitly require an
 * exterior opening. When site orientation is available, candidate facades are
 * ranked by preliminary solar preference before wall length.
 */
export function planPreliminaryWindows(
  program: ArchitecturalProgram,
  spaces: LayoutSpace[],
  topology: FloorTopology,
  config: OpeningPlannerConfig = DEFAULT_OPENING_PLANNER_CONFIG,
  site?: SiteConstraints,
  excludedHostIds: Set<string> = new Set()
): TopologyOpening[] {
  const windows: TopologyOpening[] = [];
  const layoutByProgramId = new Map(spaces.map((space) => [space.programSpaceId, space]));

  for (const programSpace of program.spaces) {
    if (!programSpace.requiresExteriorOpening) continue;

    const layoutSpace = layoutByProgramId.get(programSpace.id);
    if (!layoutSpace) continue;

    let candidates = exteriorBoundariesForSpace(topology, layoutSpace.id)
      .filter((boundary) => availableWidth(boundary.length, config.edgeClearance) >= config.minWindowWidth)
      .sort((a, b) => windowBoundaryScore(b, layoutSpace, site) - windowBoundaryScore(a, layoutSpace, site));

    const nonEntryCandidates = candidates.filter((boundary) => !excludedHostIds.has(boundary.id));
    if (nonEntryCandidates.length > 0) candidates = nonEntryCandidates;

    const host = candidates[0];
    if (!host) continue;

    const maxWidth = availableWidth(host.length, config.edgeClearance);
    const width = Math.min(config.defaultWindowWidth, maxWidth);
    if (width < config.minWindowWidth) continue;

    windows.push(makeWindow(host, width));
  }

  return windows;
}

export function planTopologyOpenings(
  program: ArchitecturalProgram,
  spaces: LayoutSpace[],
  topology: FloorTopology,
  config: OpeningPlannerConfig = DEFAULT_OPENING_PLANNER_CONFIG,
  site?: SiteConstraints
): FloorTopology {
  const interiorDoors = planDoors(program, spaces, topology, config);
  const entryDoors = site ? planMainEntryDoor(spaces, topology, site, config) : [];
  const entryHosts = new Set(entryDoors.map((opening) => opening.hostBoundaryId));
  const windows = planPreliminaryWindows(program, spaces, topology, config, site, entryHosts);

  return {
    ...topology,
    openings: [...interiorDoors, ...entryDoors, ...windows],
  };
}
