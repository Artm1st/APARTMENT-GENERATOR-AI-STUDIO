export type KnowledgeAuthority =
  | "mandatory_regulation"
  | "official_guidance"
  | "design_research"
  | "design_literature"
  | "project_parameter"
  | "user_preference";

export type EvaluationMode =
  | "hard_constraint"
  | "performance_target"
  | "soft_heuristic";

export type DesignDimension =
  | "habitability"
  | "privacy"
  | "circulation"
  | "social_interaction"
  | "adaptability"
  | "future_growth"
  | "accessibility"
  | "daylight"
  | "ventilation"
  | "acoustic_separation"
  | "service_efficiency"
  | "storage"
  | "constructability";

export interface KnowledgeSource {
  id: string;
  title: string;
  authorOrInstitution: string;
  year?: number;
  editionOrVersion?: string;
  locator?: string;
  url?: string;
  authority: KnowledgeAuthority;
  jurisdiction?: "PE" | "international";
}

export interface DesignPrinciple {
  id: string;
  title: string;
  dimension: DesignDimension;
  evaluationMode: EvaluationMode;
  sourceIds: string[];
  statement: string;
  rationale: string;
  appliesTo: Array<"single_family_house" | "apartment_unit">;
  weight: number;
  enabledByDefault: boolean;
  tags: string[];
}

export interface HouseholdDesignProfile {
  householdSize?: number;
  householdType?: "single" | "couple" | "family" | "multigenerational" | "shared";
  privacyPriority?: "low" | "medium" | "high";
  socialLivingPriority?: "low" | "medium" | "high";
  remoteWorkSpaces?: number;
  frequentVisitors?: boolean;
  futureGrowthExpected?: boolean;
  incrementalConstruction?: boolean;
  accessibilityPriority?: "standard" | "enhanced" | "universal";
  cookingIntensity?: "low" | "medium" | "high";
  storagePriority?: "low" | "medium" | "high";
  budgetSensitivity?: "low" | "medium" | "high";
}

export interface PrincipleAssessment {
  principleId: string;
  passed?: boolean;
  score?: number;
  explanation: string;
  evidence: string[];
  affectedSpaceIds: string[];
}

export const KNOWLEDGE_SOURCES: KnowledgeSource[] = [
  {
    id: "rne-a020-2021",
    title: "Norma Técnica A.020 Vivienda",
    authorOrInstitution: "Ministerio de Vivienda, Construcción y Saneamiento del Perú",
    year: 2021,
    editionOrVersion: "RM N.° 188-2021-VIVIENDA",
    url: "https://www.gob.pe/institucion/vivienda/normas-legales/2011712-188-2021-vivienda",
    authority: "mandatory_regulation",
    jurisdiction: "PE",
  },
  {
    id: "rne-a010-2021",
    title: "Norma Técnica A.010 Condiciones Generales de Diseño",
    authorOrInstitution: "Ministerio de Vivienda, Construcción y Saneamiento del Perú",
    year: 2021,
    editionOrVersion: "RM N.° 191-2021-VIVIENDA",
    url: "https://www.gob.pe/institucion/vivienda/normas-legales/2013148-191-2021-",
    authority: "mandatory_regulation",
    jurisdiction: "PE",
  },
  {
    id: "mvcs-vivienda-accesible-2026",
    title: "Guía para el diseño de viviendas accesibles",
    authorOrInstitution: "Ministerio de Vivienda, Construcción y Saneamiento del Perú",
    year: 2026,
    editionOrVersion: "RM N.° 228-2026-VIVIENDA",
    url: "https://www.gob.pe/institucion/vivienda/normas-legales/8267220-228-2026-vivienda",
    authority: "official_guidance",
    jurisdiction: "PE",
  },
  {
    id: "hillier-hanson-1984",
    title: "The Social Logic of Space",
    authorOrInstitution: "Bill Hillier and Julienne Hanson",
    year: 1984,
    authority: "design_research",
    jurisdiction: "international",
  },
  {
    id: "habraken-supports-1972",
    title: "Supports: An Alternative to Mass Housing",
    authorOrInstitution: "N. John Habraken",
    year: 1972,
    authority: "design_literature",
    jurisdiction: "international",
  },
  {
    id: "hertzberger-lessons-1991",
    title: "Lessons for Students in Architecture",
    authorOrInstitution: "Herman Hertzberger",
    year: 1991,
    authority: "design_literature",
    jurisdiction: "international",
  },
  {
    id: "alexander-pattern-language-1977",
    title: "A Pattern Language: Towns, Buildings, Construction",
    authorOrInstitution: "Christopher Alexander, Sara Ishikawa, Murray Silverstein et al.",
    year: 1977,
    authority: "design_literature",
    jurisdiction: "international",
  },
];

/**
 * Initial principles intentionally store paraphrased design logic, never copied
 * passages. They are not regulatory unless evaluationMode is hard_constraint
 * and the source itself is a mandatory regulation.
 */
export const DESIGN_PRINCIPLES: DesignPrinciple[] = [
  {
    id: "privacy-gradient",
    title: "Gradiente público–privado",
    dimension: "privacy",
    evaluationMode: "performance_target",
    sourceIds: ["hillier-hanson-1984", "hertzberger-lessons-1991"],
    statement: "Organizar la vivienda para que el paso desde el ingreso hacia los espacios íntimos ocurra mediante una transición legible entre zonas públicas, intermedias y privadas.",
    rationale: "Reduce cruces innecesarios, mejora control visual y protege actividades íntimas sin aislar la vida familiar.",
    appliesTo: ["single_family_house", "apartment_unit"],
    weight: 1,
    enabledByDefault: true,
    tags: ["privacy", "zoning", "thresholds"],
  },
  {
    id: "private-room-not-circulation",
    title: "No usar espacios privados como circulación obligatoria",
    dimension: "circulation",
    evaluationMode: "performance_target",
    sourceIds: ["hillier-hanson-1984"],
    statement: "Dormitorios y baños privados no deben funcionar como paso necesario para acceder a otros ambientes principales.",
    rationale: "Evita conflictos entre movimiento, descanso y privacidad.",
    appliesTo: ["single_family_house", "apartment_unit"],
    weight: 1,
    enabledByDefault: true,
    tags: ["circulation", "privacy"],
  },
  {
    id: "social-core",
    title: "Núcleo social reconocible",
    dimension: "social_interaction",
    evaluationMode: "soft_heuristic",
    sourceIds: ["alexander-pattern-language-1977", "hertzberger-lessons-1991"],
    statement: "Sala, comedor y cocina deben formar una estructura social legible, con relaciones directas o próximas según el modo de habitar de la familia.",
    rationale: "Permite convivencia y supervisión cotidiana sin imponer una única tipología de planta abierta.",
    appliesTo: ["single_family_house", "apartment_unit"],
    weight: 0.9,
    enabledByDefault: true,
    tags: ["family", "social", "adjacency"],
  },
  {
    id: "adaptable-support",
    title: "Capacidad de adaptación",
    dimension: "adaptability",
    evaluationMode: "performance_target",
    sourceIds: ["habraken-supports-1972"],
    statement: "Favorecer geometrías, accesos y zonas de servicio que permitan cambiar usos, dividir o integrar ambientes y crecer sin rehacer toda la vivienda.",
    rationale: "Las necesidades familiares cambian con el tiempo; la vivienda debe admitir transformaciones razonables.",
    appliesTo: ["single_family_house", "apartment_unit"],
    weight: 0.85,
    enabledByDefault: true,
    tags: ["adaptability", "future-growth", "incremental-housing"],
  },
  {
    id: "accessible-life-cycle",
    title: "Habitabilidad durante el ciclo de vida",
    dimension: "accessibility",
    evaluationMode: "performance_target",
    sourceIds: ["mvcs-vivienda-accesible-2026"],
    statement: "Cuando el perfil del hogar lo requiera, priorizar recorridos continuos, maniobra suficiente y reducción de barreras físicas desde el ingreso hasta los espacios esenciales.",
    rationale: "Permite que la vivienda siga siendo utilizable ante cambios de edad, movilidad o composición del hogar.",
    appliesTo: ["single_family_house", "apartment_unit"],
    weight: 1,
    enabledByDefault: true,
    tags: ["accessibility", "life-cycle"],
  },
  {
    id: "rne-residential-habitability",
    title: "Condiciones mínimas residenciales verificables",
    dimension: "habitability",
    evaluationMode: "hard_constraint",
    sourceIds: ["rne-a020-2021", "rne-a010-2021"],
    statement: "Toda solución debe pasar por el motor normativo RNE antes de presentarse como viable.",
    rationale: "El diseño generativo no puede sustituir las condiciones obligatorias de habitabilidad, funcionalidad y seguridad.",
    appliesTo: ["single_family_house", "apartment_unit"],
    weight: 1,
    enabledByDefault: true,
    tags: ["RNE", "compliance"],
  },
];

export function sourcesForPrinciple(principle: DesignPrinciple): KnowledgeSource[] {
  const wanted = new Set(principle.sourceIds);
  return KNOWLEDGE_SOURCES.filter((source) => wanted.has(source.id));
}
