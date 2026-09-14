import test from "node:test";
import assert from "node:assert/strict";
import {
  applyArchitecturalGrammarV3,
  normalizedEntryDepth,
  solarExposurePreference,
} from "./architecturalGrammarV3";
import { generateSeededCandidate } from "./candidateGenerator";
import type { ArchitecturalProgram, SiteConstraints } from "./types";

const baseProgram: ArchitecturalProgram = {
  projectType: "single_family_house",
  spaces: [
    { id: "living", type: "living", label: "Sala", privacy: "public", targetArea: 16, requiresExteriorOpening: true },
    { id: "kitchen", type: "kitchen", label: "Cocina", privacy: "service", targetArea: 8, wetArea: true, requiresExteriorOpening: true },
    { id: "bath", type: "bathroom", label: "Baño", privacy: "private", targetArea: 4, wetArea: true },
    { id: "bed1", type: "bedroom", label: "Dormitorio 1", privacy: "private", targetArea: 10, requiresExteriorOpening: true },
    { id: "bed2", type: "bedroom", label: "Dormitorio 2", privacy: "private", targetArea: 10, requiresExteriorOpening: true },
  ],
  relations: [
    { id: "bad_direct", a: "bath", b: "kitchen", kind: "direct_access", weight: 1 },
  ],
  preferences: [],
};

const site: SiteConstraints = {
  width: 12,
  length: 20,
  setbackFront: 2,
  setbackBack: 2,
  setbackLeft: 1,
  setbackRight: 1,
  entrySide: "front",
  northAngleDeg: 0,
  hemisphere: "south",
  levels: 1,
};

test("v3 removes bathroom-kitchen direct access and records sanitary pair rules", () => {
  const enriched = applyArchitecturalGrammarV3(baseProgram, site);

  assert.equal(
    enriched.relations.some(
      (relation) => relation.kind === "direct_access" &&
        new Set([relation.a, relation.b]).has("bath") &&
        new Set([relation.a, relation.b]).has("kitchen")
    ),
    false
  );
  assert.equal(
    enriched.pairRules?.some(
      (rule) => rule.kind === "no_direct_access" &&
        [rule.a, rule.b].includes("bath") &&
        [rule.a, rule.b].includes("kitchen")
    ),
    true
  );
  assert.equal(
    enriched.pairRules?.some(
      (rule) => rule.kind === "avoid_adjacency" &&
        [rule.a, rule.b].includes("bath") &&
        [rule.a, rule.b].includes("kitchen")
    ),
    true
  );
});

test("entry depth changes with selected entry side", () => {
  const point = { x: 2, y: 4 };
  const fromFront = normalizedEntryDepth(point, { ...site, entrySide: "front" });
  const fromRight = normalizedEntryDepth(point, { ...site, entrySide: "right" });

  assert.ok(fromFront < 0.2);
  assert.ok(fromRight > 0.8);
});

test("southern hemisphere solar heuristic favors north/east over west for bedrooms", () => {
  const north = solarExposurePreference("bedroom", 0, site);
  const east = solarExposurePreference("bedroom", 90, site);
  const west = solarExposurePreference("bedroom", 270, site);

  assert.ok(north > west);
  assert.ok(east > west);
});

test("two-level grammar creates an aligned stair stack in seeded geometry", () => {
  const multiSite: SiteConstraints = { ...site, levels: 2 };
  const enriched = applyArchitecturalGrammarV3(baseProgram, multiSite);
  const stairs = enriched.spaces.filter((space) => space.type === "stair");

  assert.equal(stairs.length, 2);
  assert.deepEqual(stairs.map((space) => space.floor).sort(), [0, 1]);
  assert.ok(stairs.every((space) => space.verticalStackKey === "main_stair"));

  const candidate = generateSeededCandidate(enriched, multiSite, 1234, {
    candidateCount: 1,
    gridSize: 0.1,
    scanStep: 0.5,
    dimensionJitter: 0.1,
  });
  const generatedStairs = candidate.spaces.filter((space) => space.type === "stair");
  assert.equal(generatedStairs.length, 2);
  assert.equal(generatedStairs[0].x, generatedStairs[1].x);
  assert.equal(generatedStairs[0].y, generatedStairs[1].y);
});
