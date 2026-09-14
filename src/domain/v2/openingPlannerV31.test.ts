import test from "node:test";
import assert from "node:assert/strict";
import { deriveFloorTopology } from "./topology";
import { planTopologyOpenings } from "./openingPlanner";
import type { ArchitecturalProgram, LayoutSpace, SiteConstraints } from "./types";

const site: SiteConstraints = {
  width: 10,
  length: 12,
  setbackFront: 0,
  setbackBack: 0,
  setbackLeft: 0,
  setbackRight: 0,
  entrySide: "front",
  northAngleDeg: 0,
  hemisphere: "south",
  levels: 1,
};

const spaces: LayoutSpace[] = [{
  id: "layout_living",
  programSpaceId: "living",
  type: "living",
  label: "Sala",
  x: 5,
  y: 4,
  w: 4,
  h: 4,
  floor: 0,
}];

const program: ArchitecturalProgram = {
  projectType: "single_family_house",
  spaces: [{
    id: "living",
    type: "living",
    label: "Sala",
    privacy: "public",
    requiresExteriorOpening: true,
    floor: 0,
  }],
  relations: [],
  preferences: [],
};

test("planner creates a real exterior main entry on selected front facade", () => {
  const raw = deriveFloorTopology(spaces);
  const topology = planTopologyOpenings(program, spaces, raw, undefined, site);
  const entry = topology.openings.find((opening) => opening.role === "main_entry");
  assert.ok(entry);
  const host = topology.exteriorBoundaries.find((boundary) => boundary.id === entry?.hostBoundaryId);
  assert.equal(host?.side, "bottom");
  assert.equal(entry?.spaceBId, undefined);
});

test("daylight window prefers north-facing facade in southern hemisphere", () => {
  const raw = deriveFloorTopology(spaces);
  const topology = planTopologyOpenings(program, spaces, raw, undefined, site);
  const window = topology.openings.find((opening) => opening.type === "window");
  assert.ok(window);
  const host = topology.exteriorBoundaries.find((boundary) => boundary.id === window?.hostBoundaryId);
  assert.equal(host?.side, "top");
});
