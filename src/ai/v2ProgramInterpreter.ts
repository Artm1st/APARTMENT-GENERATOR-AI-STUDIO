import { GoogleGenAI, Type } from "@google/genai";
import {
  ArchitecturalProgram,
  DesignPreference,
  ProgramSpace,
  SpatialRelation,
} from "../domain/v2/types";
import { validateProgramGraph } from "../domain/v2/graph";
import { runWithGeminiFallback } from "./modelResilience";

export interface ProgramInterpretationInput {
  prompt: string;
  metadata?: Record<string, unknown>;
}

const programResponseSchema = {
  type: Type.OBJECT,
  properties: {
    projectType: {
      type: Type.STRING,
      enum: ["single_family_house", "apartment_unit"],
    },
    spaces: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          type: {
            type: Type.STRING,
            enum: [
              "living",
              "bedroom",
              "bathroom",
              "kitchen",
              "dining",
              "corridor",
              "garage",
              "laundry",
              "terrace",
              "patio",
              "studio",
              "other",
            ],
          },
          label: { type: Type.STRING },
          targetArea: { type: Type.NUMBER },
          minArea: { type: Type.NUMBER },
          minWidth: { type: Type.NUMBER },
          privacy: {
            type: Type.STRING,
            enum: ["public", "semi_private", "private", "service"],
          },
          requiresExteriorOpening: { type: Type.BOOLEAN },
          wetArea: { type: Type.BOOLEAN },
          floor: { type: Type.NUMBER },
        },
        required: [
          "id",
          "type",
          "label",
          "targetArea",
          "privacy",
          "requiresExteriorOpening",
          "wetArea",
          "floor",
        ],
      },
    },
    relations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          a: { type: Type.STRING },
          b: { type: Type.STRING },
          kind: {
            type: Type.STRING,
            enum: ["must_touch", "prefer_touch", "must_not_touch", "direct_access", "near"],
          },
          weight: { type: Type.NUMBER },
        },
        required: ["id", "a", "b", "kind", "weight"],
      },
    },
    preferences: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          key: {
            type: Type.STRING,
            enum: [
              "compactness",
              "daylight",
              "cross_ventilation",
              "privacy",
              "short_circulation",
              "wet_core_grouping",
              "regular_structure",
            ],
          },
          weight: { type: Type.NUMBER },
        },
        required: ["id", "key", "weight"],
      },
    },
  },
  required: ["projectType", "spaces", "relations", "preferences"],
};

const systemInstruction = `
Eres el intérprete de programa arquitectónico de un motor generativo.
NO dibujas el plano y NO defines coordenadas, muros, puertas o ventanas concretas.
Tu trabajo es transformar la solicitud del usuario en un programa espacial estructurado.

REGLAS IMPORTANTES:
1. No afirmes cumplimiento del RNE, Plan BIM Chile ni de ninguna norma. La normativa la valida otro motor determinista.
2. targetArea es una META DE DISEÑO razonable, no un mínimo legal.
3. minArea y minWidth solo deben usarse si el usuario los especificó explícitamente. No inventes mínimos normativos.
4. Usa IDs únicos, estables, en minúsculas y sin espacios.
5. Las relaciones deben usar únicamente IDs existentes.
6. direct_access significa que debe existir una puerta directa entre dos espacios.
7. must_touch significa que deben compartir límite físico, sin exigir necesariamente una puerta.
8. prefer_touch es una preferencia de adyacencia.
9. must_not_touch indica incompatibilidad de adyacencia.
10. near indica proximidad deseable sin obligación de contacto.
11. weight va de 0 a 1.
12. requiresExteriorOpening indica una necesidad funcional de contacto con exterior/aire libre; no es por sí misma una certificación normativa.
13. wetArea identifica cocina, baño, lavandería u otro espacio con instalaciones húmedas.
14. floor usa 0 para la planta baja, 1 para el segundo nivel, etc.

Devuelve exclusivamente el JSON solicitado por el esquema.
`;

function positiveOrUndefined(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function clamp01(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0.5;
  return Math.max(0, Math.min(1, parsed));
}

function sanitizeProgram(raw: ArchitecturalProgram): ArchitecturalProgram {
  const seenSpaceIds = new Set<string>();

  const spaces: ProgramSpace[] = raw.spaces.map((space) => {
    const id = String(space.id).trim();
    if (!id) throw new Error("Gemini devolvió un espacio sin ID.");
    if (seenSpaceIds.has(id)) throw new Error(`Gemini devolvió un ID de espacio duplicado: ${id}`);
    seenSpaceIds.add(id);

    return {
      ...space,
      id,
      label: String(space.label).trim() || id,
      targetArea: positiveOrUndefined(space.targetArea),
      minArea: positiveOrUndefined(space.minArea),
      minWidth: positiveOrUndefined(space.minWidth),
      requiresExteriorOpening: Boolean(space.requiresExteriorOpening),
      wetArea: Boolean(space.wetArea),
      floor: Math.max(0, Math.floor(Number(space.floor) || 0)),
    };
  });

  const relations: SpatialRelation[] = raw.relations.map((relation) => ({
    ...relation,
    id: String(relation.id).trim(),
    a: String(relation.a).trim(),
    b: String(relation.b).trim(),
    weight: clamp01(relation.weight),
  }));

  const preferences: DesignPreference[] = raw.preferences.map((preference) => ({
    ...preference,
    id: String(preference.id).trim(),
    weight: clamp01(preference.weight),
  }));

  const sanitized: ArchitecturalProgram = {
    projectType: raw.projectType,
    spaces,
    relations,
    preferences,
  };

  const graphIssues = validateProgramGraph(sanitized);
  if (graphIssues.length > 0) {
    throw new Error(
      `Programa arquitectónico inconsistente: ${graphIssues.map((issue) => issue.message).join(" | ")}`
    );
  }

  return sanitized;
}

export async function interpretArchitecturalProgram(
  ai: GoogleGenAI,
  input: ProgramInterpretationInput
): Promise<ArchitecturalProgram> {
  if (!input.prompt?.trim()) {
    throw new Error("El prompt es requerido para interpretar el programa arquitectónico.");
  }

  const metadataText = input.metadata
    ? `\nDatos estructurados adicionales del usuario: ${JSON.stringify(input.metadata)}`
    : "";

  const { value: response, model } = await runWithGeminiFallback((modelName) =>
    ai.models.generateContent({
      model: modelName,
      contents: `Interpreta este encargo arquitectónico:\n${input.prompt}${metadataText}`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: programResponseSchema,
        temperature: 0.1,
      },
    })
  );

  if (!response.text) {
    throw new Error("Gemini no devolvió un programa arquitectónico estructurado.");
  }

  console.info(`[Engine v2] Programa arquitectónico interpretado con ${model}.`);
  const parsed = JSON.parse(response.text) as ArchitecturalProgram;
  return sanitizeProgram(parsed);
}
