import type { HouseholdDesignProfile } from "./designKnowledge";
import {
  HOUSEHOLD_QUESTIONS,
  HouseholdQuestionnaireAnswers,
  buildHouseholdDesignProfile,
  getFamilyNarrative,
} from "./householdQuestionnaire";

export type ProfileMetricKey =
  | "privacy"
  | "socialLiving"
  | "adaptability"
  | "accessibility"
  | "cooking"
  | "storage"
  | "costSensitivity"
  | "remoteWork"
  | "visitorExposure";

export type MetricSource = "questionnaire" | "semantic_ai" | "fused";

export interface MetricEvidence {
  source: MetricSource;
  value: number;
  confidence: number;
  evidence: string[];
}

export interface EncodedMetric {
  value: number;
  confidence: number;
  source: MetricSource;
  evidence: MetricEvidence[];
}

export type EncodedProfileMetrics = Record<ProfileMetricKey, EncodedMetric>;

export interface SemanticProfileSignal {
  metrics: Partial<Record<ProfileMetricKey, number>>;
  confidence: number;
  evidence?: Partial<Record<ProfileMetricKey, string[]>>;
}

export interface HybridHouseholdProfile {
  categorical: HouseholdDesignProfile;
  metrics: EncodedProfileMetrics;
  structuredConfidence: number;
  overallConfidence: number;
  narrative: string;
  semanticAnalysisRecommended: boolean;
  semanticReason?: "no_narrative" | "narrative_available" | "low_structured_confidence";
  tokenPolicy: {
    mode: "deterministic_only" | "semantic_optional";
    maxNarrativeChars: number;
    semanticWeight: number;
  };
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const ordinal = (value: unknown, fallback = 0.5): number => {
  switch (String(value ?? "")) {
    case "low": return 0.25;
    case "medium": return 0.6;
    case "high": return 0.9;
    case "standard": return 0.35;
    case "enhanced": return 0.7;
    case "universal": return 1;
    default: return fallback;
  }
};

function bool(value: unknown): number {
  if (value === true || value === "true" || value === "yes") return 1;
  return 0;
}

function normalizedCount(value: unknown, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return clamp01(parsed / max);
}

function evidence(value: number, label: string, confidence = 0.95): EncodedMetric {
  return {
    value: clamp01(value),
    confidence: clamp01(confidence),
    source: "questionnaire",
    evidence: [{
      source: "questionnaire",
      value: clamp01(value),
      confidence: clamp01(confidence),
      evidence: [label],
    }],
  };
}

function structuredAnswerConfidence(answers: HouseholdQuestionnaireAnswers): number {
  const required = HOUSEHOLD_QUESTIONS.filter((question) => question.required);
  if (required.length === 0) return 1;

  let answered = 0;
  for (const question of required) {
    const value = answers[question.id];
    const valid = value !== undefined && value !== null && value !== "";
    if (valid) answered++;
  }

  return Number((answered / required.length).toFixed(4));
}

export function encodeQuestionnaireDeterministically(
  answers: HouseholdQuestionnaireAnswers
): HybridHouseholdProfile {
  const categorical = buildHouseholdDesignProfile(answers);
  const structuredConfidence = structuredAnswerConfidence(answers);
  const narrative = getFamilyNarrative(answers);

  const privacyBase = ordinal(answers.privacyPriority);
  const visitors = bool(answers.frequentVisitors);
  const multigenerational = answers.householdType === "multigenerational" ? 1 : 0;
  const shared = answers.householdType === "shared" ? 1 : 0;
  const privacy = clamp01(
    privacyBase * 0.62 + visitors * 0.16 + multigenerational * 0.14 + shared * 0.08
  );

  const socialLiving = clamp01(
    ordinal(answers.socialLivingPriority) * 0.65 +
    ordinal(answers.cookingIntensity) * 0.2 +
    visitors * 0.15
  );

  const adaptability = clamp01(
    bool(answers.futureGrowthExpected) * 0.42 +
    bool(answers.incrementalConstruction) * 0.38 +
    normalizedCount(answers.remoteWorkSpaces, 3) * 0.2
  );

  const accessibility = ordinal(answers.accessibilityPriority, 0.35);
  const cooking = ordinal(answers.cookingIntensity);
  const storage = ordinal(answers.storagePriority);
  const costSensitivity = ordinal(answers.budgetSensitivity);
  const remoteWork = normalizedCount(answers.remoteWorkSpaces, 3);
  const visitorExposure = visitors;

  const metrics: EncodedProfileMetrics = {
    privacy: evidence(privacy, "Derivado de privacidad declarada, visitas y composición del hogar."),
    socialLiving: evidence(socialLiving, "Derivado de convivencia social, cocina y frecuencia de visitas."),
    adaptability: evidence(adaptability, "Derivado de crecimiento futuro, construcción por etapas y trabajo/estudio en casa."),
    accessibility: evidence(accessibility, "Derivado de la prioridad de accesibilidad seleccionada."),
    cooking: evidence(cooking, "Derivado de la intensidad de uso de la cocina."),
    storage: evidence(storage, "Derivado de la prioridad de almacenamiento."),
    costSensitivity: evidence(costSensitivity, "Derivado de la sensibilidad al costo inicial."),
    remoteWork: evidence(remoteWork, "Derivado del número de personas que trabajan o estudian en casa."),
    visitorExposure: evidence(visitorExposure, "Derivado de la frecuencia declarada de visitas."),
  };

  const semanticAnalysisRecommended =
    structuredConfidence < 0.85 || narrative.length >= 24;

  return {
    categorical,
    metrics,
    structuredConfidence,
    overallConfidence: structuredConfidence,
    narrative,
    semanticAnalysisRecommended,
    semanticReason: structuredConfidence < 0.85
      ? "low_structured_confidence"
      : narrative.length >= 24
        ? "narrative_available"
        : "no_narrative",
    tokenPolicy: {
      mode: semanticAnalysisRecommended ? "semantic_optional" : "deterministic_only",
      maxNarrativeChars: 800,
      semanticWeight: 0.3,
    },
  };
}

export function mergeSemanticProfile(
  base: HybridHouseholdProfile,
  semantic: SemanticProfileSignal,
  semanticWeight = base.tokenPolicy.semanticWeight
): HybridHouseholdProfile {
  const safeSemanticWeight = clamp01(semanticWeight);
  const structuredWeight = 1 - safeSemanticWeight;
  const metrics = { ...base.metrics } as EncodedProfileMetrics;

  for (const key of Object.keys(semantic.metrics) as ProfileMetricKey[]) {
    const semanticValue = semantic.metrics[key];
    if (semanticValue === undefined) continue;

    const current = base.metrics[key];
    const value = clamp01(current.value * structuredWeight + clamp01(semanticValue) * safeSemanticWeight);
    const confidence = clamp01(
      current.confidence * structuredWeight + clamp01(semantic.confidence) * safeSemanticWeight
    );

    metrics[key] = {
      value,
      confidence,
      source: "fused",
      evidence: [
        ...current.evidence,
        {
          source: "semantic_ai",
          value: clamp01(semanticValue),
          confidence: clamp01(semantic.confidence),
          evidence: semantic.evidence?.[key] ?? ["Interpretación semántica opcional del texto libre."],
        },
      ],
    };
  }

  const metricConfidences = Object.values(metrics).map((metric) => metric.confidence);
  const overallConfidence = metricConfidences.length
    ? metricConfidences.reduce((sum, value) => sum + value, 0) / metricConfidences.length
    : base.overallConfidence;

  return {
    ...base,
    metrics,
    overallConfidence: Number(overallConfidence.toFixed(4)),
    semanticAnalysisRecommended: false,
    tokenPolicy: {
      ...base.tokenPolicy,
      mode: "deterministic_only",
    },
  };
}
