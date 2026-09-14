import test from "node:test";
import assert from "node:assert/strict";
import { spatialGrammarPlacementCost } from "./spatialGrammarCost";
import type { LayoutSpace, SiteConstraints } from "./types";

const site: SiteConstraints = {
  width: 12,
  length: 20,
  setbackFront: 0,
  setbackBack: 0,
  setbackLeft: 0,
  setbackRight: 0,
  entrySide: "front",
  levels: 1,
};

function room(type: LayoutSpace["type"], x: number, y: number): LayoutSpace {
  return {
    id: `${type}_${x}_${y}`,
    programSpaceId: `${type}_${x}_${y}`,
    type,
    label: type,
    x,
    y,
    w: 3,
    h: 3,
    floor: 0,
  };
}

test("privacy gradient prefers bedrooms deeper than social rooms", () => {
  const frontBedroom = spatialGrammarPlacementCost(room("bedroom", 6, 4), site, { id: "privacy_gradient" });
  const deepBedroom = spatialGrammarPlacementCost(room("bedroom", 6, 16), site, { id: "privacy_gradient" });
  const frontLiving = spatialGrammarPlacementCost(room("living", 6, 4), site, { id: "privacy_gradient" });
  const deepLiving = spatialGrammarPlacementCost(room("living", 6, 16), site, { id: "privacy_gradient" });

  assert.ok(deepBedroom < frontBedroom);
  assert.ok(frontLiving < deepLiving);
});

test("social core prefers living near the geometric center", () => {
  const center = spatialGrammarPlacementCost(room("living", 6, 10), site, { id: "social_core" });
  const corner = spatialGrammarPlacementCost(room("living", 2, 3), site, { id: "social_core" });
  assert.ok(center < corner);
});

test("service band chooses opposite lateral bands by variant", () => {
  const leftKitchen = room("kitchen", 2, 10);
  const rightKitchen = room("kitchen", 10, 10);

  const leftVariantLeft = spatialGrammarPlacementCost(leftKitchen, site, { id: "service_band", variant: 0 });
  const leftVariantRight = spatialGrammarPlacementCost(rightKitchen, site, { id: "service_band", variant: 0 });
  const rightVariantLeft = spatialGrammarPlacementCost(leftKitchen, site, { id: "service_band", variant: 1 });
  const rightVariantRight = spatialGrammarPlacementCost(rightKitchen, site, { id: "service_band", variant: 1 });

  assert.ok(leftVariantLeft < leftVariantRight);
  assert.ok(rightVariantRight < rightVariantLeft);
});

test("evolutionary spine prefers circulation on the central axis", () => {
  const centered = spatialGrammarPlacementCost(room("corridor", 6, 10), site, { id: "evolutionary_spine" });
  const lateral = spatialGrammarPlacementCost(room("corridor", 2, 10), site, { id: "evolutionary_spine" });
  assert.ok(centered < lateral);
});
