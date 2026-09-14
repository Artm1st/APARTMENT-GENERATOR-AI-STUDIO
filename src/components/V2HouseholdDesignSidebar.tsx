import { useMemo, useState } from "react";
import { Home, Sparkles, Users, Shield, Heart, ChefHat, Laptop, Sprout, Accessibility, PiggyBank, Package, WandSparkles } from "lucide-react";
import type { Terrain } from "../types";
import type { HouseholdQuestionnaireAnswers } from "../domain/v2/householdQuestionnaire";

interface V2HouseholdDesignSidebarProps {
  terrain: Terrain;
  onUpdateTerrain: (terrain: Terrain) => void;
  onGeneratePlanWithAI: (prompt: string, metadata?: Record<string, unknown>) => Promise<void> | void;
  aiLoading: boolean;
}

type Level = "low" | "medium" | "high";
type AccessibilityLevel = "standard" | "enhanced" | "universal";
type HouseholdType = "single" | "couple" | "family" | "multigenerational" | "shared";

const levelOptions: Array<{ value: Level; label: string }> = [
  { value: "low", label: "Baja" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
];

const householdTypes: Array<{ value: HouseholdType; label: string }> = [
  { value: "single", label: "Una persona" },
  { value: "couple", label: "Pareja" },
  { value: "family", label: "Familia" },
  { value: "multigenerational", label: "Multigeneracional" },
  { value: "shared", label: "Compartida" },
];

function ChoiceButtons<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-lg border px-2 py-1.5 text-[9px] font-bold transition-all cursor-pointer ${
            value === option.value
              ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
              : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`w-full flex items-center justify-between rounded-xl border px-3 py-2 text-left transition-all cursor-pointer ${
        value ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-200"
      }`}
    >
      <span className="text-[10px] font-semibold text-slate-700">{label}</span>
      <span className={`text-[9px] font-black uppercase ${value ? "text-indigo-700" : "text-slate-400"}`}>
        {value ? "Sí" : "No"}
      </span>
    </button>
  );
}

export default function V2HouseholdDesignSidebar({
  terrain,
  onUpdateTerrain,
  onGeneratePlanWithAI,
  aiLoading,
}: V2HouseholdDesignSidebarProps) {
  const [householdSize, setHouseholdSize] = useState(4);
  const [householdType, setHouseholdType] = useState<HouseholdType>("family");
  const [privacyPriority, setPrivacyPriority] = useState<Level>("medium");
  const [socialLivingPriority, setSocialLivingPriority] = useState<Level>("high");
  const [frequentVisitors, setFrequentVisitors] = useState(true);
  const [cookingIntensity, setCookingIntensity] = useState<Level>("high");
  const [remoteWorkSpaces, setRemoteWorkSpaces] = useState(1);
  const [futureGrowthExpected, setFutureGrowthExpected] = useState(true);
  const [incrementalConstruction, setIncrementalConstruction] = useState(false);
  const [accessibilityPriority, setAccessibilityPriority] = useState<AccessibilityLevel>("standard");
  const [storagePriority, setStoragePriority] = useState<Level>("medium");
  const [budgetSensitivity, setBudgetSensitivity] = useState<Level>("medium");
  const [familyNarrative, setFamilyNarrative] = useState("");
  const [semanticMode, setSemanticMode] = useState(false);
  const [essentialNeeds, setEssentialNeeds] = useState("lavandería y espacio exterior");

  const householdAnswers = useMemo<HouseholdQuestionnaireAnswers>(() => ({
    householdSize,
    householdType,
    privacyPriority,
    socialLivingPriority,
    frequentVisitors,
    cookingIntensity,
    remoteWorkSpaces,
    futureGrowthExpected,
    incrementalConstruction,
    accessibilityPriority,
    storagePriority,
    budgetSensitivity,
    familyNarrative,
  }), [
    householdSize,
    householdType,
    privacyPriority,
    socialLivingPriority,
    frequentVisitors,
    cookingIntensity,
    remoteWorkSpaces,
    futureGrowthExpected,
    incrementalConstruction,
    accessibilityPriority,
    storagePriority,
    budgetSensitivity,
    familyNarrative,
  ]);

  const handleGenerate = () => {
    const profileText = [
      `Vivienda unifamiliar para ${householdSize} personas (${householdType}).`,
      `Privacidad ${privacyPriority}; convivencia social ${socialLivingPriority}; cocina ${cookingIntensity}.`,
      `${remoteWorkSpaces} persona(s) trabajan o estudian habitualmente desde casa.`,
      futureGrowthExpected ? "La vivienda debe admitir cambios familiares futuros." : "No se prioriza crecimiento familiar futuro.",
      incrementalConstruction ? "Se contempla construcción o ampliación por etapas." : "Se plantea construcción principalmente en una etapa.",
      `Accesibilidad ${accessibilityPriority}; almacenamiento ${storagePriority}; sensibilidad al costo ${budgetSensitivity}.`,
      frequentVisitors ? "La familia recibe visitas con frecuencia." : "La familia recibe pocas visitas.",
      essentialNeeds.trim() ? `Necesidades imprescindibles indicadas por la familia: ${essentialNeeds.trim()}.` : "",
      "Propón un programa arquitectónico doméstico básico y coherente con este perfil. No inventes requisitos normativos ni coordenadas.",
    ].filter(Boolean).join(" ");

    onGeneratePlanWithAI(profileText, {
      householdAnswers,
      semanticProfileMode: semanticMode ? "auto" : "off",
      householdFirst: true,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="bg-slate-950 text-white rounded-2xl p-4 border border-indigo-900/60 shadow-md">
        <div className="flex items-start gap-3 mb-3">
          <div className="p-2 bg-indigo-600 rounded-xl"><Users className="w-4 h-4" /></div>
          <div>
            <h3 className="text-sm font-extrabold text-indigo-100">Diseñar desde la familia</h3>
            <p className="text-[10px] text-slate-400 leading-relaxed mt-1">
              Primero entendemos cómo habitan. Después el motor propone y compara estrategias arquitectónicas.
            </p>
          </div>
        </div>
        <div className="rounded-xl bg-indigo-950/50 border border-indigo-900 px-3 py-2 text-[9px] text-indigo-200">
          El cuestionario estructurado se procesa localmente. La interpretación de texto libre con IA es opcional.
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4">
        <div className="flex items-center gap-2"><Home className="w-4 h-4 text-indigo-600" /><h4 className="text-xs font-extrabold text-slate-900">1. Lote</h4></div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[9px] font-bold text-slate-500">Ancho (m)
            <input type="number" min={3} step={0.5} value={terrain.width} onChange={(e) => onUpdateTerrain({ ...terrain, width: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-800" />
          </label>
          <label className="text-[9px] font-bold text-slate-500">Largo (m)
            <input type="number" min={3} step={0.5} value={terrain.length} onChange={(e) => onUpdateTerrain({ ...terrain, length: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-800" />
          </label>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {([
            ["Frente", "setbackFront"],
            ["Fondo", "setbackBack"],
            ["Izq.", "setbackLeft"],
            ["Der.", "setbackRight"],
          ] as const).map(([label, key]) => (
            <label key={key} className="text-[8px] font-bold text-slate-400">{label}
              <input type="number" min={0} step={0.5} value={terrain[key]} onChange={(e) => onUpdateTerrain({ ...terrain, [key]: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-slate-200 px-1.5 py-1 text-[10px] text-slate-700" />
            </label>
          ))}
        </div>
        <p className="text-[9px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">
          Los retiros son parámetros del proyecto/municipio, no valores genéricos del RNE.
        </p>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4">
        <div className="flex items-center gap-2"><Users className="w-4 h-4 text-indigo-600" /><h4 className="text-xs font-extrabold text-slate-900">2. Tu familia y forma de habitar</h4></div>

        <div>
          <label className="text-[10px] font-bold text-slate-700">¿Cuántas personas vivirán normalmente aquí?</label>
          <input type="number" min={1} max={20} value={householdSize} onChange={(e) => setHouseholdSize(Math.max(1, Number(e.target.value)))} className="mt-1.5 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs" />
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-700">¿Cómo está compuesto el hogar?</label>
          <div className="grid grid-cols-2 gap-1.5 mt-1.5">
            {householdTypes.map((option) => (
              <button key={option.value} type="button" onClick={() => setHouseholdType(option.value)} className={`rounded-lg border px-2 py-1.5 text-[9px] font-bold cursor-pointer ${householdType === option.value ? "bg-indigo-600 text-white border-indigo-500" : "bg-white text-slate-600 border-slate-200"}`}>{option.label}</button>
            ))}
          </div>
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-3">
          <div><div className="flex items-center gap-1.5 mb-1.5"><Shield className="w-3 h-3 text-slate-500" /><span className="text-[10px] font-bold text-slate-700">Privacidad frente a visitas y zonas sociales</span></div><ChoiceButtons value={privacyPriority} options={levelOptions} onChange={setPrivacyPriority} /></div>
          <div><div className="flex items-center gap-1.5 mb-1.5"><Heart className="w-3 h-3 text-slate-500" /><span className="text-[10px] font-bold text-slate-700">Importancia de convivir en espacios integrados</span></div><ChoiceButtons value={socialLivingPriority} options={levelOptions} onChange={setSocialLivingPriority} /></div>
          <div><div className="flex items-center gap-1.5 mb-1.5"><ChefHat className="w-3 h-3 text-slate-500" /><span className="text-[10px] font-bold text-slate-700">Importancia de la cocina en la vida diaria</span></div><ChoiceButtons value={cookingIntensity} options={levelOptions} onChange={setCookingIntensity} /></div>
        </div>

        <div className="space-y-2">
          <Toggle value={frequentVisitors} onChange={setFrequentVisitors} label="Recibimos visitas con frecuencia" />
          <Toggle value={futureGrowthExpected} onChange={setFutureGrowthExpected} label="Esperamos cambios o crecimiento familiar" />
          <Toggle value={incrementalConstruction} onChange={setIncrementalConstruction} label="Podríamos construir o ampliar por etapas" />
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-1"><Laptop className="w-3 h-3 text-slate-500" /><label className="text-[10px] font-bold text-slate-700">Personas que trabajan/estudian regularmente en casa</label></div>
          <input type="number" min={0} max={10} value={remoteWorkSpaces} onChange={(e) => setRemoteWorkSpaces(Math.max(0, Number(e.target.value)))} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs" />
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-1.5"><Accessibility className="w-3 h-3 text-slate-500" /><span className="text-[10px] font-bold text-slate-700">Accesibilidad a priorizar</span></div>
          <ChoiceButtons value={accessibilityPriority} options={[
            { value: "standard", label: "Estándar" },
            { value: "enhanced", label: "Mejorada" },
            { value: "universal", label: "Universal" },
          ]} onChange={setAccessibilityPriority} />
        </div>

        <div><div className="flex items-center gap-1.5 mb-1.5"><Package className="w-3 h-3 text-slate-500" /><span className="text-[10px] font-bold text-slate-700">Almacenamiento</span></div><ChoiceButtons value={storagePriority} options={levelOptions} onChange={setStoragePriority} /></div>
        <div><div className="flex items-center gap-1.5 mb-1.5"><PiggyBank className="w-3 h-3 text-slate-500" /><span className="text-[10px] font-bold text-slate-700">Prioridad de reducir costo inicial</span></div><ChoiceButtons value={budgetSensitivity} options={levelOptions} onChange={setBudgetSensitivity} /></div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2"><Sprout className="w-4 h-4 text-indigo-600" /><h4 className="text-xs font-extrabold text-slate-900">3. Necesidades y contexto</h4></div>
        <label className="text-[10px] font-bold text-slate-700">¿Hay algo imprescindible?
          <input value={essentialNeeds} onChange={(e) => setEssentialNeeds(e.target.value)} placeholder="Ej.: cochera, lavandería, patio, dormitorio en primer nivel" className="mt-1.5 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-normal" />
        </label>
        <label className="text-[10px] font-bold text-slate-700">Cuéntanos algo importante sobre cómo vive tu familia <span className="font-normal text-slate-400">(opcional)</span>
          <textarea maxLength={800} value={familyNarrative} onChange={(e) => setFamilyNarrative(e.target.value)} rows={4} placeholder="Ej.: mi mamá vive con nosotros pero necesita independencia; quiero ver a los niños desde la cocina..." className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-normal" />
        </label>
        <button type="button" onClick={() => setSemanticMode(!semanticMode)} className={`w-full rounded-xl border p-3 text-left cursor-pointer ${semanticMode ? "border-violet-300 bg-violet-50" : "border-slate-200 bg-slate-50"}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2"><WandSparkles className={`w-4 h-4 ${semanticMode ? "text-violet-600" : "text-slate-400"}`} /><div><div className="text-[10px] font-extrabold text-slate-800">Interpretar texto libre con IA</div><div className="text-[9px] text-slate-500 mt-0.5">Opcional · una llamada corta solo si el texto aporta información.</div></div></div>
            <span className={`text-[9px] font-black uppercase ${semanticMode ? "text-violet-700" : "text-slate-400"}`}>{semanticMode ? "Activado" : "Desactivado"}</span>
          </div>
        </button>
      </section>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={aiLoading}
        className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-4 py-3.5 font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-wait"
      >
        <Sparkles className={`w-4 h-4 ${aiLoading ? "animate-spin" : ""}`} />
        {aiLoading ? "Analizando familia y generando..." : "Generar 3 estrategias de vivienda"}
      </button>

      <p className="text-[9px] text-slate-400 text-center leading-relaxed px-2">
        Prediseño conceptual. El chequeo normativo es preliminar y no reemplaza el desarrollo profesional ni los parámetros municipales del proyecto.
      </p>
    </div>
  );
}
