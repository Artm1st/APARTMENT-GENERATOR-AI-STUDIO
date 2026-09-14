import test from "node:test";
import assert from "node:assert/strict";
import { encodeQuestionnaireDeterministically } from "./hybridQualitativeEncoder";
import { deriveDesignProtocols } from "./designProtocols";
import {
  applyTypologyStrategy,
  selectTypologyStrategies,
} from "./typologyStrategies";
import type { ArchitecturalProgram, SiteConstraints } from "./types";

const site: SiteConstraints = {
  width: 12,
  length: 20,
  setbackFront: 2,
  setbackBack: 2,
  setbackLeft: 1,
  setbackRight: 1,
};

const program: ArchitecturalProgram = {
  projectType: "single_family_house",
  spaces: [
    { id: "living", type: "living", label: "Sala", privacy: "public" },
    { id: "dining", type: "dining", label: "Comedor", privacy: "public" },
    { id: "kitchen", type: "kitchen", label: "Cocina", privacy: "service", wetArea: true },
    { id: "corridor", type: "corridor", label: "Circulación", privacy: "semi_private" },
    { id: "bed1", type: "bedroom", label: "Dormitorio 1", privacy: "private" },
    { id: "bath1", type: "bathroom", label: "Baño", privacy: "semi_private", wetArea: true },
    { id: "laundry", type: "laundry", label: "Lavandería", privacy: "service", wetArea: true },
  ],
  relations: [],
  preferences: [],
};

function fullAnswers(overrides: Record<string, unknown> = {}) {
  return {
    householdSize: 5,
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
    ...overrides,
  };
}

test("privacy-heavy household ranks privacy-gradient strategy highly", () => {
  const profile = encodeQuestionnaireDeterministically(fullAnswers({
    privacyPriority: "high",
    frequentVisitors: true,
    householdType: "multigenerational",
    socialLivingPriority: "low",
  }));
  const protocols = deriveDesignProtocols(profile);
  const strategies = selectTypologyStrategies(protocols, site, 3);

  assert.equal(strategies[0].id, "privacy_gradient");
});

test("future-growth household includes evolutionary-spine strategy", () => {
  const profile = encodeQuestionnaireDeterministically(fullAnswers({
    futureGrowthExpected: true,
    incrementalConstruction: true,
    remoteWorkSpaces: 2,
    budgetSensitivity: "low",
  }));
  const protocols = deriveDesignProtocols(profile);
  const strategies = selectTypologyStrategies(protocols, site, 3);

  assert.ok(strategies.some((strategy) => strategy.id === "evolutionary_spine"));
});

test("social-core and service-band create different spatial relations", () => {
  const profile = encodeQuestionnaireDeterministically(fullAnswers());
  const protocols = deriveDesignProtocols(profile);
  const selections = selectTypologyStrategies(protocols, site, 5);
  const social = selections.find((strategy) => strategy.id === "social_core");
  const service = selections.find((strategy) => strategy.id === "service_band");
  assert.ok(social);
  assert.ok(service);

  const socialProgram = applyTypologyStrategy(program, social!, protocols);
  const serviceProgram = applyTypologyStrategy(program, service!, protocols);

  assert.ok(socialProgram.relations.some((relation) =>
    relation.kind === "direct_access" && [relation.a, relation.b].includes("living") && [relation.a, relation.b].includes("dining")
  ));
  assert.ok(serviceProgram.relations.some((relation) =>
    ["near", "prefer_touch"].includes(relation.kind) && [relation.a, relation.b].includes("kitchen") && [relation.a, relation.b].includes("laundry")
  ));
});
