import test from "node:test";
import assert from "node:assert/strict";
import { assessFurnitureFit, furnitureFitIssues } from "./habitability";
import type { LayoutSpace } from "./types";

function space(overrides: Partial<LayoutSpace>): LayoutSpace {
  return {
    id: "room",
    programSpaceId: "room",
    type: "bedroom",
    label: "Ambiente",
    x: 0,
    y: 0,
    w: 3,
    h: 3,
    floor: 0,
    ...overrides,
  };
}

test("bedroom furnishing envelope accepts a usable proportion", () => {
  const result = assessFurnitureFit(space({ type: "bedroom", w: 3, h: 3.2 }));
  assert.equal(result.passes, true);
  assert.equal(result.critical, true);
});

test("very narrow bathroom is rejected as a critical habitability issue", () => {
  const bathroom = space({ id: "bath", type: "bathroom", label: "Baño", w: 1.1, h: 3.5 });
  const issues = furnitureFitIssues([bathroom]);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "INSUFFICIENT_FURNITURE_FIT");
  assert.equal(issues[0].severity, "error");
});
