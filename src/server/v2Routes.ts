import type { Express } from "express";
import type { GoogleGenAI } from "@google/genai";
import { interpretArchitecturalProgram } from "../ai/v2ProgramInterpreter";
import { interpretHouseholdNarrative } from "../ai/semanticHouseholdInterpreter";
import { GeminiTemporarilyUnavailableError } from "../ai/modelResilience";
import { enrichFunctionalProgram } from "../domain/v2/functionalProgram";
import { applyArchitecturalGrammarV3 } from "../domain/v2/architecturalGrammarV3";
import {
  encodeQuestionnaireDeterministically,
  mergeSemanticProfile,
  type HybridHouseholdProfile,
} from "../domain/v2/hybridQualitativeEncoder";
import type { HouseholdQuestionnaireAnswers } from "../domain/v2/householdQuestionnaire";
import {
  createNeutralDesignProtocols,
  deriveDesignProtocols,
} from "../domain/v2/designProtocols";
import { generateStrategicAlternatives } from "../domain/v2/strategicCandidateGenerator";
import type {
  ArchitecturalProgram,
  EntrySide,
  Hemisphere,
  LayoutCandidate,
  LayoutSpace,
  SiteConstraints,
  SpaceType,
  TopologyOpening,
  WallSide,
} from "../domain/v2/types";
import type { Room, RoomOpening, RoomType } from "../types";

const COLORS: Record<RoomType, string> = {
  living: "#FEF3C7",
  bedroom: "#DBEAFE",
  bathroom: "#E0F2FE",
  kitchen: "#FEE2E2",
  dining: "#FEF3C7",
  corridor: "#F3F4F6",
  garage: "#E5E7EB",
  laundry: "#ECEFFC",
  other: "#F5F5F5",
};

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function legacyRoomType(type: SpaceType): RoomType {
  switch (type) {
    case "living":
    case "bedroom":
    case "bathroom":
    case "kitchen":
    case "dining":
    case "corridor":
    case "garage":
    case "laundry":
      return type;
    default:
      return "other";
  }
}

function resolveEntrySide(value: unknown): EntrySide {
  const candidate = String(value ?? "front") as EntrySide;
  return ["front", "back", "left", "right"].includes(candidate) ? candidate : "front";
}

function resolveHemisphere(value: unknown): Hemisphere {
  return String(value ?? "south") === "north" ? "north" : "south";
}

function resolveSite(body: Record<string, unknown>): SiteConstraints {
  const width = clamp(body.terrainWidth, 3, 200, 12);
  const length = clamp(body.terrainLength, 3, 300, 20);
  const rawNorth = Number(body.northAngleDeg ?? 0);
  const northAngleDeg = Number.isFinite(rawNorth)
    ? ((rawNorth % 360) + 360) % 360
    : 0;

  return {
    width,
    length,
    setbackFront: clamp(body.setbackFront, 0, length / 2, 0),
    setbackBack: clamp(body.setbackBack, 0, length / 2, 0),
    setbackLeft: clamp(body.setbackLeft, 0, width / 2, 0),
    setbackRight: clamp(body.setbackRight, 0, width / 2, 0),
    entrySide: resolveEntrySide(body.entrySide),
    northAngleDeg,
    hemisphere: resolveHemisphere(body.hemisphere),
    levels: Math.floor(clamp(body.levels, 1, 4, 1)),
    source: "user-project-input",
  };
}

function boundarySideForSpace(
  candidate: LayoutCandidate,
  opening: TopologyOpening,
  layoutSpaceId: string
): WallSide | null {
  const shared = candidate.topology.sharedBoundaries.find(
    (boundary) => boundary.id === opening.hostBoundaryId
  );
  if (shared) {
    if (shared.spaceAId === layoutSpaceId) return shared.sideOfA;
    if (shared.spaceBId === layoutSpaceId) return shared.sideOfB;
  }

  const exterior = candidate.topology.exteriorBoundaries.find(
    (boundary) => boundary.id === opening.hostBoundaryId && boundary.spaceId === layoutSpaceId
  );
  return exterior?.side ?? null;
}

function openingOffset(space: LayoutSpace, side: WallSide, center: number): number {
  const minX = space.x - space.w / 2;
  const minY = space.y - space.h / 2;
  const raw = side === "top" || side === "bottom"
    ? (center - minX) / space.w
    : (center - minY) / space.h;
  return Number(Math.max(0.05, Math.min(0.95, raw)).toFixed(4));
}

function connectionsForSpace(
  program: ArchitecturalProgram,
  programSpaceId: string
): string[] {
  const result = new Set<string>();
  for (const relation of program.relations) {
    if (relation.kind === "must_not_touch") continue;
    if (relation.a === programSpaceId) result.add(relation.b);
    if (relation.b === programSpaceId) result.add(relation.a);
  }
  return [...result];
}

function legacyOpeningsForSpace(
  candidate: LayoutCandidate,
  space: LayoutSpace
): RoomOpening[] {
  const layoutToProgram = new Map(
    candidate.spaces.map((item) => [item.id, item.programSpaceId])
  );

  return candidate.topology.openings.flatMap((opening) => {
    const touchesSpace = opening.spaceAId === space.id || opening.spaceBId === space.id;
    if (!touchesSpace) return [];

    const side = boundarySideForSpace(candidate, opening, space.id);
    if (!side) return [];

    const otherLayoutId = opening.spaceAId === space.id
      ? opening.spaceBId
      : opening.spaceAId;

    return [{
      id: `${opening.id}_${space.programSpaceId}`,
      type: opening.type,
      side,
      offset: openingOffset(space, side, opening.center),
      width: opening.width,
      targetRoomId: opening.type === "door" && otherLayoutId
        ? layoutToProgram.get(otherLayoutId)
        : undefined,
    } satisfies RoomOpening];
  });
}

function candidateToLegacyRooms(
  candidate: LayoutCandidate,
  program: ArchitecturalProgram
): Room[] {
  return candidate.spaces.map((space) => {
    const type = legacyRoomType(space.type);
    return {
      id: space.programSpaceId,
      name: space.label,
      type,
      x: space.x,
      y: space.y,
      w: space.w,
      h: space.h,
      targetW: space.w,
      targetH: space.h,
      floor: space.floor,
      color: COLORS[type],
      connections: connectionsForSpace(program, space.programSpaceId),
      openings: legacyOpeningsForSpace(candidate, space),
      furniture: [],
    };
  });
}

function serializeCandidate(candidate: LayoutCandidate, program: ArchitecturalProgram) {
  return {
    id: candidate.id,
    seed: candidate.seed,
    score: candidate.score,
    rooms: candidateToLegacyRooms(candidate, program),
    topology: {
      sharedBoundaryCount: candidate.topology.sharedBoundaries.length,
      exteriorBoundaryCount: candidate.topology.exteriorBoundaries.length,
      openingCount: candidate.topology.openings.length,
    },
  };
}

async function resolveHouseholdProfile(
  ai: GoogleGenAI,
  body: Record<string, unknown>
): Promise<HybridHouseholdProfile | null> {
  if (!body.householdAnswers || typeof body.householdAnswers !== "object") return null;

  const answers = body.householdAnswers as HouseholdQuestionnaireAnswers;
  let profile = encodeQuestionnaireDeterministically(answers);

  const semanticMode = body.semanticProfileMode === "auto" ? "auto" : "off";
  if (
    semanticMode === "auto" &&
    profile.semanticAnalysisRecommended &&
    profile.narrative.length >= 24
  ) {
    const semantic = await interpretHouseholdNarrative(ai, profile.narrative);
    if (semantic) profile = mergeSemanticProfile(profile, semantic);
  }

  return profile;
}

function compactProfileSummary(profile: HybridHouseholdProfile | null) {
  if (!profile) return null;
  return {
    structuredConfidence: profile.structuredConfidence,
    overallConfidence: profile.overallConfidence,
    semanticAnalysisRecommended: profile.semanticAnalysisRecommended,
    tokenPolicy: profile.tokenPolicy,
    metrics: Object.fromEntries(
      Object.entries(profile.metrics).map(([key, metric]) => [
        key,
        {
          value: metric.value,
          confidence: metric.confidence,
          source: metric.source,
        },
      ])
    ),
  };
}

export function registerV2Routes(app: Express, getAI: () => GoogleGenAI): void {
  app.post("/api/v2/generate-candidates", async (req, res) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const prompt = String(body.prompt ?? "").trim();
      if (!prompt) {
        return res.status(400).json({ error: "El prompt es requerido para generar alternativas v2." });
      }

      const site = resolveSite(body);
      const metadata = body.metadata && typeof body.metadata === "object"
        ? body.metadata as Record<string, unknown>
        : undefined;

      const ai = getAI();
      const householdProfile = await resolveHouseholdProfile(ai, body);
      const protocols = householdProfile
        ? deriveDesignProtocols(householdProfile)
        : createNeutralDesignProtocols();

      const interpretedProgram = await interpretArchitecturalProgram(ai, { prompt, metadata });
      const grammarProgram = applyArchitecturalGrammarV3(interpretedProgram, site);
      const functionalProgram = enrichFunctionalProgram(grammarProgram);
      const baseProgram = applyArchitecturalGrammarV3(functionalProgram, site);

      const candidateBudget = Math.floor(clamp(body.candidateCount, 9, 60, 36));
      const baseSeed = Number.isFinite(Number(body.seed))
        ? Number(body.seed) >>> 0
        : hashString(`${prompt}|${JSON.stringify(site)}|${JSON.stringify(metadata ?? {})}`);

      const strategic = generateStrategicAlternatives(
        baseProgram,
        site,
        protocols,
        baseSeed,
        candidateBudget,
        3
      );

      const candidates = strategic.alternatives.map((alternative) => ({
        ...serializeCandidate(alternative.candidate, alternative.program),
        strategy: {
          id: alternative.strategy.id,
          title: alternative.strategy.title,
          description: alternative.strategy.description,
          suitability: alternative.strategy.suitability,
          reasons: alternative.strategy.reasons,
          generated: alternative.generatedCount,
          valid: alternative.validCount,
          repairPassUsed: alternative.repairPassUsed,
        },
      }));

      return res.json({
        engine: "v3-architectural-grammar",
        generationSource: householdProfile
          ? "household-profile+design-protocols+typology-strategies+architectural-grammar-v3+gemini-program+deterministic-layout"
          : "neutral-protocols+typology-strategies+architectural-grammar-v3+gemini-program+deterministic-layout",
        seed: baseSeed,
        site,
        householdProfile: compactProfileSummary(householdProfile),
        designProtocols: protocols,
        program: baseProgram,
        stats: {
          generated: strategic.generatedCount,
          valid: strategic.validCount,
          returned: candidates.length,
          strategies: strategic.alternatives.map((alternative) => alternative.strategy.id),
          levels: site.levels,
          repairedStrategies: strategic.repairedStrategies,
        },
        candidates,
      });
    } catch (error: any) {
      console.error("V2 generation error:", error);

      if (error instanceof GeminiTemporarilyUnavailableError) {
        res.setHeader("Retry-After", "5");
        return res.status(503).json({
          error: error.message,
          retryable: true,
        });
      }

      return res.status(500).json({
        error: `No se pudo generar alternativas con Engine v2: ${error?.message ?? "Error desconocido"}`,
        retryable: false,
      });
    }
  });
}
