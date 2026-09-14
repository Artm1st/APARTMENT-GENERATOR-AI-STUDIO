import test from "node:test";
import assert from "node:assert/strict";
import { validateHardGeometryConstraints } from "./constraints";
import { deriveFloorTopology } from "./topology";
import { planTopologyOpenings } from "./openingPlanner";
import type { ArchitecturalProgram, LayoutSpace, SiteConstraints } from "./types";

const site: SiteConstraints = {
  width: 12,
  length: 16,
  setbackFront: 1,
  setbackBack: 1,
  setbackLeft: 1,
  setbackRight: 1,
};

const spaces: LayoutSpace[] = [
  {
    id: "layout_living",
    programSpaceId: "living",
    type: "living",
    label: "Sala",
    x: 4,
    y: 5,
    w: 4,
    h: 4,
    floor: 0,
  },
  {
    id: "layout_bedroom",
    programSpaceId: "bedroom",
    type: "bedroom",
    label: "Dormitorio",
    x: 8,
    y: 5,
    w: 4,
    h: 4,
    floor: 0,
  },
];

const baseProgram: ArchitecturalProgram = {
  projectType: "single_family_house",
  spaces: [
    { id: "living", type: "living", label: "Sala", privacy: "public" },
    { id: "bedroom", type: "bedroom", label: "Dormitorio", privacy: "private" },
  ],
  relations: [],
  preferences: [],
};

test("two interior spaces without a door fail circulation connectivity", () => {
  const topology = deriveFloorTopology(spaces);
  const issues = validateHardGeometryConstraints(baseProgram, spaces, topology, site);
  assert.equal(issues.some((issue) => issue.code === "DISCONNECTED_CIRCULATION"), true);
});

test("a real door on the shared wall connects the circulation graph", () => {
  const program: ArchitecturalProgram = {
    ...baseProgram,
    relations: [
      {
        id: "living_bedroom",
        a: "living",
        b: "bedroom",
        kind: "direct_access",
        weight: 1,
      },
    ],
  };
  const raw = deriveFloorTopology(spaces);
  const topology = planTopologyOpenings(program, spaces, raw);
  const issues = validateHardGeometryConstraints(program, spaces, topology, site);

  assert.equal(issues.some((issue) => issue.code === "DISCONNECTED_CIRCULATION"), false);
  assert.equal(issues.some((issue) => issue.code === "BROKEN_DIRECT_ACCESS"), false);
});
