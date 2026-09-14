import type { LayoutSpace, SiteConstraints } from "./types";
import type { TypologyStrategyId } from "./typologyStrategies";
import { buildableBounds, normalizedEntryDepth } from "./architecturalGrammarV3";

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export interface SpatialGrammarContext {
  id?: TypologyStrategyId;
  variant?: number;
}

function normalizedXY(space: LayoutSpace, site: SiteConstraints) {
  const bounds = buildableBounds(site);
  const width = Math.max(0.001, bounds.maxX - bounds.minX);
  const height = Math.max(0.001, bounds.maxY - bounds.minY);
  return {
    x: clamp01((space.x - bounds.minX) / width),
    y: clamp01((space.y - bounds.minY) / height),
  };
}

const isSocial = (space: LayoutSpace) =>
  space.type === "living" || space.type === "dining" || space.type === "kitchen";

const isPrivate = (space: LayoutSpace) =>
  space.type === "bedroom" || space.type === "studio";

const isService = (space: LayoutSpace) =>
  space.type === "bathroom" || space.type === "kitchen" || space.type === "laundry";

/**
 * Soft geometric grammar. Relations still control mandatory topology; this
 * function changes the shape/position tendency of each typological family.
 */
export function spatialGrammarPlacementCost(
  trial: LayoutSpace,
  site: SiteConstraints,
  grammar: SpatialGrammarContext
): number {
  if (!grammar.id) return 0;
  const xy = normalizedXY(trial, site);
  const entryDepth = normalizedEntryDepth(trial, site);

  switch (grammar.id) {
    case "privacy_gradient": {
      if (isPrivate(trial)) return Math.abs(entryDepth - 0.8) * 24;
      if (isSocial(trial)) return Math.abs(entryDepth - 0.28) * 20;
      if (trial.type === "corridor" || trial.type === "stair") return Math.abs(entryDepth - 0.5) * 12;
      return Math.abs(entryDepth - 0.55) * 8;
    }

    case "social_core": {
      const centerDistance = Math.hypot(xy.x - 0.5, xy.y - 0.5);
      if (isSocial(trial)) return centerDistance * 34;
      if (trial.type === "corridor" || trial.type === "stair") return centerDistance * 20;
      if (isPrivate(trial)) return Math.max(0, 0.28 - centerDistance) * 18;
      return centerDistance * 6;
    }

    case "service_band": {
      const leftBand = (grammar.variant ?? 0) % 2 === 0;
      const bandX = leftBand ? 0.18 : 0.82;
      if (isService(trial)) return Math.abs(xy.x - bandX) * 34;
      if (trial.type === "corridor" || trial.type === "stair") return Math.abs(xy.x - 0.5) * 10;
      // Keep primary habitable rooms away from the dense service band.
      const habitableX = leftBand ? 0.62 : 0.38;
      return Math.abs(xy.x - habitableX) * 10;
    }

    case "evolutionary_spine": {
      const longitudinal = site.length >= site.width;
      const axisError = longitudinal ? Math.abs(xy.x - 0.5) : Math.abs(xy.y - 0.5);
      const perpendicular = longitudinal ? Math.abs(xy.x - 0.5) : Math.abs(xy.y - 0.5);
      if (trial.type === "corridor" || trial.type === "stair") return axisError * 42;
      if (isService(trial)) return perpendicular * 10;
      // Rooms sit on both sides of the spine rather than occupying it.
      return Math.abs(perpendicular - 0.28) * 16;
    }

    case "compact_core": {
      const centerDistance = Math.hypot(xy.x - 0.5, xy.y - 0.5);
      if (isService(trial) || trial.type === "stair" || trial.type === "corridor") {
        return centerDistance * 32;
      }
      return centerDistance * 15;
    }
  }
}
