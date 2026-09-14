import type { DesignProtocolSet } from "./designProtocols";
import type {
  ArchitecturalProgram,
  ProgramSpace,
  SiteConstraints,
  SpatialRelation,
  SpatialRelationKind,
} from "./types";

export type TypologyStrategyId =
  | "privacy_gradient"
  | "social_core"
  | "service_band"
  | "evolutionary_spine"
  | "compact_core";

export interface TypologyStrategySelection {
  id: TypologyStrategyId;
  title: string;
  description: string;
  suitability: number;
  reasons: string[];
  dimensionJitter: number;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const STRATEGY_TEXT: Record<TypologyStrategyId, { title: string; description: string }> = {
  privacy_gradient: {
    title: "Gradiente de privacidad",
    description: "Organiza una transición clara desde ingreso y áreas sociales hacia las zonas privadas.",
  },
  social_core: {
    title: "Núcleo social",
    description: "Concentra sala, comedor y cocina como centro cotidiano de convivencia.",
  },
  service_band: {
    title: "Banda de servicios",
    description: "Agrupa cocina, baños y lavandería para mejorar eficiencia de instalaciones y recorridos.",
  },
  evolutionary_spine: {
    title: "Espina evolutiva",
    description: "Usa una circulación legible que permita transformar usos y crecer por etapas sin bloquear la vivienda.",
  },
  compact_core: {
    title: "Núcleo compacto",
    description: "Reduce perímetro y dispersión para priorizar economía inicial y eficiencia constructiva.",
  },
};

function siteCompactnessPressure(site: SiteConstraints): number {
  const width = Math.max(0.1, site.width - site.setbackLeft - site.setbackRight);
  const length = Math.max(0.1, site.length - site.setbackFront - site.setbackBack);
  const area = width * length;
  if (area <= 80) return 1;
  if (area <= 120) return 0.75;
  if (area <= 180) return 0.45;
  return 0.2;
}

export function selectTypologyStrategies(
  protocols: DesignProtocolSet,
  site: SiteConstraints,
  limit = 3
): TypologyStrategySelection[] {
  const p = protocols.priorities;
  const compactPressure = siteCompactnessPressure(site);

  const raw: Array<TypologyStrategySelection> = [
    {
      id: "privacy_gradient",
      ...STRATEGY_TEXT.privacy_gradient,
      suitability: clamp01(p.privacy_gradient * 0.68 + p.visitor_control * 0.32),
      reasons: [
        `Privacidad ${(p.privacy_gradient * 100).toFixed(0)}%`,
        `Control de visitas ${(p.visitor_control * 100).toFixed(0)}%`,
      ],
      dimensionJitter: 0.12,
    },
    {
      id: "social_core",
      ...STRATEGY_TEXT.social_core,
      suitability: clamp01(p.social_integration * 0.78 + (1 - p.work_separation) * 0.08 + p.accessibility * 0.14),
      reasons: [
        `Convivencia ${(p.social_integration * 100).toFixed(0)}%`,
        "Prioriza relaciones cortas entre los espacios comunes.",
      ],
      dimensionJitter: 0.18,
    },
    {
      id: "service_band",
      ...STRATEGY_TEXT.service_band,
      suitability: clamp01(p.service_efficiency * 0.62 + p.cost_efficiency * 0.28 + compactPressure * 0.1),
      reasons: [
        `Eficiencia de servicios ${(p.service_efficiency * 100).toFixed(0)}%`,
        `Sensibilidad de costo ${(p.cost_efficiency * 100).toFixed(0)}%`,
      ],
      dimensionJitter: 0.1,
    },
    {
      id: "evolutionary_spine",
      ...STRATEGY_TEXT.evolutionary_spine,
      suitability: clamp01(p.future_growth * 0.58 + p.adaptability * 0.32 + p.work_separation * 0.1),
      reasons: [
        `Crecimiento futuro ${(p.future_growth * 100).toFixed(0)}%`,
        `Adaptabilidad ${(p.adaptability * 100).toFixed(0)}%`,
      ],
      dimensionJitter: 0.24,
    },
    {
      id: "compact_core",
      ...STRATEGY_TEXT.compact_core,
      suitability: clamp01(p.cost_efficiency * 0.55 + p.service_efficiency * 0.2 + compactPressure * 0.25),
      reasons: [
        `Economía inicial ${(p.cost_efficiency * 100).toFixed(0)}%`,
        `Presión de compacidad del lote ${(compactPressure * 100).toFixed(0)}%`,
      ],
      dimensionJitter: 0.08,
    },
  ];

  return raw
    .sort((a, b) => b.suitability - a.suitability || a.id.localeCompare(b.id))
    .slice(0, Math.max(1, limit))
    .map((strategy) => ({
      ...strategy,
      suitability: Number(strategy.suitability.toFixed(3)),
    }));
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("::");
}

function relationPriority(kind: SpatialRelationKind): number {
  switch (kind) {
    case "must_not_touch": return 5;
    case "direct_access": return 4;
    case "must_touch": return 3;
    case "prefer_touch": return 2;
    case "near": return 1;
  }
}

function addRelation(relations: SpatialRelation[], relation: SpatialRelation): void {
  if (relation.a === relation.b) return;
  const key = pairKey(relation.a, relation.b);
  const conflicting = relations.some((existing) => {
    if (pairKey(existing.a, existing.b) !== key) return false;
    if (relation.kind === "must_not_touch") {
      return existing.kind === "direct_access" || existing.kind === "must_touch";
    }
    return existing.kind === "must_not_touch";
  });
  if (conflicting) return;

  const same = relations.find(
    (existing) => pairKey(existing.a, existing.b) === key && existing.kind === relation.kind
  );
  if (same) {
    same.weight = Math.max(same.weight, relation.weight);
    return;
  }

  const stronger = relations.find(
    (existing) =>
      pairKey(existing.a, existing.b) === key &&
      relationPriority(existing.kind) > relationPriority(relation.kind)
  );
  if (!stronger) relations.push(relation);
}

function first(program: ArchitecturalProgram, type: ProgramSpace["type"]): ProgramSpace | undefined {
  return program.spaces.find((space) => space.type === type);
}

function all(program: ArchitecturalProgram, type: ProgramSpace["type"]): ProgramSpace[] {
  return program.spaces.filter((space) => space.type === type);
}

function relate(
  relations: SpatialRelation[],
  a: ProgramSpace | undefined,
  b: ProgramSpace | undefined,
  kind: SpatialRelationKind,
  id: string,
  weight: number
): void {
  if (!a || !b) return;
  addRelation(relations, { id, a: a.id, b: b.id, kind, weight });
}

/**
 * Applies the design intent of one typology without inventing new rooms. The
 * transformation changes relations/weights only; the requested program remains
 * recognizable and auditable.
 */
export function applyTypologyStrategy(
  program: ArchitecturalProgram,
  strategy: TypologyStrategySelection,
  protocols: DesignProtocolSet
): ArchitecturalProgram {
  const relations = program.relations.map((relation) => ({ ...relation }));
  const living = first(program, "living");
  const dining = first(program, "dining");
  const kitchen = first(program, "kitchen");
  const corridor = first(program, "corridor");
  const laundry = first(program, "laundry");
  const bedrooms = all(program, "bedroom");
  const bathrooms = all(program, "bathroom");
  const studios = all(program, "studio");

  if (strategy.id === "social_core") {
    relate(relations, living, dining, "direct_access", "strategy_social_living_dining", 1);
    relate(relations, dining ?? living, kitchen, "direct_access", "strategy_social_kitchen", 1);
    relate(relations, living, kitchen, "prefer_touch", "strategy_social_triangle", 0.72);
  }

  if (strategy.id === "privacy_gradient") {
    const hub = corridor ?? dining ?? living;
    for (const bedroom of bedrooms) {
      relate(relations, bedroom, hub, "direct_access", `strategy_privacy_${bedroom.id}_hub`, 1);
      if (protocols.priorities.privacy_gradient >= 0.72 && corridor) {
        relate(relations, bedroom, living, "must_not_touch", `strategy_privacy_${bedroom.id}_living`, 0.86);
      }
    }
    for (const bathroom of bathrooms) {
      if (!bedrooms.some((bedroom) => relations.some((relation) =>
        relation.kind === "direct_access" && pairKey(relation.a, relation.b) === pairKey(bedroom.id, bathroom.id)
      ))) {
        relate(relations, bathroom, hub, "direct_access", `strategy_privacy_${bathroom.id}_hub`, 0.92);
      }
    }
  }

  if (strategy.id === "service_band") {
    relate(relations, kitchen, laundry, "prefer_touch", "strategy_service_kitchen_laundry", 0.96);
    for (const bathroom of bathrooms) {
      relate(relations, bathroom, kitchen, "near", `strategy_service_${bathroom.id}_kitchen`, 0.9);
      if (laundry) relate(relations, bathroom, laundry, "near", `strategy_service_${bathroom.id}_laundry`, 0.72);
    }
  }

  if (strategy.id === "evolutionary_spine") {
    const spine = corridor ?? dining ?? living;
    for (const bedroom of bedrooms) {
      relate(relations, bedroom, spine, "direct_access", `strategy_evolution_${bedroom.id}`, 0.94);
    }
    for (const studio of studios) {
      relate(relations, studio, spine, "direct_access", `strategy_evolution_${studio.id}`, 0.9);
      relate(relations, studio, living, "near", `strategy_evolution_${studio.id}_social`, 0.55);
    }
    relate(relations, kitchen, laundry, "near", "strategy_evolution_service", 0.78);
  }

  if (strategy.id === "compact_core") {
    relate(relations, living, dining, "prefer_touch", "strategy_compact_living_dining", 0.95);
    relate(relations, dining ?? living, kitchen, "prefer_touch", "strategy_compact_kitchen", 0.95);
    relate(relations, kitchen, laundry, "prefer_touch", "strategy_compact_laundry", 0.9);
    for (const bathroom of bathrooms) {
      relate(relations, bathroom, kitchen, "near", `strategy_compact_${bathroom.id}_wet`, 0.78);
    }
  }

  return {
    ...program,
    relations,
  };
}
