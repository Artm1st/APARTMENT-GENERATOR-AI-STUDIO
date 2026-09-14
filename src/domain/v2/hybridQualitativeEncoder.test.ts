import test from "node:test";
import assert from "node:assert/strict";
import {
  encodeQuestionnaireDeterministically,
  mergeSemanticProfile,
} from "./hybridQualitativeEncoder";

const completeAnswers = {
  householdSize: 5,
  householdType: "multigenerational",
  privacyPriority: "high",
  socialLivingPriority: "medium",
  frequentVisitors: true,
  cookingIntensity: "high",
  remoteWorkSpaces: 1,
  futureGrowthExpected: true,
  incrementalConstruction: true,
  accessibilityPriority: "enhanced",
  storagePriority: "high",
  budgetSensitivity: "medium",
};

test("complete structured answers can stay deterministic with zero AI calls", () => {
  const profile = encodeQuestionnaireDeterministically(completeAnswers);

  assert.equal(profile.structuredConfidence, 1);
  assert.equal(profile.semanticAnalysisRecommended, false);
  assert.equal(profile.tokenPolicy.mode, "deterministic_only");
  assert.ok(profile.metrics.privacy.value > 0.8);
  assert.ok(profile.metrics.adaptability.value > 0.7);
});

test("optional family narrative recommends one lightweight semantic pass", () => {
  const profile = encodeQuestionnaireDeterministically({
    ...completeAnswers,
    familyNarrative: "Mi madre vive con nosotros y necesita independencia, pero queremos mantener cercanía familiar.",
  });

  assert.equal(profile.semanticAnalysisRecommended, true);
  assert.equal(profile.semanticReason, "narrative_available");
  assert.equal(profile.tokenPolicy.mode, "semantic_optional");
});

test("semantic interpretation enriches rather than replaces explicit answers", () => {
  const base = encodeQuestionnaireDeterministically({
    ...completeAnswers,
    familyNarrative: "Necesitamos poder supervisar a los niños desde las áreas comunes.",
  });

  const structuredPrivacy = base.metrics.privacy.value;
  const fused = mergeSemanticProfile(base, {
    metrics: {
      privacy: 0.2,
      socialLiving: 0.95,
    },
    confidence: 0.9,
  });

  assert.ok(fused.metrics.privacy.value > 0.2);
  assert.ok(fused.metrics.privacy.value < structuredPrivacy);
  assert.equal(fused.metrics.privacy.source, "fused");
  assert.equal(fused.metrics.privacy.evidence.length, 2);
  assert.equal(fused.semanticAnalysisRecommended, false);
});
