import {
  ArchitecturalProgram,
  ExteriorBoundary,
  FloorTopology,
  LayoutSpace,
  SharedBoundary,
  TopologyOpening,
} from "./types";
import { boundaryBetween, exteriorBoundariesForSpace } from "./topology";

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
    hostBoundaryId: boundary.id,
    spaceAId: boundary.spaceAId,
    spaceBId: boundary.spaceBId,
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
    hostBoundaryId: boundary.id,
    spaceAId: boundary.spaceId,
    center: openingCenter(boundary.start, boundary.end),
    width,
  };
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
    if (!layoutA || !layoutB) continue;

    const boundary = boundaryBetween(topology, layoutA.id, layoutB.id);
    if (!boundary) continue;

    const maxWidth = availableWidth(boundary.length, config.edgeClearance);
    if (maxWidth < config.defaultDoorWidth) continue;

    doors.push(makeDoor(boundary, config.defaultDoorWidth, relation.id));
  }

  return doors;
}

/**
 * Plans one preliminary exterior window for spaces that explicitly require an
 * exterior opening. It intentionally does not claim RNE compliance: the final
 * window sizing must come from the rule engine and effective openable area.
 */
export function planPreliminaryWindows(
  program: ArchitecturalProgram,
  spaces: LayoutSpace[],
  topology: FloorTopology,
  config: OpeningPlannerConfig = DEFAULT_OPENING_PLANNER_CONFIG
): TopologyOpening[] {
  const windows: TopologyOpening[] = [];
  const layoutByProgramId = new Map(spaces.map((space) => [space.programSpaceId, space]));

  for (const programSpace of program.spaces) {
    if (!programSpace.requiresExteriorOpening) continue;

    const layoutSpace = layoutByProgramId.get(programSpace.id);
    if (!layoutSpace) continue;

    const candidates = exteriorBoundariesForSpace(topology, layoutSpace.id)
      .filter((boundary) => availableWidth(boundary.length, config.edgeClearance) >= config.minWindowWidth)
      .sort((a, b) => b.length - a.length);

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
  config: OpeningPlannerConfig = DEFAULT_OPENING_PLANNER_CONFIG
): FloorTopology {
  const doors = planDoors(program, spaces, topology, config);
  const windows = planPreliminaryWindows(program, spaces, topology, config);

  return {
    ...topology,
    openings: [...doors, ...windows],
  };
}
