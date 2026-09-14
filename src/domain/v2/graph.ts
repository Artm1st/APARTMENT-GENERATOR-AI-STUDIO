import { ArchitecturalProgram, SpatialRelation, SpatialRelationKind } from "./types";

export interface GraphIntegrityIssue {
  code: "MISSING_SPACE" | "SELF_RELATION" | "DUPLICATE_RELATION";
  relationId: string;
  message: string;
}

const pairKey = (a: string, b: string, kind: SpatialRelationKind): string => {
  const [left, right] = [a, b].sort();
  return `${left}::${right}::${kind}`;
};

export function validateProgramGraph(program: ArchitecturalProgram): GraphIntegrityIssue[] {
  const spaceIds = new Set(program.spaces.map((space) => space.id));
  const seen = new Set<string>();
  const issues: GraphIntegrityIssue[] = [];

  for (const relation of program.relations) {
    if (relation.a === relation.b) {
      issues.push({
        code: "SELF_RELATION",
        relationId: relation.id,
        message: `La relación ${relation.id} conecta el espacio ${relation.a} consigo mismo.`,
      });
      continue;
    }

    if (!spaceIds.has(relation.a) || !spaceIds.has(relation.b)) {
      issues.push({
        code: "MISSING_SPACE",
        relationId: relation.id,
        message: `La relación ${relation.id} referencia un espacio inexistente.`,
      });
    }

    const key = pairKey(relation.a, relation.b, relation.kind);
    if (seen.has(key)) {
      issues.push({
        code: "DUPLICATE_RELATION",
        relationId: relation.id,
        message: `La relación ${relation.id} duplica ${relation.kind} entre ${relation.a} y ${relation.b}.`,
      });
    }
    seen.add(key);
  }

  return issues;
}

export function getRelationsForSpace(
  program: ArchitecturalProgram,
  spaceId: string
): SpatialRelation[] {
  return program.relations.filter((relation) => relation.a === spaceId || relation.b === spaceId);
}

export function getNeighbors(
  program: ArchitecturalProgram,
  spaceId: string,
  kinds?: SpatialRelationKind[]
): string[] {
  const allowed = kinds ? new Set(kinds) : null;
  const neighbors = new Set<string>();

  for (const relation of program.relations) {
    if (allowed && !allowed.has(relation.kind)) continue;
    if (relation.a === spaceId) neighbors.add(relation.b);
    if (relation.b === spaceId) neighbors.add(relation.a);
  }

  return [...neighbors];
}

export function connectSpaces(
  program: ArchitecturalProgram,
  input: Omit<SpatialRelation, "id"> & { id?: string }
): ArchitecturalProgram {
  if (input.a === input.b) return program;

  const exists = program.relations.some(
    (relation) => pairKey(relation.a, relation.b, relation.kind) === pairKey(input.a, input.b, input.kind)
  );
  if (exists) return program;

  const relation: SpatialRelation = {
    ...input,
    id: input.id ?? `rel_${input.kind}_${[input.a, input.b].sort().join("_")}`,
    weight: Math.max(0, Math.min(1, input.weight)),
  };

  return {
    ...program,
    relations: [...program.relations, relation],
  };
}

export function disconnectSpaces(
  program: ArchitecturalProgram,
  a: string,
  b: string,
  kind?: SpatialRelationKind
): ArchitecturalProgram {
  return {
    ...program,
    relations: program.relations.filter((relation) => {
      const samePair =
        (relation.a === a && relation.b === b) || (relation.a === b && relation.b === a);
      if (!samePair) return true;
      if (!kind) return false;
      return relation.kind !== kind;
    }),
  };
}

export function removeSpace(program: ArchitecturalProgram, spaceId: string): ArchitecturalProgram {
  return {
    ...program,
    spaces: program.spaces.filter((space) => space.id !== spaceId),
    relations: program.relations.filter(
      (relation) => relation.a !== spaceId && relation.b !== spaceId
    ),
  };
}
