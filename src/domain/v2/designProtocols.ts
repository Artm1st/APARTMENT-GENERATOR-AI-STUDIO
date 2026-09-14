import type {
  EncodedMetric,
  HybridHouseholdProfile,
  ProfileMetricKey,
} from "./hybridQualitativeEncoder";

export type DesignProtocolKey =
  | "privacy_gradient"
  | "social_integration"
  | "visitor_control"
  | "adaptability"
  | "accessibility"
  | "service_efficiency"
  | "work_separation"
  | "storage"
  | "cost_efficiency"
  | "future_growth";

export interface DesignProtocolDirective {
  key: DesignProtocolKey;
  strength: number;
  explanation: string;
  evidence: string[];
}

export interface DesignProtocolSet {
  profileConfidence: number;
  priorities: Record<DesignProtocolKey, number>;
  directives: DesignProtocolDirective[];
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

function metric(profile: HybridHouseholdProfile, key: ProfileMetricKey, fallback = 0.5): number {
  return clamp01(profile.metrics[key]?.value ?? fallback);
}

function evidenceFor(profile: HybridHouseholdProfile, keys: ProfileMetricKey[]): string[] {
  const result = new Set<string>();
  for (const key of keys) {
    const encoded: EncodedMetric | undefined = profile.metrics[key];
    for (const item of encoded?.evidence ?? []) {
      for (const phrase of item.evidence) result.add(phrase);
    }
  }
  return [...result].slice(0, 4);
}

function directive(
  key: DesignProtocolKey,
  strength: number,
  explanation: string,
  evidence: string[]
): DesignProtocolDirective {
  return {
    key,
    strength: Number(clamp01(strength).toFixed(3)),
    explanation,
    evidence,
  };
}

/**
 * Converts household signals into design priorities. This layer is deterministic:
 * it does not call AI and it does not claim regulatory compliance.
 */
export function deriveDesignProtocols(profile: HybridHouseholdProfile): DesignProtocolSet {
  const privacy = metric(profile, "privacy");
  const social = metric(profile, "socialLiving");
  const adaptability = metric(profile, "adaptability");
  const accessibility = metric(profile, "accessibility");
  const cooking = metric(profile, "cooking");
  const storage = metric(profile, "storage");
  const cost = metric(profile, "costSensitivity");
  const remoteWork = metric(profile, "remoteWork");
  const visitors = metric(profile, "visitorExposure");

  const futureGrowthFlag = profile.categorical.futureGrowthExpected ? 1 : 0;
  const incrementalFlag = profile.categorical.incrementalConstruction ? 1 : 0;

  const priorities: Record<DesignProtocolKey, number> = {
    privacy_gradient: clamp01(privacy * 0.78 + visitors * 0.22),
    social_integration: clamp01(social * 0.8 + cooking * 0.2),
    visitor_control: clamp01(visitors * 0.62 + privacy * 0.38),
    adaptability,
    accessibility,
    service_efficiency: clamp01(cooking * 0.55 + cost * 0.2 + adaptability * 0.25),
    work_separation: clamp01(remoteWork * 0.72 + privacy * 0.28),
    storage,
    cost_efficiency: cost,
    future_growth: clamp01(adaptability * 0.5 + futureGrowthFlag * 0.3 + incrementalFlag * 0.2),
  };

  const directives: DesignProtocolDirective[] = [
    directive(
      "privacy_gradient",
      priorities.privacy_gradient,
      "Aumentar la transición entre ingreso, áreas sociales y espacios íntimos a medida que crece la prioridad de privacidad.",
      evidenceFor(profile, ["privacy", "visitorExposure"])
    ),
    directive(
      "social_integration",
      priorities.social_integration,
      "Fortalecer la relación entre sala, comedor y cocina cuando la convivencia cotidiana es prioritaria.",
      evidenceFor(profile, ["socialLiving", "cooking"])
    ),
    directive(
      "visitor_control",
      priorities.visitor_control,
      "Evitar que los recorridos de visitas atraviesen dormitorios u otras zonas íntimas.",
      evidenceFor(profile, ["visitorExposure", "privacy"])
    ),
    directive(
      "adaptability",
      priorities.adaptability,
      "Favorecer espacios de proporción reutilizable y una circulación que soporte cambios de uso.",
      evidenceFor(profile, ["adaptability", "remoteWork"])
    ),
    directive(
      "accessibility",
      priorities.accessibility,
      "Priorizar recorridos simples y acceso claro a los espacios esenciales según el nivel de accesibilidad solicitado.",
      evidenceFor(profile, ["accessibility"])
    ),
    directive(
      "service_efficiency",
      priorities.service_efficiency,
      "Concentrar razonablemente cocina, baños y lavandería para reducir recorridos e instalaciones innecesarias.",
      evidenceFor(profile, ["cooking", "costSensitivity", "adaptability"])
    ),
    directive(
      "work_separation",
      priorities.work_separation,
      "Proteger trabajo o estudio doméstico de las rutas sociales cuando su uso es frecuente.",
      evidenceFor(profile, ["remoteWork", "privacy"])
    ),
    directive(
      "storage",
      priorities.storage,
      "Reservar capacidad de almacenamiento sin convertir la circulación principal en espacio residual de guardado.",
      evidenceFor(profile, ["storage"])
    ),
    directive(
      "cost_efficiency",
      priorities.cost_efficiency,
      "Reducir complejidad geométrica y recorridos de servicio cuando el costo inicial es una prioridad.",
      evidenceFor(profile, ["costSensitivity"])
    ),
    directive(
      "future_growth",
      priorities.future_growth,
      "Preservar una lógica de ampliación o transformación futura cuando el hogar espera crecer o construir por etapas.",
      evidenceFor(profile, ["adaptability"])
    ),
  ];

  return {
    profileConfidence: Number(profile.overallConfidence.toFixed(3)),
    priorities,
    directives,
  };
}

export function createNeutralDesignProtocols(): DesignProtocolSet {
  const priorities = {
    privacy_gradient: 0.5,
    social_integration: 0.5,
    visitor_control: 0.4,
    adaptability: 0.5,
    accessibility: 0.4,
    service_efficiency: 0.55,
    work_separation: 0.35,
    storage: 0.5,
    cost_efficiency: 0.5,
    future_growth: 0.45,
  } satisfies Record<DesignProtocolKey, number>;

  return {
    profileConfidence: 0,
    priorities,
    directives: Object.entries(priorities).map(([key, strength]) => ({
      key: key as DesignProtocolKey,
      strength,
      explanation: "Prioridad neutra utilizada porque todavía no existe un perfil familiar completo.",
      evidence: [],
    })),
  };
}
