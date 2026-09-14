import type { HouseholdDesignProfile } from "./designKnowledge";

export type QuestionnaireQuestionType =
  | "number"
  | "single_choice"
  | "boolean"
  | "text";

export interface QuestionnaireOption {
  value: string;
  label: string;
  description?: string;
}

export interface HouseholdQuestion {
  id: string;
  title: string;
  helpText: string;
  type: QuestionnaireQuestionType;
  required: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
  options?: QuestionnaireOption[];
}

export type HouseholdQuestionnaireAnswers = Record<
  string,
  string | number | boolean | undefined
>;

export const HOUSEHOLD_QUESTIONS: HouseholdQuestion[] = [
  {
    id: "householdSize",
    title: "¿Cuántas personas vivirán normalmente en la vivienda?",
    helpText: "Cuenta a quienes usarán la casa de forma habitual.",
    type: "number",
    required: true,
    min: 1,
    max: 20,
  },
  {
    id: "householdType",
    title: "¿Cómo está compuesto el hogar?",
    helpText: "Esto ayuda a definir privacidad, independencia y relaciones entre zonas.",
    type: "single_choice",
    required: true,
    options: [
      { value: "single", label: "Una persona" },
      { value: "couple", label: "Pareja" },
      { value: "family", label: "Familia" },
      { value: "multigenerational", label: "Familia multigeneracional" },
      { value: "shared", label: "Vivienda compartida" },
    ],
  },
  {
    id: "privacyPriority",
    title: "¿Qué tan importante es separar la vida privada de las visitas y áreas sociales?",
    helpText: "Una prioridad alta protege más dormitorios y espacios íntimos.",
    type: "single_choice",
    required: true,
    options: [
      { value: "low", label: "Preferimos una casa muy integrada" },
      { value: "medium", label: "Buscamos un equilibrio" },
      { value: "high", label: "Queremos mucha privacidad" },
    ],
  },
  {
    id: "socialLivingPriority",
    title: "¿Qué tan importante es convivir en espacios sociales integrados?",
    helpText: "Afecta la relación entre sala, comedor, cocina y espacios comunes.",
    type: "single_choice",
    required: true,
    options: [
      { value: "low", label: "Poco importante" },
      { value: "medium", label: "Importante" },
      { value: "high", label: "Muy importante" },
    ],
  },
  {
    id: "frequentVisitors",
    title: "¿Reciben visitas con frecuencia?",
    helpText: "Si la respuesta es sí, el motor intenta evitar que las visitas atraviesen zonas privadas.",
    type: "boolean",
    required: true,
  },
  {
    id: "cookingIntensity",
    title: "¿Qué tan importante es cocinar en la vida diaria del hogar?",
    helpText: "Permite decidir si la cocina debe ser más social, central o reservada.",
    type: "single_choice",
    required: true,
    options: [
      { value: "low", label: "Cocinamos poco" },
      { value: "medium", label: "Cocinamos regularmente" },
      { value: "high", label: "La cocina es muy importante" },
    ],
  },
  {
    id: "remoteWorkSpaces",
    title: "¿Cuántas personas necesitan trabajar o estudiar regularmente desde casa?",
    helpText: "No necesariamente crea oficinas; puede reservar espacios flexibles y tranquilos.",
    type: "number",
    required: true,
    min: 0,
    max: 10,
  },
  {
    id: "futureGrowthExpected",
    title: "¿Esperan que la familia o sus necesidades cambien en los próximos años?",
    helpText: "Activa criterios de crecimiento y habitaciones con usos alternativos.",
    type: "boolean",
    required: true,
  },
  {
    id: "incrementalConstruction",
    title: "¿La vivienda podría construirse o ampliarse por etapas?",
    helpText: "Ayuda a buscar una primera etapa funcional que no bloquee ampliaciones futuras.",
    type: "boolean",
    required: true,
  },
  {
    id: "accessibilityPriority",
    title: "¿Qué nivel de accesibilidad quieren priorizar desde el inicio?",
    helpText: "Puede reservar mejores recorridos, maniobra y acceso a espacios esenciales.",
    type: "single_choice",
    required: true,
    options: [
      { value: "standard", label: "Estándar" },
      { value: "enhanced", label: "Mejorada" },
      { value: "universal", label: "Universal" },
    ],
  },
  {
    id: "storagePriority",
    title: "¿Qué tan importante es contar con almacenamiento suficiente?",
    helpText: "Permite reservar capacidad de guardado sin convertir pasillos en almacenamiento residual.",
    type: "single_choice",
    required: true,
    options: [
      { value: "low", label: "Poco" },
      { value: "medium", label: "Moderado" },
      { value: "high", label: "Mucho" },
    ],
  },
  {
    id: "budgetSensitivity",
    title: "¿Qué tan importante es reducir el costo inicial de construcción?",
    helpText: "Una prioridad alta favorece compacidad constructiva, menos perímetro y crecimiento por etapas.",
    type: "single_choice",
    required: true,
    options: [
      { value: "low", label: "No es la principal prioridad" },
      { value: "medium", label: "Debe mantenerse controlado" },
      { value: "high", label: "Es una prioridad crítica" },
    ],
  },
  {
    id: "familyNarrative",
    title: "¿Hay algo importante sobre cómo vive tu familia que no hayamos preguntado?",
    helpText: "Opcional. Por ejemplo: independencia de un adulto mayor, supervisión de niños, mascotas, horarios o actividades especiales. Solo se analizará con IA cuando aporte información adicional.",
    type: "text",
    required: false,
    maxLength: 800,
  },
];

function asNumber(
  value: string | number | boolean | undefined,
  min: number,
  max: number,
  fallback: number
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function asBoolean(value: string | number | boolean | undefined): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true" || value === "yes";
  return Boolean(value);
}

function asChoice<T extends string>(
  value: string | number | boolean | undefined,
  allowed: readonly T[],
  fallback: T
): T {
  const parsed = String(value ?? "") as T;
  return allowed.includes(parsed) ? parsed : fallback;
}

export function buildHouseholdDesignProfile(
  answers: HouseholdQuestionnaireAnswers
): HouseholdDesignProfile {
  return {
    householdSize: asNumber(answers.householdSize, 1, 20, 4),
    householdType: asChoice(
      answers.householdType,
      ["single", "couple", "family", "multigenerational", "shared"] as const,
      "family"
    ),
    privacyPriority: asChoice(
      answers.privacyPriority,
      ["low", "medium", "high"] as const,
      "medium"
    ),
    socialLivingPriority: asChoice(
      answers.socialLivingPriority,
      ["low", "medium", "high"] as const,
      "medium"
    ),
    remoteWorkSpaces: asNumber(answers.remoteWorkSpaces, 0, 10, 0),
    frequentVisitors: asBoolean(answers.frequentVisitors),
    futureGrowthExpected: asBoolean(answers.futureGrowthExpected),
    incrementalConstruction: asBoolean(answers.incrementalConstruction),
    accessibilityPriority: asChoice(
      answers.accessibilityPriority,
      ["standard", "enhanced", "universal"] as const,
      "standard"
    ),
    cookingIntensity: asChoice(
      answers.cookingIntensity,
      ["low", "medium", "high"] as const,
      "medium"
    ),
    storagePriority: asChoice(
      answers.storagePriority,
      ["low", "medium", "high"] as const,
      "medium"
    ),
    budgetSensitivity: asChoice(
      answers.budgetSensitivity,
      ["low", "medium", "high"] as const,
      "medium"
    ),
  };
}

export function getFamilyNarrative(answers: HouseholdQuestionnaireAnswers): string {
  return String(answers.familyNarrative ?? "").trim().slice(0, 800);
}
