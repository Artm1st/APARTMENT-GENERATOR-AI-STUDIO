import test from "node:test";
import assert from "node:assert/strict";
import { rebalanceProgramToSite } from "./programAreaBudget";
import type { ArchitecturalProgram, SiteConstraints } from "./types";

const site: SiteConstraints = {
  width: 6,
  length: 10,
  setbackFront: 0,
  setbackBack: 0,
  setbackLeft: 0,
  setbackRight: 0,
  levels: 1,
};

const program: ArchitecturalProgram = {
  projectType: "single_family_house",
  spaces: [
    { id: "living", type: "living", label: "Sala", targetArea: 28, privacy: "public" },
    { id: "dining", type: "dining", label: "Comedor", targetArea: 18, privacy: "public" },
    { id: "bed", type: "bedroom", label: "Dormitorio", targetArea: 16, privacy: "private" },
    { id: "bath", type: "bathroom", label: "Baño", targetArea: 6, minArea: 4, privacy: "private" },
  ],
  relations: [],
  preferences: [],
};

test("program budget reduces flexible targets when requested program exceeds site capacity", () => {
  const result = rebalanceProgramToSite(program, site, 0.8);
  assert.equal(result.budget.adjusted, true);
  assert.ok(result.budget.adjustedProgramArea < result.budget.requestedProgramArea);
  assert.equal(result.budget.netProgramCapacity, 48);
});

test("program budget never reduces explicit user minArea", () => {
  const result = rebalanceProgramToSite(program, site, 0.7);
  const bath = result.program.spaces.find((space) => space.id === "bath");
  assert.ok((bath?.targetArea ?? 0) >= 4);
});
