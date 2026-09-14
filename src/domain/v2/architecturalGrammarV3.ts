import type {
  ArchitecturalPairRule,
  ArchitecturalProgram,
  EntrySide,
  Hemisphere,
  LayoutSpace,
  ProgramSpace,
  SiteConstraints,
  SpaceType,
  SpatialRelation,
  WallSide,
} from "./types";

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export function resolvedEntrySide(site: SiteConstraints): EntrySide {
  return site.entrySide ?? "front";
}

export function resolvedHemisphere(site: SiteConstraints): Hemisphere {
  return site.hemisphere ?? "south";
}

export function resolvedNorthAngle(site: SiteConstraints): number {
  const raw = Number(site.northAngleDeg ?? 0);
  if (!Number.isFinite(raw)) return 0;
  return ((raw % 360) + 360) % 360;
}

export function resolvedLevels(site: SiteConstraints): number {
  const raw = Math.floor(Number(site.levels ?? 1));
  return Math.max(1, Math.min(4, Number.isFinite(raw) ? raw : 1));
}

export function buildableBounds(site: SiteConstraints) {
  return {
    minX: site.setbackLeft,
    maxX: site.width - site.setbackRight,
    minY: site.setbackFront,
    maxY: site.length - site.setbackBack,
  };
}

/**
 * Returns normalized depth 0..1 measured from the selected pedestrian entry side.
 * 0 = closest to entry; 1 = deepest part of the buildable footprint.
 */
export function normalizedEntryDepth(
  point: { x: number; y: number },
  site: SiteConstraints
): number {
  const bounds = buildableBounds(site);
  const width = Math.max(0.001, bounds.maxX - bounds.minX);
  const depth = Math.max(0.001, bounds.maxY - bounds.minY);

  switch (resolvedEntrySide(site)) {
    case "back":
      return clamp01((bounds.maxY - point.y) / depth);
    case "left":
      return clamp01((point.x - bounds.minX) / width);
    case "right":
      return clamp01((bounds.maxX - point.x) / width);
    case "front":
    default:
      return clamp01((point.y - bounds.minY) / depth);
  }
}

export function desiredEntryDepth(type: SpaceType): number {
  switch (type) {
    case "garage": return 0.08;
    case "living": return 0.2;
    case "dining": return 0.32;
    case "kitchen": return 0.4;
    case "corridor": return 0.46;
    case "stair": return 0.48;
    case "studio": return 0.52;
    case "laundry": return 0.62;
    case "bathroom": return 0.66;
    case "bedroom": return 0.76;
    case "terrace":
    case "patio": return 0.82;
    default: return 0.5;
  }
}

export function entryTargetPoint(
  type: SpaceType,
  site: SiteConstraints,
  w: number,
  h: number
): { x: number; y: number } {
  const bounds = buildableBounds(site);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const width = Math.max(0, bounds.maxX - bounds.minX);
  const depth = Math.max(0, bounds.maxY - bounds.minY);
  const target = desiredEntryDepth(type);

  const minX = bounds.minX + w / 2;
  const maxX = bounds.maxX - w / 2;
  const minY = bounds.minY + h / 2;
  const maxY = bounds.maxY - h / 2;
  const safeX = (value: number) => Math.max(minX, Math.min(maxX, value));
  const safeY = (value: number) => Math.max(minY, Math.min(maxY, value));

  switch (resolvedEntrySide(site)) {
    case "back":
      return { x: safeX(centerX), y: safeY(bounds.maxY - depth * target) };
    case "left":
      return { x: safeX(bounds.minX + width * target), y: safeY(centerY) };
    case "right":
      return { x: safeX(bounds.maxX - width * target), y: safeY(centerY) };
    case "front":
    default:
      return { x: safeX(centerX), y: safeY(bounds.minY + depth * target) };
  }
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("::");
}

function removeDirectAccess(relations: SpatialRelation[], a: string, b: string): SpatialRelation[] {
  const key = pairKey(a, b);
  return relations.filter(
    (relation) => !(relation.kind === "direct_access" && pairKey(relation.a, relation.b) === key)
  );
}

function addPairRule(
  rules: ArchitecturalPairRule[],
  rule: ArchitecturalPairRule
): void {
  const exists = rules.some(
    (item) => item.kind === rule.kind && pairKey(item.a, item.b) === pairKey(rule.a, rule.b)
  );
  if (!exists) rules.push(rule);
}

function distributeAcrossLevels(spaces: ProgramSpace[], levels: number): ProgramSpace[] {
  if (levels <= 1) return spaces.map((space) => ({ ...space, floor: 0 }));

  const hasExplicitUpperFloor = spaces.some((space) => (space.floor ?? 0) > 0);
  if (hasExplicitUpperFloor) {
    return spaces.map((space) => ({
      ...space,
      floor: Math.min(levels - 1, Math.max(0, space.floor ?? 0)),
    }));
  }

  let bedroomIndex = 0;
  let bathroomIndex = 0;
  return spaces.map((space) => {
    let floor = 0;

    if (space.type === "bedroom") {
      floor = 1 + (bedroomIndex++ % Math.max(1, levels - 1));
    } else if (space.type === "studio") {
      floor = Math.min(1, levels - 1);
    } else if (space.type === "bathroom") {
      // Keep one common bathroom on the ground floor, then distribute extras upstairs.
      floor = bathroomIndex === 0 ? 0 : 1 + ((bathroomIndex - 1) % Math.max(1, levels - 1));
      bathroomIndex++;
    }

    return { ...space, floor };
  });
}

function ensureUpperCirculation(spaces: ProgramSpace[], levels: number): ProgramSpace[] {
  const result = [...spaces];
  for (let floor = 1; floor < levels; floor++) {
    const hasOccupiedFloor = result.some((space) => (space.floor ?? 0) === floor);
    if (!hasOccupiedFloor) continue;

    const hasHub = result.some(
      (space) =>
        (space.floor ?? 0) === floor &&
        (space.type === "corridor" || space.type === "living" || space.type === "dining")
    );
    if (!hasHub) {
      result.push({
        id: `v3_distribuidor_n${floor + 1}`,
        type: "corridor",
        label: `Distribuidor nivel ${floor + 1}`,
        targetArea: 4,
        privacy: "semi_private",
        requiresExteriorOpening: false,
        wetArea: false,
        floor,
      });
    }
  }
  return result;
}

function ensureStairStack(spaces: ProgramSpace[], levels: number): ProgramSpace[] {
  if (levels <= 1) return spaces;
  const result = [...spaces];
  for (let floor = 0; floor < levels; floor++) {
    const id = `v3_escalera_n${floor + 1}`;
    if (result.some((space) => space.id === id)) continue;
    result.push({
      id,
      type: "stair",
      label: `Escalera nivel ${floor + 1}`,
      targetArea: 5,
      minWidth: 1,
      privacy: "semi_private",
      requiresExteriorOpening: false,
      wetArea: false,
      floor,
      verticalStackKey: "main_stair",
    });
  }
  return result;
}

function ensureStairRelations(
  spaces: ProgramSpace[],
  relations: SpatialRelation[],
  levels: number
): SpatialRelation[] {
  if (levels <= 1) return relations;
  const result = [...relations];

  for (let floor = 0; floor < levels; floor++) {
    const stair = spaces.find((space) => space.type === "stair" && (space.floor ?? 0) === floor);
    if (!stair) continue;
    const hub =
      spaces.find((space) => space.type === "corridor" && (space.floor ?? 0) === floor) ??
      spaces.find((space) => space.type === "living" && (space.floor ?? 0) === floor) ??
      spaces.find((space) => space.type === "dining" && (space.floor ?? 0) === floor);
    if (!hub) continue;

    const key = pairKey(stair.id, hub.id);
    const exists = result.some(
      (relation) => relation.kind === "direct_access" && pairKey(relation.a, relation.b) === key
    );
    if (!exists) {
      result.push({
        id: `v3_stair_access_${floor}`,
        a: stair.id,
        b: hub.id,
        kind: "direct_access",
        weight: 1,
      });
    }
  }

  return result;
}

/**
 * Applies deterministic architectural grammar before geometric generation.
 * These are design heuristics, not claims of RNE compliance.
 */
export function applyArchitecturalGrammarV3(
  program: ArchitecturalProgram,
  site: SiteConstraints
): ArchitecturalProgram {
  const levels = resolvedLevels(site);
  let spaces = distributeAcrossLevels(
    program.spaces.map((space) => ({ ...space })),
    levels
  );
  spaces = ensureUpperCirculation(spaces, levels);
  spaces = ensureStairStack(spaces, levels);

  let relations = program.relations.map((relation) => ({ ...relation }));
  const pairRules = (program.pairRules ?? []).map((rule) => ({ ...rule }));

  const kitchens = spaces.filter((space) => space.type === "kitchen");
  const bathrooms = spaces.filter((space) => space.type === "bathroom");
  const social = spaces.filter((space) => space.type === "living" || space.type === "dining");

  for (const bathroom of bathrooms) {
    for (const kitchen of kitchens) {
      if ((bathroom.floor ?? 0) !== (kitchen.floor ?? 0)) continue;
      relations = removeDirectAccess(relations, bathroom.id, kitchen.id);
      addPairRule(pairRules, {
        id: `v3_no_direct_${bathroom.id}_${kitchen.id}`,
        a: bathroom.id,
        b: kitchen.id,
        kind: "no_direct_access",
        weight: 1,
        severity: "error",
        rationale: "Evitar que un baño descargue directamente hacia la cocina; separar acceso sanitario y preparación de alimentos.",
      });
      addPairRule(pairRules, {
        id: `v3_avoid_adj_${bathroom.id}_${kitchen.id}`,
        a: bathroom.id,
        b: kitchen.id,
        kind: "avoid_adjacency",
        weight: 0.55,
        severity: "warning",
        rationale: "La proximidad del núcleo húmedo puede ser eficiente, pero se prefiere un filtro o separación funcional entre baño y cocina.",
      });
    }

    for (const socialSpace of social) {
      if ((bathroom.floor ?? 0) !== (socialSpace.floor ?? 0)) continue;
      relations = removeDirectAccess(relations, bathroom.id, socialSpace.id);
      addPairRule(pairRules, {
        id: `v3_no_direct_${bathroom.id}_${socialSpace.id}`,
        a: bathroom.id,
        b: socialSpace.id,
        kind: "no_direct_access",
        weight: 0.9,
        severity: "error",
        rationale: "Se prefiere que el baño común acceda desde circulación o un filtro, no directamente desde sala/comedor.",
      });
    }
  }

  relations = ensureStairRelations(spaces, relations, levels);

  return {
    ...program,
    spaces,
    relations,
    pairRules,
  };
}

export function exteriorSideAzimuth(side: WallSide, site: SiteConstraints): number {
  // Plan angle: top=0°, right=90°, bottom=180°, left=270°.
  // northAngleDeg states where geographic/project north points in the same plan convention.
  const planAngle: Record<WallSide, number> = {
    top: 0,
    right: 90,
    bottom: 180,
    left: 270,
  };
  return (planAngle[side] - resolvedNorthAngle(site) + 360) % 360;
}

function angularDistance(a: number, b: number): number {
  const delta = Math.abs(a - b) % 360;
  return Math.min(delta, 360 - delta);
}

/**
 * Preliminary solar-orientation preference, not a sun-hours simulation.
 * In the southern hemisphere, north/east exposure is generally preferred for
 * primary habitable rooms; in the northern hemisphere the principal pole is south.
 */
export function solarExposurePreference(
  type: SpaceType,
  azimuth: number,
  site: SiteConstraints
): number {
  if (type === "bathroom" || type === "laundry" || type === "garage" || type === "stair") {
    return 0.55;
  }

  const solarPole = resolvedHemisphere(site) === "south" ? 0 : 180;
  const poleScore = 1 - angularDistance(azimuth, solarPole) / 180;
  const eastScore = 1 - angularDistance(azimuth, 90) / 180;
  const westPenalty = clamp01(1 - angularDistance(azimuth, 270) / 90);

  if (type === "bedroom") {
    return clamp01(poleScore * 0.5 + eastScore * 0.45 + 0.05 - westPenalty * 0.2);
  }
  if (type === "living" || type === "dining" || type === "studio") {
    return clamp01(poleScore * 0.7 + eastScore * 0.25 + 0.05 - westPenalty * 0.12);
  }
  if (type === "kitchen") {
    return clamp01(eastScore * 0.6 + poleScore * 0.3 + 0.1 - westPenalty * 0.12);
  }
  return clamp01(poleScore * 0.5 + eastScore * 0.25 + 0.25);
}

export function verticalStackPeers(space: LayoutSpace, spaces: LayoutSpace[]): LayoutSpace[] {
  if (!space.verticalStackKey) return [];
  return spaces.filter(
    (candidate) =>
      candidate.id !== space.id &&
      candidate.verticalStackKey === space.verticalStackKey
  );
}
