import {
  ArchitecturalProgram,
  ProgramSpace,
  SpatialRelation,
  SpatialRelationKind,
} from "./types";

const relationPriority: Record<SpatialRelationKind, number> = {
  must_not_touch: 5,
  direct_access: 4,
  must_touch: 3,
  prefer_touch: 2,
  near: 1,
};

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("::");
}

function hasConflict(
  relations: SpatialRelation[],
  a: string,
  b: string,
  desired: SpatialRelationKind
): boolean {
  const key = pairKey(a, b);
  return relations.some((relation) => {
    if (pairKey(relation.a, relation.b) !== key) return false;
    if (desired === "must_not_touch") return relation.kind === "direct_access" || relation.kind === "must_touch";
    return relation.kind === "must_not_touch";
  });
}

function upsertRelation(
  relations: SpatialRelation[],
  relation: SpatialRelation
): void {
  if (relation.a === relation.b) return;
  if (hasConflict(relations, relation.a, relation.b, relation.kind)) return;

  const key = pairKey(relation.a, relation.b);
  const existingIndex = relations.findIndex(
    (item) => pairKey(item.a, item.b) === key && item.kind === relation.kind
  );

  if (existingIndex >= 0) {
    const existing = relations[existingIndex];
    relations[existingIndex] = {
      ...existing,
      weight: Math.max(existing.weight, relation.weight),
    };
    return;
  }

  const stronger = relations.find(
    (item) =>
      pairKey(item.a, item.b) === key &&
      relationPriority[item.kind] > relationPriority[relation.kind]
  );
  if (stronger) return;

  relations.push(relation);
}

function floorOf(space: ProgramSpace): number {
  return space.floor ?? 0;
}

function byType(
  spaces: ProgramSpace[],
  type: ProgramSpace["type"],
  floor?: number
): ProgramSpace[] {
  return spaces.filter(
    (space) => space.type === type && (floor === undefined || floorOf(space) === floor)
  );
}

function firstOnFloor(
  spaces: ProgramSpace[],
  floor: number,
  types: ProgramSpace["type"][]
): ProgramSpace | undefined {
  for (const type of types) {
    const match = spaces.find((space) => space.type === type && floorOf(space) === floor);
    if (match) return match;
  }
  return undefined;
}

function hasAnyDirectAccess(relations: SpatialRelation[], spaceId: string): boolean {
  return relations.some(
    (relation) =>
      relation.kind === "direct_access" &&
      (relation.a === spaceId || relation.b === spaceId)
  );
}

function addDirect(
  relations: SpatialRelation[],
  a: ProgramSpace | undefined,
  b: ProgramSpace | undefined,
  id: string,
  weight = 0.95
): void {
  if (!a || !b || floorOf(a) !== floorOf(b)) return;
  upsertRelation(relations, {
    id,
    a: a.id,
    b: b.id,
    kind: "direct_access",
    weight,
  });
}

function ensureDistributionSpaces(spaces: ProgramSpace[]): ProgramSpace[] {
  const result = spaces.map((space) => ({ ...space }));
  const floors = [...new Set(result.map(floorOf))];

  for (const floor of floors) {
    const floorSpaces = result.filter((space) => floorOf(space) === floor);
    const hasCorridor = floorSpaces.some((space) => space.type === "corridor");
    if (hasCorridor) continue;

    const privateOrSanitary = floorSpaces.filter(
      (space) => space.type === "bedroom" || space.type === "bathroom" || space.type === "studio"
    ).length;
    const needsDistribution = privateOrSanitary >= 2 || floorSpaces.length >= 6;
    if (!needsDistribution) continue;

    result.push({
      id: `functional_distribuidor_n${floor + 1}`,
      type: "corridor",
      label: floor === 0 ? "Hall distribuidor" : `Distribuidor nivel ${floor + 1}`,
      targetArea: 3.5,
      privacy: "semi_private",
      requiresExteriorOpening: false,
      wetArea: false,
      floor,
    });
  }

  return result;
}

/**
 * Adds deterministic design heuristics that make the spatial program more
 * functional before geometry is generated. These are design heuristics, not
 * regulatory claims.
 */
export function enrichFunctionalProgram(program: ArchitecturalProgram): ArchitecturalProgram {
  const spaces = ensureDistributionSpaces(program.spaces);
  const relations = program.relations.map((relation) => ({ ...relation }));
  const floors = [...new Set(spaces.map(floorOf))];

  for (const floor of floors) {
    const corridor = firstOnFloor(spaces, floor, ["corridor"]);
    const stair = firstOnFloor(spaces, floor, ["stair"]);
    const living = firstOnFloor(spaces, floor, ["living"]);
    const dining = firstOnFloor(spaces, floor, ["dining"]);
    const kitchen = firstOnFloor(spaces, floor, ["kitchen"]);
    const circulationHub = corridor ?? stair ?? dining ?? living;

    addDirect(relations, living, dining, `functional_living_dining_n${floor}`, 1);
    addDirect(relations, kitchen, dining ?? living, `functional_kitchen_social_n${floor}`, 1);
    addDirect(relations, stair, corridor ?? living ?? dining, `functional_stair_hub_n${floor}`, 1);

    for (const bedroom of byType(spaces, "bedroom", floor)) {
      const hasSameFloorDirect = relations.some((relation) => {
        if (relation.kind !== "direct_access") return false;
        const otherId = relation.a === bedroom.id ? relation.b : relation.b === bedroom.id ? relation.a : null;
        if (!otherId) return false;
        const other = spaces.find((space) => space.id === otherId);
        return Boolean(other && floorOf(other) === floor);
      });
      if (!hasSameFloorDirect) {
        addDirect(relations, bedroom, circulationHub, `functional_${bedroom.id}_circulation`, 1);
      }
    }

    for (const bathroom of byType(spaces, "bathroom", floor)) {
      const hasSameFloorDirect = relations.some((relation) => {
        if (relation.kind !== "direct_access") return false;
        const otherId = relation.a === bathroom.id ? relation.b : relation.b === bathroom.id ? relation.a : null;
        if (!otherId) return false;
        const other = spaces.find((space) => space.id === otherId);
        return Boolean(other && floorOf(other) === floor && other.type === "bedroom");
      });

      if (!hasSameFloorDirect) {
        // Prefer a circulation/filter space. Only fall back to a social hub if
        // the program truly lacks distribution, which v3 normally adds first.
        addDirect(
          relations,
          bathroom,
          corridor ?? stair ?? dining ?? living,
          `functional_${bathroom.id}_circulation`,
          0.95
        );
      }
    }

    for (const laundry of byType(spaces, "laundry", floor)) {
      if (!hasAnyDirectAccess(relations, laundry.id)) {
        addDirect(
          relations,
          laundry,
          kitchen ?? corridor ?? stair,
          `functional_${laundry.id}_service`,
          0.9
        );
      }
    }

    for (const garage of byType(spaces, "garage", floor)) {
      if (!hasAnyDirectAccess(relations, garage.id)) {
        addDirect(
          relations,
          garage,
          corridor ?? living ?? dining,
          `functional_${garage.id}_entry`,
          0.9
        );
      }

      for (const bedroom of byType(spaces, "bedroom", floor)) {
        upsertRelation(relations, {
          id: `functional_${garage.id}_${bedroom.id}_separation`,
          a: garage.id,
          b: bedroom.id,
          kind: "must_not_touch",
          weight: 0.9,
        });
      }
    }

    for (const bathroom of byType(spaces, "bathroom", floor)) {
      if (kitchen) {
        upsertRelation(relations, {
          id: `functional_wet_${bathroom.id}_${kitchen.id}`,
          a: bathroom.id,
          b: kitchen.id,
          kind: "near",
          weight: 0.4,
        });
      }
    }
  }

  return {
    ...program,
    spaces,
    relations,
  };
}
