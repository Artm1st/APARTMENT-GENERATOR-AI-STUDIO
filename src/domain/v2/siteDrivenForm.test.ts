import test from "node:test";
import assert from "node:assert/strict";
import type { LayoutSpace, SiteConstraints } from "./types";
import {
  entryFacadePlacementCost,
  solarPlacementCost,
} from "./siteDrivenForm";

const site: SiteConstraints = {
  width: 10,
  length: 20,
  setbackFront: 0,
  setbackBack: 0,
  setbackLeft: 0,
  setbackRight: 0,
  entrySide: "front",
  northAngleDeg: 30,
  hemisphere: "south",
  levels: 1,
  source: "test",
};

function makeSpace(partial: Partial<LayoutSpace>): LayoutSpace {
  return {
    id: "layout",
    programSpaceId: "program",
    type: "living",
    label: "Sala",
    x: 5,
    y: 5,
    w: 3,
    h: 3,
    floor: 0,
    ...partial,
  };
}

test("front entry strongly favors a corridor touching the front facade", () => {
  const front = makeSpace({ type: "corridor", y: 1.5, h: 3 });
  const rear = makeSpace({ type: "corridor", y: 17, h: 3 });

  assert.ok(
    entryFacadePlacementCost(front, site) < entryFacadePlacementCost(rear, site),
    "front corridor should have lower entry cost"
  );
});

test("north at 30 degrees influences living placement toward the better solar facade", () => {
  const nearNorth = makeSpace({ type: "living", y: 18.5, h: 3 });
  const nearSouth = makeSpace({ type: "living", y: 1.5, h: 3 });

  assert.ok(
    solarPlacementCost(nearNorth, site) < solarPlacementCost(nearSouth, site),
    "living room near the north-oriented edge should have lower solar placement cost"
  );
});

test("service rooms do not receive a solar-placement bias", () => {
  const bathroom = makeSpace({ type: "bathroom", x: 2, y: 2, w: 2, h: 2 });
  assert.equal(solarPlacementCost(bathroom, site), 0);
});
