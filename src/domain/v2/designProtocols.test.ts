import test from "node:test";
import assert from "node:assert/strict";
import { encodeQuestionnaireDeterministically } from "./hybridQualitativeEncoder";
import { deriveDesignProtocols } from "./designProtocols";

function baseAnswers() {
  return {
    householdSize: 4,
    householdType: "family",
    privacyPriority: "medium",
    socialLivingPriority: "medium",
    frequentVisitors: false,
    cookingIntensity: "medium",
    remoteWorkSpaces: 0,
    futureGrowthExpected: false,
    incrementalConstruction: false,
    accessibilityPriority: "standard",
    storagePriority: "medium",
    budgetSensitivity: "medium",
  };
}

test("high privacy and visitors increase privacy protocols", () => {
  const profile = encodeQuestionnaireDeterministically({
    ...baseAnswers(),
    privacyPriority: "high",
    frequentVisitors: true,
    householdType: "multigenerational",
  });
  const protocols = deriveDesignProtocols(profile);

  assert.ok(protocols.priorities.privacy_gradient > 0.8);
  assert.ok(protocols.priorities.visitor_control > 0.75);
});

test("growth and staged construction increase future-growth protocol", () => {
  const profile = encodeQuestionnaireDeterministically({
    ...baseAnswers(),
    futureGrowthExpected: true,
    incrementalConstruction: true,
    remoteWorkSpaces: 2,
  });
  const protocols = deriveDesignProtocols(profile);

  assert.ok(protocols.priorities.adaptability > 0.75);
  assert.ok(protocols.priorities.future_growth > 0.8);
});
