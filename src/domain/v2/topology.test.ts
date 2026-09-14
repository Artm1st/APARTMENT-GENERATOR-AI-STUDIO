import test from "node:test";
import assert from "node:assert/strict";
import {
  ArchitecturalProgram,
  LayoutSpace,
  SiteConstraints,
} from "./types";
import { deriveFloorTopology, findSharedBoundary, spacesOverlap } from "./topology";
import { planTopologyOpenings } from "./openingPlanner";
import { validateHardGeometryConstraints } from "./constraints";
import { prepareCandidate } from "./candidatePipeline";

const site: SiteConstraints = {
  width: 8,
  length: 6,
  setbackFront: 0,
  setbackBack: 0,
  setbackLeft: 0,
  setbackRight: 0,
  source: "test",
};

const living: LayoutSpace = {
  id: "layout_living",
  programSpaceId: "living",
  type: "living",
  label: "Sala",
  x: 2,
  y: 3,
  w: 4,
  h: 6,
  floor: 0,
};

const kitchen: LayoutSpace = {
  id: "layout_kitchen",
  programSpaceId: "kitchen",
  type: "kitchen",
  label: "Cocina",
  x: 6,
  y: 3,
  w: 4,
  h: 6,
  floor: 0,
};

const program: ArchitecturalProgram = {
  projectType: "single_family_house",
  spaces: [
    {
      id: "living",
      type: "living",
      label: "Sala",
      targetArea: 24,
      privacy: "public",
      requiresExteriorOpening: true,
    },
    {
      id: "kitchen",
      type: "kitchen",
      label: "Cocina",
      targetArea: 24,
      privacy: "service",
      requiresExteriorOpening: true,
      wetArea: true,
    },
  ],
  relations: [
    {
      id: "living_kitchen_access",
      a: "living",
      b: "kitchen",
      kind: "direct_access",
      weight: 1,
    },
  ],
  preferences: [],
};

test("detects a real shared boundary between adjacent spaces", () => {
  assert.equal(spacesOverlap(living, kitchen), false);

  const boundary = findSharedBoundary(living, kitchen);
  assert.ok(boundary);
  assert.equal(boundary.orientation, "vertical");
  assert.equal(boundary.sideOfA, "right");
  assert.equal(boundary.sideOfB, "left");
  assert.equal(boundary.length, 6);
});

test("derives exposed boundaries instead of treating every wall as exterior", () => {
  const topology = deriveFloorTopology([living, kitchen]);

  assert.equal(topology.sharedBoundaries.length, 1);
  assert.equal(
    topology.exteriorBoundaries.some(
      (boundary) => boundary.spaceId === living.id && boundary.side === "right"
    ),
    false
  );
  assert.equal(
    topology.exteriorBoundaries.some(
      (boundary) => boundary.spaceId === kitchen.id && boundary.side === "left"
    ),
    false
  );
});

test("places direct-access doors on shared boundaries and windows on exterior boundaries", () => {
  const rawTopology = deriveFloorTopology([living, kitchen]);
  const topology = planTopologyOpenings(program, [living, kitchen], rawTopology);

  const door = topology.openings.find((opening) => opening.type === "door");
  assert.ok(door);
  assert.equal(door.spaceAId, living.id);
  assert.equal(door.spaceBId, kitchen.id);
  assert.ok(topology.sharedBoundaries.some((boundary) => boundary.id === door.hostBoundaryId));

  const windows = topology.openings.filter((opening) => opening.type === "window");
  assert.equal(windows.length, 2);
  for (const window of windows) {
    assert.ok(
      topology.exteriorBoundaries.some((boundary) => boundary.id === window.hostBoundaryId)
    );
  }
});

test("accepts a simple valid candidate", () => {
  const candidate = prepareCandidate("candidate_valid", program, [living, kitchen], site, 42);

  assert.equal(candidate.score?.hardConstraintPass, true);
  assert.equal(candidate.score?.issues.length, 0);
  assert.equal(candidate.topology.sharedBoundaries.length, 1);
});

test("rejects overlapping spaces", () => {
  const overlappingKitchen: LayoutSpace = {
    ...kitchen,
    x: 5.5,
  };

  const topology = planTopologyOpenings(
    program,
    [living, overlappingKitchen],
    deriveFloorTopology([living, overlappingKitchen])
  );
  const issues = validateHardGeometryConstraints(
    program,
    [living, overlappingKitchen],
    topology,
    site
  );

  assert.ok(issues.some((issue) => issue.code === "SPACE_OVERLAP"));
});
