import type { GeometryIssue, LayoutSpace, SpaceType } from "./types";

export interface FurnitureFitEnvelope {
  minWidth: number;
  minDepth: number;
  rationale: string;
  critical: boolean;
}

export interface FurnitureFitAssessment {
  spaceId: string;
  type: SpaceType;
  score: number;
  passes: boolean;
  critical: boolean;
  envelope?: FurnitureFitEnvelope;
}

// Design envelopes only. They approximate room proportions needed to place basic
// furniture plus use clearances. They are not presented as RNE minimums.
const ENVELOPES: Partial<Record<SpaceType, FurnitureFitEnvelope>> = {
  living: {
    minWidth: 3.0,
    minDepth: 3.2,
    rationale: "sofá, frente de uso y circulación básica",
    critical: false,
  },
  bedroom: {
    minWidth: 2.7,
    minDepth: 3.0,
    rationale: "cama, almacenamiento y circulación básica",
    critical: true,
  },
  bathroom: {
    minWidth: 1.5,
    minDepth: 2.1,
    rationale: "inodoro, lavamanos, ducha y franjas de uso",
    critical: true,
  },
  kitchen: {
    minWidth: 2.2,
    minDepth: 2.4,
    rationale: "mesada/equipamiento y franja de trabajo",
    critical: true,
  },
  dining: {
    minWidth: 2.6,
    minDepth: 2.8,
    rationale: "mesa compacta, sillas y circulación",
    critical: false,
  },
  laundry: {
    minWidth: 1.6,
    minDepth: 1.8,
    rationale: "lavadora/lavadero y maniobra básica",
    critical: false,
  },
  studio: {
    minWidth: 2.2,
    minDepth: 2.4,
    rationale: "escritorio, silla y almacenamiento básico",
    critical: false,
  },
  garage: {
    minWidth: 2.8,
    minDepth: 5.0,
    rationale: "vehículo compacto y maniobra peatonal básica",
    critical: false,
  },
};

function orientationFit(space: LayoutSpace, envelope: FurnitureFitEnvelope): number {
  const direct = Math.min(space.w / envelope.minWidth, space.h / envelope.minDepth);
  const rotated = Math.min(space.w / envelope.minDepth, space.h / envelope.minWidth);
  return Math.max(direct, rotated);
}

export function assessFurnitureFit(space: LayoutSpace): FurnitureFitAssessment {
  const envelope = ENVELOPES[space.type];
  if (!envelope) {
    return {
      spaceId: space.id,
      type: space.type,
      score: 1,
      passes: true,
      critical: false,
    };
  }

  const raw = orientationFit(space, envelope);
  const score = Math.max(0, Math.min(1, raw));
  return {
    spaceId: space.id,
    type: space.type,
    score,
    passes: raw >= 1,
    critical: envelope.critical,
    envelope,
  };
}

export function scoreFurnitureFit(spaces: LayoutSpace[]): number {
  const assessed = spaces
    .filter((space) => !["corridor", "stair", "patio", "terrace", "other"].includes(space.type))
    .map(assessFurnitureFit);
  if (assessed.length === 0) return 1;

  const weighted = assessed.reduce((sum, item) => {
    const weight = item.critical ? 1.4 : 1;
    return sum + item.score * weight;
  }, 0);
  const totalWeight = assessed.reduce((sum, item) => sum + (item.critical ? 1.4 : 1), 0);
  return totalWeight > 0 ? weighted / totalWeight : 1;
}

export function furnitureFitIssues(spaces: LayoutSpace[]): GeometryIssue[] {
  const issues: GeometryIssue[] = [];

  for (const space of spaces) {
    const assessment = assessFurnitureFit(space);
    if (assessment.passes || !assessment.envelope) continue;

    const { envelope } = assessment;
    issues.push({
      code: "INSUFFICIENT_FURNITURE_FIT",
      severity: assessment.critical ? "error" : "warning",
      message: `${space.label} (${space.w.toFixed(2)} × ${space.h.toFixed(2)} m) no alcanza el sobre de uso preliminar de ${envelope.minWidth.toFixed(1)} × ${envelope.minDepth.toFixed(1)} m para ${envelope.rationale}. Es una heurística de habitabilidad, no un mínimo normativo.`,
      spaceIds: [space.id],
    });
  }

  return issues;
}
