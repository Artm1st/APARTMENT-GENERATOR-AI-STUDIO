import { GoogleGenAI, Type } from "@google/genai";
import { runWithGeminiFallback } from "./modelResilience";
import type {
  ProfileMetricKey,
  SemanticProfileSignal,
} from "../domain/v2/hybridQualitativeEncoder";

const METRIC_KEYS: ProfileMetricKey[] = [
  "privacy",
  "socialLiving",
  "adaptability",
  "accessibility",
  "cooking",
  "storage",
  "costSensitivity",
  "remoteWork",
  "visitorExposure",
];

const semanticSchema = {
  type: Type.OBJECT,
  properties: {
    metrics: {
      type: Type.OBJECT,
      properties: Object.fromEntries(
        METRIC_KEYS.map((key) => [key, { type: Type.NUMBER }])
      ),
    },
    confidence: { type: Type.NUMBER },
    evidence: {
      type: Type.OBJECT,
      properties: Object.fromEntries(
        METRIC_KEYS.map((key) => [
          key,
          {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        ])
      ),
    },
  },
  required: ["metrics", "confidence", "evidence"],
};

const systemInstruction = `
Analiza únicamente una breve descripción sobre cómo vive una familia.
No diseñes una vivienda, no cites normas y no inventes necesidades que el texto no sugiera.

Devuelve solo señales semánticas normalizadas entre 0 y 1 para estas variables cuando exista evidencia suficiente:
privacy, socialLiving, adaptability, accessibility, cooking, storage, costSensitivity, remoteWork, visitorExposure.

Reglas:
- Omite métricas que el texto no permita inferir razonablemente.
- confidence debe estar entre 0 y 1 y reflejar la claridad del texto.
- evidence debe contener frases MUY breves para explicar la inferencia; no copies párrafos completos.
- No conviertas una preferencia implícita en una obligación.
- La salida se fusionará con un cuestionario estructurado que tiene mayor peso que esta interpretación.
`;

function clamp01(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(1, parsed));
}

export function sanitizeNarrativeForSemanticAnalysis(narrative: string): string {
  return narrative.trim().replace(/\s+/g, " ").slice(0, 800);
}

export async function interpretHouseholdNarrative(
  ai: GoogleGenAI,
  narrative: string
): Promise<SemanticProfileSignal | null> {
  const text = sanitizeNarrativeForSemanticAnalysis(narrative);
  if (text.length < 24) return null;

  const { value: response, model } = await runWithGeminiFallback((modelName) =>
    ai.models.generateContent({
      model: modelName,
      contents: text,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: semanticSchema,
        temperature: 0,
      },
    })
  );

  if (!response.text) return null;

  const raw = JSON.parse(response.text) as {
    metrics?: Partial<Record<ProfileMetricKey, number>>;
    confidence?: number;
    evidence?: Partial<Record<ProfileMetricKey, string[]>>;
  };

  const metrics: Partial<Record<ProfileMetricKey, number>> = {};
  for (const key of METRIC_KEYS) {
    const value = raw.metrics?.[key];
    if (value === undefined || !Number.isFinite(Number(value))) continue;
    metrics[key] = clamp01(value);
  }

  console.info(`[Household profile] Narrativa interpretada opcionalmente con ${model}.`);
  return {
    metrics,
    confidence: clamp01(raw.confidence ?? 0.5),
    evidence: raw.evidence ?? {},
  };
}
