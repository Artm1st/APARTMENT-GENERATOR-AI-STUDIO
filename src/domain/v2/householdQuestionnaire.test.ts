import test from "node:test";
import assert from "node:assert/strict";
import { buildHouseholdDesignProfile } from "./householdQuestionnaire";

test("household questionnaire maps non-technical answers into a stable design profile", () => {
  const profile = buildHouseholdDesignProfile({
    householdSize: 5,
    householdType: "multigenerational",
    privacyPriority: "high",
    socialLivingPriority: "medium",
    frequentVisitors: true,
    cookingIntensity: "high",
    remoteWorkSpaces: 2,
    futureGrowthExpected: true,
    incrementalConstruction: true,
    accessibilityPriority: "enhanced",
    storagePriority: "high",
    budgetSensitivity: "high",
  });

  assert.equal(profile.householdSize, 5);
  assert.equal(profile.householdType, "multigenerational");
  assert.equal(profile.privacyPriority, "high");
  assert.equal(profile.frequentVisitors, true);
  assert.equal(profile.remoteWorkSpaces, 2);
  assert.equal(profile.incrementalConstruction, true);
  assert.equal(profile.accessibilityPriority, "enhanced");
  assert.equal(profile.budgetSensitivity, "high");
});

test("invalid questionnaire values fall back to safe defaults", () => {
  const profile = buildHouseholdDesignProfile({
    householdSize: "not-a-number",
    householdType: "unknown",
    privacyPriority: "extreme",
    remoteWorkSpaces: -10,
  });

  assert.equal(profile.householdSize, 4);
  assert.equal(profile.householdType, "family");
  assert.equal(profile.privacyPriority, "medium");
  assert.equal(profile.remoteWorkSpaces, 0);
});
