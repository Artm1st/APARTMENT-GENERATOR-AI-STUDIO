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

  // If a stronger compatible relation already exists, keep it instead of
  // duplicating the pair with a weaker relation.
  const stronger = relations.find(
    (item) =>
      pairKey(item.a, item.b) === key &&
      relationPriority[item.kind] > relationPriority[relation.kind]
  );
  if (stronger) return;

  relations.push(relation);
}

function byType(program: ArchitecturalProgram, type: ProgramSpace["type"]): ProgramSpace[] {
  return program.spaces.filter((space) => space.type === type);
}

function first(program: ArchitecturalProgram, types: ProgramSpace["type"][]): ProgramSpace | undefined {
  for (const type of types) {
    const match = program.spaces.find((space) => space.type === type);
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
  if (!a || !b) return;
  upsertRelation(relations, {
    id,
    a: a.id,
    b: b.id,
    kind: "direct_access",
    weight,
  });
}

/**
 * Adds deterministic design heuristics that make the spatial program more
 * functional before geometry is generated. These are design heuristics, not
 * regulatory claims.
 */
export function enrichFunctionalProgram(program: ArchitecturalProgram): ArchitecturalProgram {
  const relations = program.relations.map((relation) => ({ ...relation }));

  const corridor = first(program, ["corridor"]);
  const living = first(program, ["living"]);
  const dining = first(program, ["dining"]);
  const kitchen = first(program, ["kitchen"]);
  const circulationHub = corridor ?? dining ?? living;

  // Social sequence: living ↔ dining ↔ kitchen.
  addDirect(relations, living, dining, "functional_living_dining", 1);
  addDirect(relations, kitchen, dining ?? living, "functional_kitchen_social", 1);

  // Bedrooms should not become geometrically trapped. If Gemini already gave
  // a direct access (for example to a suite vestibule), preserve it; otherwise
  // connect the room to the main circulation hub.
  for (const bedroom of byType(program, "bedroom")) {
    if (!hasAnyDirectAccess(relations, bedroom.id)) {
      addDirect(
        relations,
        bedroom,
        circulationHub,
        `functional_${bedroom.id}_circulation`,
        1
      );
    }
  }

  // Common bathrooms need access from circulation. Bathrooms explicitly tied
  // to a bedroom by Gemini are treated as possible en-suite bathrooms.
  for (const bathroom of byType(program, "bathroom")) {
    if (!hasAnyDirectAccess(relations, bathroom.id)) {
      addDirect(
        relations,
        bathroom,
        circulationHub,
        `functional_${bathroom.id}_circulation`,
        0.95
      );
    }
  }

  // Laundry belongs to the service/wet zone and should connect to kitchen or
  // general circulation instead of floating independently.
  for (const laundry of byType(program, "laundry")) {
    if (!hasAnyDirectAccess(relations, laundry.id)) {
      addDirect(
        relations,
        laundry,
        kitchen ?? circulationHub,
        `functional_${laundry.id}_service`,
        0.9
      );
    }
  }

  // Garage: prefer a direct route into a hall/circulation zone, but keep the
  // bedrooms away from garage walls when there is no explicit contrary intent.
  for (const garage of byType(program, "garage")) {
    if (!hasAnyDirectAccess(relations, garage.id)) {
      addDirect(
        relations,
        garage,
        corridor ?? living ?? dining,
        `functional_${garage.id}_entry`,
        0.9
      );
    }

    for (const bedroom of byType(program, "bedroom")) {
      upsertRelation(relations, {
        id: `functional_${garage.id}_${bedroom.id}_separation`,
        a: garage.id,
        b: bedroom.id,
        kind: "must_not_touch",
        weight: 0.9,
      });
    }
  }

  // Keep wet/service spaces reasonably close without forcing every bathroom to
  // share a wall with the kitchen.
  for (const bathroom of byType(program, "bathroom")) {
    if (kitchen) {
      upsertRelation(relations, {
        id: `functional_wet_${bathroom.id}_${kitchen.id}`,
        a: bathroom.id,
        b: kitchen.id,
        kind: "near",
        weight: 0.45,
      });
    }
  }

  return {
    ...program,
    relations,
  };
}
