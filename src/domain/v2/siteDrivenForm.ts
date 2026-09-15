import type { LayoutSpace, SiteConstraints, WallSide } from "./types";
import {
  buildableBounds,
  exteriorSideAzimuth,
  resolvedEntrySide,
  solarExposurePreference,
} from "./architecturalGrammarV3";

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

function spaceBounds(space: LayoutSpace) {
  return {
    minX: space.x - space.w / 2,
    maxX: space.x + space.w / 2,
    minY: space.y - space.h / 2,
    maxY: space.y + space.h / 2,
  };
}

function normalizedDistanceToSide(
  space: LayoutSpace,
  site: SiteConstraints,
  side: WallSide
): number {
  const buildable = buildableBounds(site);
  const bounds = spaceBounds(space);
  const width = Math.max(0.001, buildable.maxX - buildable.minX);
  const depth = Math.max(0.001, buildable.maxY - buildable.minY);

  switch (side) {
    case "left": return clamp01((bounds.minX - buildable.minX) / width);
    case "right": return clamp01((buildable.maxX - bounds.maxX) / width);
    case "bottom": return clamp01((bounds.minY - buildable.minY) / depth);
    case "top": return clamp01((buildable.maxY - bounds.maxY) / depth);
  }
}

export function entrySideAsWall(site: SiteConstraints): WallSide {
  switch (resolvedEntrySide(site)) {
    case "back": return "top";
    case "left": return "left";
    case "right": return "right";
    case "front":
    default: return "bottom";
  }
}

function entryReceiverWeight(space: LayoutSpace): number {
  if (space.floor !== 0) return 0;
  switch (space.type) {
    case "corridor": return 34;
    case "living": return 28;
    case "dining": return 16;
    case "stair": return 12;
    case "studio": return 7;
    case "garage": return 10;
    default: return 0;
  }
}

/**
 * Drives plausible entry-receiver spaces toward the selected access facade.
 * This is a design heuristic, not a code requirement.
 */
export function entryFacadePlacementCost(
  space: LayoutSpace,
  site: SiteConstraints
): number {
  const weight = entryReceiverWeight(space);
  if (weight <= 0) return 0;
  const distance = normalizedDistanceToSide(space, site, entrySideAsWall(site));
  return distance * weight;
}

function solarPlacementWeight(space: LayoutSpace): number {
  switch (space.type) {
    case "living": return 1;
    case "dining": return 0.95;
    case "bedroom": return 1;
    case "studio": return 0.9;
    case "kitchen": return 0.65;
    case "patio": return 0.6;
    case "terrace": return 0.7;
    default: return 0;
  }
}

/**
 * Estimates the best exterior facade a room could reach from its current
 * placement. It combines distance to that facade and the preliminary solar
 * preference for that facade. Lower is better.
 */
export function solarPlacementCost(
  space: LayoutSpace,
  site: SiteConstraints
): number {
  const typeWeight = solarPlacementWeight(space);
  if (typeWeight <= 0) return 0;

  const sides: WallSide[] = ["top", "right", "bottom", "left"];
  let best = Number.POSITIVE_INFINITY;

  for (const side of sides) {
    const distance = normalizedDistanceToSide(space, site, side);
    const preference = solarExposurePreference(
      space.type,
      exteriorSideAzimuth(side, site),
      site
    );

    const cost = distance * 15 + (1 - preference) * 10;
    if (cost < best) best = cost;
  }

  return best * typeWeight;
}

/**
 * Site-driven geometric bias used during candidate search, before scoring.
 */
export function siteDrivenPlacementCost(
  space: LayoutSpace,
  site: SiteConstraints
): number {
  return entryFacadePlacementCost(space, site) + solarPlacementCost(space, site);
}
