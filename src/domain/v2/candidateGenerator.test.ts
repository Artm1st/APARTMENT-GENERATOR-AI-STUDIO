import test from "node:test";
import assert from "node:assert/strict";
import { ArchitecturalProgram, SiteConstraints } from "./types";
import {
  DEFAULT_CANDIDATE_GENERATOR_CONFIG,
  generateRankedCandidates,
  generateSeededCandidate,
} from "./candidateGenerator";

const program: ArchitecturalProgram = {
  projectType: "single_family_house",
  spaces: [
    {
      id: "living",
      type: "living",
      label: "Sala",
      targetArea: 16,
      privacy: "public",
      requiresExteriorOpening: true,
    },
    {
      id: "kitchen",
      type: "kitchen",
      label: "Cocina",
      targetArea: 8,
      privacy: "service",
      requiresExteriorOpening: true,
      wetArea: true,
    },
    {
      id: "bedroom",
      type: "bedroom",
      label: "Dormitorio",
      targetArea: 10,
      privacy: "private",
      requiresExteriorOpening: true,
    },
  ],
  relations: [
    {
      id: "living_kitchen",
      a: "living",
      b: "kitchen",
      kind: "direct_access",
      weight: 1,
    },
    {
      id: "living_bedroom",
      a: "living",
      b: "bedroom",
      kind: "prefer_touch",
      weight: 0.4,
    },
  ],
  preferences: [],
};

const site: SiteConstraints = {
  width: 12,
  length: 16,
  setbackFront: 2,
  setbackBack: 2,
  setbackLeft: 1,
  setbackRight: 1,
  source: "test",
};

test("same seed produces the same candidate", () => {
  const a = generateSeededCandidate(program, site, 12345);
  const b = generateSeededCandidate(program, site, 12345);

  assert.deepEqual(a.spaces, b.spaces);
  assert.deepEqual(a.topology, b.topology);
  assert.deepEqual(a.score, b.score);
});

test("multi-candidate generation returns requested count and deterministic ranking", () => {
  const config = {
    ...DEFAULT_CANDIDATE_GENERATOR_CONFIG,
    candidateCount: 8,
  };

  const first = generateRankedCandidates(program, site, 77, config);
  const second = generateRankedCandidates(program, site, 77, config);

  assert.equal(first.length, 8);
  assert.deepEqual(
    first.map((candidate) => candidate.id),
    second.map((candidate) => candidate.id)
  );

  let invalidSeen = false;
  for (const candidate of first) {
    const valid = candidate.score?.hardConstraintPass === true;
    if (!valid) invalidSeen = true;
    if (invalidSeen) assert.equal(valid, false);
  }
});
