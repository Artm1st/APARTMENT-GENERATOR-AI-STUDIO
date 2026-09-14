import test from "node:test";
import assert from "node:assert/strict";
import { enrichFunctionalProgram } from "./functionalProgram";
import type { ArchitecturalProgram } from "./types";

const program: ArchitecturalProgram = {
  projectType: "single_family_house",
  spaces: [
    { id: "living", type: "living", label: "Sala", privacy: "public" },
    { id: "dining", type: "dining", label: "Comedor", privacy: "public" },
    { id: "kitchen", type: "kitchen", label: "Cocina", privacy: "service", wetArea: true },
    { id: "hall", type: "corridor", label: "Hall", privacy: "semi_private" },
    { id: "bed1", type: "bedroom", label: "Dormitorio 1", privacy: "private" },
    { id: "bath", type: "bathroom", label: "Baño", privacy: "private", wetArea: true },
    { id: "laundry", type: "laundry", label: "Lavandería", privacy: "service", wetArea: true },
    { id: "garage", type: "garage", label: "Cochera", privacy: "service" },
  ],
  relations: [],
  preferences: [],
};

function hasRelation(
  enriched: ArchitecturalProgram,
  a: string,
  b: string,
  kind: string
): boolean {
  return enriched.relations.some(
    (relation) =>
      relation.kind === kind &&
      ((relation.a === a && relation.b === b) || (relation.a === b && relation.b === a))
  );
}

test("functional enrichment creates a circulation backbone", () => {
  const enriched = enrichFunctionalProgram(program);

  assert.equal(hasRelation(enriched, "living", "dining", "direct_access"), true);
  assert.equal(hasRelation(enriched, "kitchen", "dining", "direct_access"), true);
  assert.equal(hasRelation(enriched, "bed1", "hall", "direct_access"), true);
  assert.equal(hasRelation(enriched, "bath", "hall", "direct_access"), true);
  assert.equal(hasRelation(enriched, "laundry", "kitchen", "direct_access"), true);
  assert.equal(hasRelation(enriched, "garage", "hall", "direct_access"), true);
  assert.equal(hasRelation(enriched, "garage", "bed1", "must_not_touch"), true);
});

test("functional enrichment is deterministic and does not mutate input", () => {
  const before = JSON.stringify(program);
  const first = enrichFunctionalProgram(program);
  const second = enrichFunctionalProgram(program);

  assert.equal(JSON.stringify(program), before);
  assert.deepEqual(first, second);
});
