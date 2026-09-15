import type { LayoutSpace, SiteConstraints } from "./types";
import type { TypologyStrategyId } from "./typologyStrategies";
import { buildableBounds, normalizedEntryDepth } from "./architecturalGrammarV3";
import { siteDrivenPlacementCost } from "./siteDrivenForm";

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
 * v3.2 also injects site-driven form costs so entry side and north influence
 * placement before the candidate is scored.
 */
export function spatialGrammarPlacementCost(
  trial: LayoutSpace,
  site: SiteConstraints,
  grammar: SpatialGrammarContext
): number {
  const siteCost = siteDrivenPlacementCost(trial, site);
  if (!grammar.id) return siteCost;

  const xy = normalizedXY(trial, site);
  const entryDepth = normalizedEntryDepth(trial, site);
  let grammarCost = 0;

  switch (grammar.id) {
    case "privacy_gradient": {
      if (isPrivate(trial)) grammarCost = Math.abs(entryDepth - 0.8) * 24;
      else if (isSocial(trial)) grammarCost = Math.abs(entryDepth - 0.28) * 20;
      else if (trial.type === "corridor" || trial.type === "stair") grammarCost = Math.abs(entryDepth - 0.5) * 12;
      else grammarCost = Math.abs(entryDepth - 0.55) * 8;
      break;
    }

    case "social_core": {
      const centerDistance = Math.hypot(xy.x - 0.5, xy.y - 0.5);
      if (isSocial(trial)) grammarCost = centerDistance * 34;
      else if (trial.type === "corridor" || trial.type === "stair") grammarCost = centerDistance * 20;
      else if (isPrivate(trial)) grammarCost = Math.max(0, 0.28 - centerDistance) * 18;
      else grammarCost = centerDistance * 6;
      break;
    }

    case "service_band": {
      const leftBand = (grammar.variant ?? 0) % 2 === 0;
      const bandX = leftBand ? 0.18 : 0.82;
      if (isService(trial)) grammarCost = Math.abs(xy.x - bandX) * 34;
      else if (trial.type === "corridor" || trial.type === "stair") grammarCost = Math.abs(xy.x - 0.5) * 10;
      else {
        const habitableX = leftBand ? 0.62 : 0.38;
        grammarCost = Math.abs(xy.x - habitableX) * 10;
      }
      break;
    }

    case "evolutionary_spine": {
      const longitudinal = site.length >= site.width;
      const axisError = longitudinal ? Math.abs(xy.x - 0.5) : Math.abs(xy.y - 0.5);
      const perpendicular = longitudinal ? Math.abs(xy.x - 0.5) : Math.abs(xy.y - 0.5);
      if (trial.type === "corridor" || trial.type === "stair") grammarCost = axisError * 42;
      else if (isService(trial)) grammarCost = perpendicular * 10;
      else grammarCost = Math.abs(perpendicular - 0.28) * 16;
      break;
    }

    case "compact_core": {
      const centerDistance = Math.hypot(xy.x - 0.5, xy.y - 0.5);
      if (isService(trial) || trial.type === "stair" || trial.type === "corridor") {
        grammarCost = centerDistance * 32;
      } else {
        grammarCost = centerDistance * 15;
      }
      break;
    }
  }

  return grammarCost + siteCost;
}
