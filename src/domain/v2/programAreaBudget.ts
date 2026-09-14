import type { ArchitecturalProgram, ProgramSpace, SiteConstraints, SpaceType } from "./types";
import { buildableBounds, resolvedLevels } from "./architecturalGrammarV3";

export interface ProgramAreaBudget {
  buildableFootprint: number;
  levels: number;
  grossPotentialArea: number;
  planningEfficiency: number;
  netProgramCapacity: number;
  requestedProgramArea: number;
  adjustedProgramArea: number;
  pressureRatio: number;
  adjusted: boolean;
  feasibleWithinDesignFloors: boolean;
}

// Design targets and floors only. They are not regulatory minimum areas.
const FALLBACK_TARGET: Record<SpaceType, number> = {
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

const DESIGN_FLOOR: Record<SpaceType, number> = {
  living: 11,
  bedroom: 8.2,
  bathroom: 3.2,
  kitchen: 5.5,
  dining: 6.5,
  corridor: 3,
  garage: 13,
  laundry: 2.8,
  terrace: 4,
  patio: 4,
  studio: 5,
  stair: 4,
  other: 4,
};

const FLEXIBILITY: Record<SpaceType, number> = {
  living: 0.75,
  bedroom: 0.35,
  bathroom: 0.15,
  kitchen: 0.35,
  dining: 0.85,
  corridor: 0.7,
  garage: 0.15,
  laundry: 0.45,
  terrace: 1,
  patio: 1,
  studio: 0.9,
  stair: 0.1,
  other: 0.85,
};

function areaFor(space: ProgramSpace): number {
  return Math.max(space.minArea ?? 0, space.targetArea ?? FALLBACK_TARGET[space.type]);
}

function designFloorFor(space: ProgramSpace): number {
  // Explicit user minArea always wins over internal design heuristics.
  return Math.max(space.minArea ?? 0, DESIGN_FLOOR[space.type]);
}

export function rebalanceProgramToSite(
  program: ArchitecturalProgram,
  site: SiteConstraints,
  planningEfficiency = 0.8
): { program: ArchitecturalProgram; budget: ProgramAreaBudget } {
  const bounds = buildableBounds(site);
  const footprint = Math.max(0, bounds.maxX - bounds.minX) * Math.max(0, bounds.maxY - bounds.minY);
  const levels = resolvedLevels(site);
  const grossPotentialArea = footprint * levels;
  const efficiency = Math.max(0.55, Math.min(0.9, planningEfficiency));
  const netProgramCapacity = grossPotentialArea * efficiency;

  const original = program.spaces.map((space) => ({ ...space, targetArea: areaFor(space) }));
  const requestedProgramArea = original.reduce((sum, space) => sum + (space.targetArea ?? 0), 0);
  const minimumDesignArea = original.reduce((sum, space) => sum + designFloorFor(space), 0);

  if (requestedProgramArea <= netProgramCapacity || netProgramCapacity <= 0) {
    return {
      program: { ...program, spaces: original },
      budget: {
        buildableFootprint: Number(footprint.toFixed(2)),
        levels,
        grossPotentialArea: Number(grossPotentialArea.toFixed(2)),
        planningEfficiency: efficiency,
        netProgramCapacity: Number(netProgramCapacity.toFixed(2)),
        requestedProgramArea: Number(requestedProgramArea.toFixed(2)),
        adjustedProgramArea: Number(requestedProgramArea.toFixed(2)),
        pressureRatio: netProgramCapacity > 0 ? Number((requestedProgramArea / netProgramCapacity).toFixed(3)) : 999,
        adjusted: false,
        feasibleWithinDesignFloors: minimumDesignArea <= netProgramCapacity,
      },
    };
  }

  const capacityForReduction = Math.max(0, requestedProgramArea - netProgramCapacity);
  const reducible = original.reduce((sum, space) => {
    const target = space.targetArea ?? 0;
    const floor = designFloorFor(space);
    return sum + Math.max(0, target - floor) * FLEXIBILITY[space.type];
  }, 0);
  const reductionFraction = reducible > 0 ? Math.min(1, capacityForReduction / reducible) : 1;

  const adjustedSpaces = original.map((space) => {
    const target = space.targetArea ?? 0;
    const floor = designFloorFor(space);
    const reducibleForSpace = Math.max(0, target - floor) * FLEXIBILITY[space.type];
    const adjusted = Math.max(floor, target - reducibleForSpace * reductionFraction);
    return { ...space, targetArea: Number(adjusted.toFixed(2)) };
  });

  const adjustedProgramArea = adjustedSpaces.reduce((sum, space) => sum + (space.targetArea ?? 0), 0);

  return {
    program: { ...program, spaces: adjustedSpaces },
    budget: {
      buildableFootprint: Number(footprint.toFixed(2)),
      levels,
      grossPotentialArea: Number(grossPotentialArea.toFixed(2)),
      planningEfficiency: efficiency,
      netProgramCapacity: Number(netProgramCapacity.toFixed(2)),
      requestedProgramArea: Number(requestedProgramArea.toFixed(2)),
      adjustedProgramArea: Number(adjustedProgramArea.toFixed(2)),
      pressureRatio: netProgramCapacity > 0 ? Number((requestedProgramArea / netProgramCapacity).toFixed(3)) : 999,
      adjusted: true,
      feasibleWithinDesignFloors: minimumDesignArea <= netProgramCapacity,
    },
  };
}
