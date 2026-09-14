/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from "react";
import { Room, RoomType, Terrain } from "../types";
import { 
  Sparkles, 
  Home, 
  Layers, 
  Compass, 
  Plus, 
  Trash2, 
  ArrowLeft,
  ArrowRight,
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Info, 
  BookOpen, 
  FileSpreadsheet,
  Settings,
  Zap
} from "lucide-react";
import { validateFloorPlanRNE, getRoomBimMetadata, getComponentBimMetadata } from "../utils/validators";

interface EditorSidebarProps {
  rooms: Room[];
  terrain: Terrain;
  selectedRoomId: string | null;
  onUpdateTerrain: (terrain: Terrain) => void;
  onSelectRoom: (roomId: string | null) => void;
  onAddRoom: (room: Room) => void;
  onDeleteRoom: (roomId: string) => void;
  onUpdateRoom: (room: Room) => void;
  onGeneratePlanWithAI: (prompt: string, metadata?: any) => Promise<void> | void;
  aiLoading: boolean;
  onResolveCollisions?: () => void;
}

type TabType = "design" | "rne" | "bim";

export default function EditorSidebar({
  rooms,
  terrain,
  selectedRoomId,
  onUpdateTerrain,
  onSelectRoom,
  onAddRoom,
  onDeleteRoom,
  onUpdateRoom,
  onGeneratePlanWithAI,
  aiLoading,
  onResolveCollisions,
}: EditorSidebarProps) {
  // Sidebar Tabs State
  const [activeTab, setActiveTab] = useState<TabType>("design");

  // Reset wizard to Step 1 when AI loading finishes
  useEffect(() => {
    if (!aiLoading) {
      setWizardStep(1);
    }
  }, [aiLoading]);

  // Wizard States for Sequential Floorplan Generation
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [bedroomsCount, setBedroomsCount] = useState<number>(3);
  const [bathroomsCount, setBathroomsCount] = useState<number>(2);
  const [kitchenStyle, setKitchenStyle] = useState<"abierta" | "cerrada">("abierta");
  const [layoutStyle, setLayoutStyle] = useState<string>("moderna");
  
  // Extra space triggers
  const [hasGarage, setHasGarage] = useState<boolean>(true);
  const [hasStudio, setHasStudio] = useState<boolean>(false);
  const [hasLaundry, setHasLaundry] = useState<boolean>(true);
  const [hasGarden, setHasGarden] = useState<boolean>(true);

  // Additional prompt text area
  const [additionalNotes, setAdditionalNotes] = useState<string>("");

  // New Room Form State
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomType, setNewRoomType] = useState<RoomType>("bedroom");
  const [newRoomW, setNewRoomW] = useState(3.5);
  const [newRoomH, setNewRoomH] = useState(3.5);
  const [newRoomConns, setNewRoomConns] = useState<string[]>([]);

  // AI Prompt State
  const [aiPrompt, setAiPrompt] = useState(
    "Casa familiar de una planta, 3 dormitorios, el principal con baño incorporado, sala comedor amplia conectada a terraza, cocina con lavandería"
  );

  // Suggested Prompts
  const suggestions = [
    {
      title: "☀️ Añadir más luz natural",
      prompt: "Diseñar con ventanales amplios y patios de luz para añadir más luz natural indirecta y ventilación cruzada en dormitorios y áreas sociales.",
    },
    {
      title: "🔄 Optimizar circulación",
      prompt: "Optimizar circulación distribuyendo los ambientes de forma fluida, agrupando zonas húmedas y conectando dormitorios a través de un pasillo distribuidor corto.",
    },
    {
      title: "🛋️ Ampliar zona de estar",
      prompt: "Ampliar zona de estar unificando la sala, el comedor y la cocina en un concepto abierto y despejado de amplias dimensiones.",
    },
    {
      title: "🏠 Loft de Soltero",
      prompt: "Estudio loft moderno monoambiente, sala-cocina abierta, baño separado, dormitorio integrado con armario, terraza compacta.",
    },
    {
      title: "🏖️ Casa de Playa",
      prompt: "Casa de playa de un piso, 2 dormitorios amplios con baño privado cada uno, gran sala comedor social integrada con la cocina americana, cochera.",
    },
  ];

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  // Calculate Real-time compliance report using our validator
  const complianceReport = validateFloorPlanRNE(rooms, terrain);

  // Handle Adding new Room
  const handleAddRoomSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    const colors: Record<RoomType, string> = {
      living: "#FEF3C7", // amber
      bedroom: "#DBEAFE", // blue
      bathroom: "#E0F2FE", // sky
      kitchen: "#FEE2E2", // red
      dining: "#FEF3C7",
      corridor: "#F3F4F6", // gray
      garage: "#E5E7EB",
      laundry: "#ECEFfc",
      other: "#F5F5F5",
    };

    const newRoom: Room = {
      id: `room_${Date.now()}`,
      name: newRoomName,
      type: newRoomType,
      x: terrain.width / 2 + (Math.random() - 0.5) * 2,
      y: terrain.length / 2 + (Math.random() - 0.5) * 2,
      w: newRoomW,
      h: newRoomH,
      targetW: newRoomW,
      targetH: newRoomH,
      color: colors[newRoomType],
      connections: newRoomConns,
      openings: [
        {
          id: `door_${Date.now()}`,
          type: "door",
          side: "bottom",
          offset: 0.5,
          width: 0.9,
        },
      ],
      furniture: [],
    };

    onAddRoom(newRoom);
    // Reset Form
    setNewRoomName("");
    setNewRoomConns([]);
  };

  // Toggle connection on active room
  const handleToggleConnection = (targetId: string) => {
    if (!selectedRoom) return;
    const isConn = selectedRoom.connections.includes(targetId);
    const updatedConns = isConn
      ? selectedRoom.connections.filter((id) => id !== targetId)
      : [...selectedRoom.connections, targetId];

    onUpdateRoom({
      ...selectedRoom,
      connections: updatedConns,
    });
  };

  return (
    <div className="w-full flex flex-col gap-5" id="editor-sidebar-container">
      
      {/* PESTAÑAS DE CONTROL SUPERIOR */}
      <div className="flex border-b border-slate-200 bg-slate-50/80 p-1 rounded-xl">
        <button
          id="tab-design-btn"
          onClick={() => setActiveTab("design")}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === "design"
              ? "bg-white text-indigo-950 shadow-xs"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Settings className="w-3.5 h-3.5" /> Diseño
        </button>
        <button
          id="tab-rne-btn"
          onClick={() => setActiveTab("rne")}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
            activeTab === "rne"
              ? "bg-white text-emerald-950 shadow-xs"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" /> RNE (Normativa)
          {complianceReport.overallStatus === "fail" && (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block" />
          )}
        </button>
        <button
          id="tab-bim-btn"
          onClick={() => setActiveTab("bim")}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === "bim"
              ? "bg-white text-sky-950 shadow-xs"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" /> Estándar BIM
        </button>
      </div>

      {/* RENDERIZADO CONDICIONAL DE CONTENIDO DE PESTAÑAS */}

      {activeTab === "design" && (
        <div className="flex flex-col gap-6 animate-fade-in">
          {/* INTRODUCCIÓN Y WIZARD DE GENERACIÓN SECUENCIAL */}
          <div className="bg-gradient-to-br from-indigo-950 to-slate-900 text-white rounded-2xl p-4 shadow-md border border-indigo-900/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
            <h3 className="text-sm font-bold text-indigo-200 flex items-center gap-2 mb-1.5">
              <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" /> Generador Asistido de Planta
            </h3>
            <p className="text-[11px] text-indigo-200/80 mb-3.5 leading-relaxed">
              Diseña secuencialmente tu vivienda. Definiremos el terreno, tus necesidades espaciales, y la IA resolverá la arquitectura ideal.
            </p>

            {/* STEP PROGRESS INDICATORS */}
            <div className="flex items-center justify-between bg-slate-900/60 rounded-xl p-2 border border-slate-800/80 mb-4 select-none">
              <div className="flex items-center gap-1">
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${wizardStep >= 1 ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}`}>1</span>
                <span className={`text-[10px] font-bold ${wizardStep === 1 ? 'text-indigo-300' : 'text-slate-400'}`}>Terreno</span>
              </div>
              <div className="h-px flex-1 bg-slate-800 mx-1.5" />
              <div className="flex items-center gap-1">
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${wizardStep >= 2 ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}`}>2</span>
                <span className={`text-[10px] font-bold ${wizardStep === 2 ? 'text-indigo-300' : 'text-slate-400'}`}>Espacios</span>
              </div>
              <div className="h-px flex-1 bg-slate-800 mx-1.5" />
              <div className="flex items-center gap-1">
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${wizardStep >= 3 ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}`}>3</span>
                <span className={`text-[10px] font-bold ${wizardStep === 3 ? 'text-indigo-300' : 'text-slate-400'}`}>Crear</span>
              </div>
            </div>

            {/* WIZARD CONTENT BOX */}
            <div className="bg-slate-900/40 rounded-xl p-3 border border-slate-800/40 min-h-[180px]">
              
              {/* PASO 1: DIMENSIONES DEL TERRENO */}
              {wizardStep === 1 && (
                <div className="flex flex-col gap-3.5 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wide">Paso 1: Dimensión del Lote</span>
                    <span className="text-[10px] font-mono text-indigo-400">{terrain.width}m x {terrain.length}m</span>
                  </div>

                  {/* Preset Selector */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Presets Rápidos (Moverá el terreno):</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { label: "8x15m Chico", w: 8, l: 15 },
                        { label: "10x18m Medio", w: 10, l: 18 },
                        { label: "12x20m Amplio", w: 12, l: 20 }
                      ].map((preset, idx) => (
                        <button
                          key={idx}
                          id={`wizard-preset-${idx}`}
                          type="button"
                          onClick={() => onUpdateTerrain({ ...terrain, width: preset.w, length: preset.l })}
                          className={`px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all text-center cursor-pointer ${
                            terrain.width === preset.w && terrain.length === preset.l
                              ? 'bg-indigo-600 text-white border border-indigo-500 shadow-md'
                              : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/50'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Manual Inputs */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Ancho (X)</label>
                      <input
                        id="wizard-width-input"
                        type="number"
                        step="0.5"
                        min="5"
                        max="30"
                        value={terrain.width}
                        onChange={(e) => onUpdateTerrain({ ...terrain, width: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-850 border border-slate-700 rounded-lg font-medium text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Largo (Y)</label>
                      <input
                        id="wizard-length-input"
                        type="number"
                        step="0.5"
                        min="5"
                        max="40"
                        value={terrain.length}
                        onChange={(e) => onUpdateTerrain({ ...terrain, length: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-850 border border-slate-700 rounded-lg font-medium text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Setbacks and Wall toggles */}
                  <div className="border-t border-slate-800/80 pt-2.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-300 font-semibold">Muro Perimétrico</span>
                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input
                          id="wizard-wall-toggle"
                          type="checkbox"
                          checked={!!terrain.hasPerimeterWall}
                          onChange={(e) => onUpdateTerrain({ ...terrain, hasPerimeterWall: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-500"></div>
                      </label>
                    </div>

                    <div className="grid grid-cols-4 gap-1 text-center">
                      <div>
                        <span className="block text-[8px] text-slate-500 uppercase">Retiro Front</span>
                        <input
                          type="number"
                          step="0.5"
                          value={terrain.setbackFront}
                          onChange={(e) => onUpdateTerrain({ ...terrain, setbackFront: Number(e.target.value) })}
                          className="w-full bg-slate-850 border border-slate-700 text-white rounded text-[10px] py-0.5 text-center"
                        />
                      </div>
                      <div>
                        <span className="block text-[8px] text-slate-500 uppercase">Retiro Tras</span>
                        <input
                          type="number"
                          step="0.5"
                          value={terrain.setbackBack}
                          onChange={(e) => onUpdateTerrain({ ...terrain, setbackBack: Number(e.target.value) })}
                          className="w-full bg-slate-850 border border-slate-700 text-white rounded text-[10px] py-0.5 text-center"
                        />
                      </div>
                      <div>
                        <span className="block text-[8px] text-slate-500 uppercase">Retiro Izq</span>
                        <input
                          type="number"
                          step="0.5"
                          value={terrain.setbackLeft}
                          onChange={(e) => onUpdateTerrain({ ...terrain, setbackLeft: Number(e.target.value) })}
                          className="w-full bg-slate-850 border border-slate-700 text-white rounded text-[10px] py-0.5 text-center"
                        />
                      </div>
                      <div>
                        <span className="block text-[8px] text-slate-500 uppercase">Retiro Der</span>
                        <input
                          type="number"
                          step="0.5"
                          value={terrain.setbackRight}
                          onChange={(e) => onUpdateTerrain({ ...terrain, setbackRight: Number(e.target.value) })}
                          className="w-full bg-slate-850 border border-slate-700 text-white rounded text-[10px] py-0.5 text-center"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    id="wizard-step1-next-btn"
                    type="button"
                    onClick={() => setWizardStep(2)}
                    className="mt-1 w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    Siguiente: Requisitos <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* PASO 2: REQUISITOS ESPACIALES Y FUNCIONALES */}
              {wizardStep === 2 && (
                <div className="flex flex-col gap-3.5 animate-fade-in">
                  <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wide">Paso 2: Programa Arquitectónico</span>

                  {/* Dormitorios Count */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-300">Dormitorios:</span>
                    <div className="flex bg-slate-800 rounded-lg p-0.5">
                      {[1, 2, 3, 4].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setBedroomsCount(num)}
                          className={`w-7 h-5.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                            bedroomsCount === num ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Baños Count */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-300">Baños:</span>
                    <div className="flex bg-slate-800 rounded-lg p-0.5">
                      {[1, 2, 3].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setBathroomsCount(num)}
                          className={`w-7 h-5.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                            bathroomsCount === num ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cocina Style */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-300">Cocina:</span>
                    <div className="flex bg-slate-800 rounded-lg p-0.5">
                      {[
                        { label: "Abierta", val: "abierta" as const },
                        { label: "Cerrada", val: "cerrada" as const }
                      ].map((item) => (
                        <button
                          key={item.val}
                          type="button"
                          onClick={() => setKitchenStyle(item.val)}
                          className={`px-2.5 h-5.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                            kitchenStyle === item.val ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Extras Section */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Espacios Opcionales:</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setHasGarage(!hasGarage)}
                        className={`px-2 py-1 rounded-lg text-[9px] font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                          hasGarage ? 'bg-indigo-900/40 border-indigo-500 text-indigo-300' : 'bg-slate-800/40 border-slate-800 text-slate-400'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${hasGarage ? 'bg-indigo-400 animate-pulse' : 'bg-slate-600'}`} /> Cochera Frontal
                      </button>
                      <button
                        type="button"
                        onClick={() => setHasStudio(!hasStudio)}
                        className={`px-2 py-1 rounded-lg text-[9px] font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                          hasStudio ? 'bg-indigo-900/40 border-indigo-500 text-indigo-300' : 'bg-slate-800/40 border-slate-800 text-slate-400'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${hasStudio ? 'bg-indigo-400 animate-pulse' : 'bg-slate-600'}`} /> Oficina / Estudio
                      </button>
                      <button
                        type="button"
                        onClick={() => setHasLaundry(!hasLaundry)}
                        className={`px-2 py-1 rounded-lg text-[9px] font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                          hasLaundry ? 'bg-indigo-900/40 border-indigo-500 text-indigo-300' : 'bg-slate-800/40 border-slate-800 text-slate-400'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${hasLaundry ? 'bg-indigo-400 animate-pulse' : 'bg-slate-600'}`} /> Lavandería
                      </button>
                      <button
                        type="button"
                        onClick={() => setHasGarden(!hasGarden)}
                        className={`px-2 py-1 rounded-lg text-[9px] font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                          hasGarden ? 'bg-indigo-900/40 border-indigo-500 text-indigo-300' : 'bg-slate-800/40 border-slate-800 text-slate-400'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${hasGarden ? 'bg-indigo-400 animate-pulse' : 'bg-slate-600'}`} /> Patio / Luz Int.
                      </button>
                    </div>
                  </div>

                  {/* Navigation Buttons */}
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setWizardStep(1)}
                      className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Atrás
                    </button>
                    <button
                      type="button"
                      onClick={() => setWizardStep(3)}
                      className="py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer"
                    >
                      Siguiente <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* PASO 3: CONFIRMACIÓN Y GENERACIÓN */}
              {wizardStep === 3 && (
                <div className="flex flex-col gap-3 animate-fade-in">
                  <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wide">Paso 3: Estilo y Generación IA</span>

                  {/* Style selector */}
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Estilo Arquitectónico:</label>
                    <select
                      id="wizard-style-select"
                      value={layoutStyle}
                      onChange={(e) => setLayoutStyle(e.target.value)}
                      className="w-full bg-slate-850 border border-slate-700 text-white rounded-lg text-xs py-1.5 px-2.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="moderna">Moderno Contemporáneo (Elegante)</option>
                      <option value="minimalista">Minimalista de Concepto Abierto</option>
                      <option value="loft">Loft Urbano Compacto</option>
                      <option value="rustica">Casa de Campo Rústica</option>
                    </select>
                  </div>

                  {/* Custom Additional Notes Input */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase">Ajustes / Requisitos Adicionales:</label>
                      <span className="text-[8px] text-slate-500 italic">Opcional</span>
                    </div>
                    <textarea
                      id="wizard-notes-input"
                      value={additionalNotes}
                      onChange={(e) => setAdditionalNotes(e.target.value)}
                      placeholder="Ej: Añadir ventanales grandes, optimizar iluminación natural..."
                      className="w-full h-14 bg-slate-850 border border-slate-700 rounded-lg text-xs p-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none font-medium"
                      disabled={aiLoading}
                    />
                  </div>

                  {/* Quick Suggestions tags to auto-populate */}
                  <div className="flex flex-wrap gap-1">
                    {[
                      { title: "☀️ Más luz natural", text: "Diseñar con ventanales amplios y patios de luz para añadir más luz natural indirecta." },
                      { title: "🔄 Optimizar flujos", text: "Optimizar circulación interna distribuyendo los ambientes de forma fluida para evitar pasillos ciegos." },
                      { title: "🛋️ Concepto abierto", text: "Ampliar zona de estar unificando la sala, el comedor y la cocina en un espacio abierto." }
                    ].map((sug, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setAdditionalNotes(sug.text)}
                        className="px-1.5 py-0.5 bg-slate-800/60 hover:bg-slate-800 text-[8px] text-indigo-300 rounded border border-indigo-900/50 hover:border-indigo-500 transition-all cursor-pointer"
                      >
                        💡 {sug.title}
                      </button>
                    ))}
                  </div>

                  {/* Action buttons */}
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setWizardStep(2)}
                      className="col-span-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer"
                      disabled={aiLoading}
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Atrás
                    </button>

                    <button
                      id="ai-generate-submit-btn"
                      type="button"
                      onClick={() => {
                        // Dynamically synthesize a perfectly detailed prompt incorporating the Hall connection requirement
                        const listExtras = [];
                        if (hasGarage) listExtras.push("cochera frontal con portón");
                        if (hasStudio) listExtras.push("estudio/oficina de trabajo independiente");
                        if (hasLaundry) listExtras.push("área de lavandería independiente");
                        if (hasGarden) listExtras.push("patio interior o jardín para ventilación y luz");

                        const extrasStr = listExtras.length > 0 ? `Adicionalmente debe incluir: ${listExtras.join(", ")}.` : "";
                        
                        // User requirement: "el hall distribuidor , debe conectar a todos los espacios"
                        const hallInstruction = "CRÍTICO: El plano de distribución DEBE incorporar un Hall Distribuidor (pasillo central) principal que conecte directamente a todos los ambientes de la vivienda (Sala de Estar, Cocina, Dormitorios y Baño Común), asegurando un flujo de circulación limpio y optimizado, sin dormitorios de paso ni espacios aislados.";

                        const compiledPrompt = `Diseñar una vivienda unifamiliar de un solo piso de estilo ${layoutStyle} sobre un terreno de dimensiones ${terrain.width}x${terrain.length} metros con retiros de setbacks. El programa arquitectónico consta de:
- ${bedroomsCount} dormitorios confortables (el principal con baño en suite incorporado).
- ${bathroomsCount} baños completos en total.
- Cocina de concepto ${kitchenStyle === "abierta" ? "abierto americano integrado a la sala comedor" : "cerrado tradicional con muros"}.
- Sala y comedor amplios y luminosos.
${extrasStr}

${hallInstruction}

Requisitos del usuario: ${additionalNotes || "Optimizar la circulación interna, garantizar excelente ventilación cruzada y abundante iluminación indirecta."}`;

                        onGeneratePlanWithAI(compiledPrompt, {
                          bedroomsCount,
                          bathroomsCount,
                          kitchenStyle,
                          hasGarage,
                          hasStudio,
                          hasLaundry,
                          hasGarden,
                          layoutStyle
                        });
                      }}
                      disabled={aiLoading}
                      className="col-span-2 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1 shadow-md shadow-indigo-900/20 cursor-pointer"
                    >
                      {aiLoading ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Generando...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-indigo-200 fill-indigo-200" /> Generar con IA
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* 3. INSPECTOR DE AMBIENTE SELECCIONADO */}
          {selectedRoom ? (
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 shadow-xs">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-2">
                  <Home className="w-4 h-4 text-indigo-600" /> Editor de Ambiente
                </h3>
                <button
                  id="delete-room-btn"
                  onClick={() => {
                    onDeleteRoom(selectedRoom.id);
                    onSelectRoom(null);
                  }}
                  className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                  title="Eliminar Habitación"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Form details */}
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Nombre</label>
                  <input
                    id="edit-room-name-input"
                    type="text"
                    value={selectedRoom.name}
                    onChange={(e) => onUpdateRoom({ ...selectedRoom, name: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Ancho (X)</label>
                    <input
                      id="edit-room-width-input"
                      type="number"
                      step="0.1"
                      min="1"
                      value={selectedRoom.w}
                      onChange={(e) =>
                        onUpdateRoom({
                          ...selectedRoom,
                          w: Number(e.target.value),
                          targetW: Number(e.target.value),
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Largo (Y)</label>
                    <input
                      id="edit-room-length-input"
                      type="number"
                      step="0.1"
                      min="1"
                      value={selectedRoom.h}
                      onChange={(e) =>
                        onUpdateRoom({
                          ...selectedRoom,
                          h: Number(e.target.value),
                          targetH: Number(e.target.value),
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Ubicación (m)</label>
                  <div className="grid grid-cols-2 gap-2 text-slate-500 text-xs font-semibold">
                    <span className="bg-slate-100/50 p-2 rounded-lg">X: {selectedRoom.x.toFixed(1)}m</span>
                    <span className="bg-slate-100/50 p-2 rounded-lg">Y: {selectedRoom.y.toFixed(1)}m</span>
                  </div>
                </div>

                {/* Magnetic Attractions (Adjacencies) */}
                <div className="border-t border-slate-100 pt-3">
                  <span className="block text-[10px] font-bold text-indigo-900 mb-2 uppercase">Atracciones Magnéticas:</span>
                  <p className="text-[10px] text-slate-500 mb-2">Marca otros ambientes para forzar que el magnetizador los pegue a este ambiente:</p>
                  
                  <div className="max-h-36 overflow-y-auto border border-indigo-50 rounded-lg p-2 bg-white flex flex-col gap-1">
                    {rooms
                      .filter((r) => r.id !== selectedRoom.id)
                      .map((r) => {
                        const isConnected = selectedRoom.connections.includes(r.id);
                        return (
                          <button
                            key={r.id}
                            id={`toggle-conn-${r.id}`}
                            onClick={() => handleToggleConnection(r.id)}
                            className={`px-2 py-1 text-xs rounded-lg transition-all text-left flex items-center justify-between ${
                              isConnected
                                ? "bg-indigo-600 text-white"
                                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            <span>{r.name}</span>
                            {isConnected && <ArrowRight className="w-3 h-3" />}
                          </button>
                        );
                      })}
                    {rooms.length <= 1 && (
                      <span className="text-[10px] text-slate-400 text-center py-2">Agrega más ambientes para conectar.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* 4. AGREGAR NUEVO AMBIENTE MANUALMENTE */
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-3">
                <Plus className="w-4 h-4 text-slate-500" /> Añadir Ambiente Manual
              </h3>

              <form onSubmit={handleAddRoomSubmit} className="flex flex-col gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Nombre del Ambiente</label>
                  <input
                    id="add-room-name-input"
                    type="text"
                    placeholder="Ej: Dormitorio, Baño, Terraza..."
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-950"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Tipo de Ambiente</label>
                    <select
                      id="add-room-type-select"
                      value={newRoomType}
                      onChange={(e) => setNewRoomType(e.target.value as RoomType)}
                      className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                    >
                      <option value="bedroom">🛏️ Dormitorio</option>
                      <option value="living">🛋️ Sala</option>
                      <option value="dining">🍽️ Comedor</option>
                      <option value="kitchen">🍳 Cocina</option>
                      <option value="bathroom">🚿 Baño</option>
                      <option value="corridor">🚪 Pasillo / Hall</option>
                      <option value="garage">🚗 Garaje</option>
                      <option value="laundry">🧺 Lavandería</option>
                      <option value="other">📦 Otro</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Ancho</label>
                      <input
                        id="add-room-width-input"
                        type="number"
                        step="0.5"
                        min="1"
                        value={newRoomW}
                        onChange={(e) => setNewRoomW(Number(e.target.value))}
                        className="w-full px-1.5 py-1 text-center bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Largo</label>
                      <input
                        id="add-room-length-input"
                        type="number"
                        step="0.5"
                        min="1"
                        value={newRoomH}
                        onChange={(e) => setNewRoomH(Number(e.target.value))}
                        className="w-full px-1.5 py-1 text-center bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>

                <button
                  id="add-room-submit-btn"
                  type="submit"
                  className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Añadir al Terreno
                </button>
              </form>
            </div>
          )}

          {/* 5. RESUMEN PROGRAMA GLOBAL */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-xs">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-2">
              <Layers className="w-4 h-4 text-slate-500" /> Resumen de Distribución
            </h3>
            <div className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              <div className="flex justify-between">
                <span>Ambientes Totales:</span>
                <span className="text-slate-800">{rooms.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Área Construida:</span>
                <span className="text-slate-800">
                  {rooms.reduce((acc, r) => acc + r.w * r.h, 0).toFixed(1)} m²
                </span>
              </div>
              <div className="flex justify-between">
                <span>Área Máxima Terreno:</span>
                <span className="text-slate-800">{(terrain.width * terrain.length).toFixed(1)} m²</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RENDERIZADO: REGLAMENTO NACIONAL DE EDIFICACIONES (RNE) */}
      {activeTab === "rne" && (
        <div className="flex flex-col gap-4 animate-fade-in text-slate-800">
          
          {/* HEADER DE CUMPLIMIENTO */}
          <div className={`p-4 rounded-2xl border flex flex-col gap-2 ${
            complianceReport.overallStatus === "pass" 
              ? "bg-emerald-50 border-emerald-100 text-emerald-950" 
              : complianceReport.overallStatus === "warning"
                ? "bg-amber-50 border-amber-100 text-amber-950"
                : "bg-red-50 border-red-100 text-red-950"
          }`}>
            <div className="flex items-center gap-2">
              {complianceReport.overallStatus === "pass" && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
              {complianceReport.overallStatus === "warning" && <AlertTriangle className="w-5 h-5 text-amber-600" />}
              {complianceReport.overallStatus === "fail" && <XCircle className="w-5 h-5 text-red-600" />}
              
              <span className="font-bold text-sm">
                {complianceReport.overallStatus === "pass" && "Plano Conforme RNE"}
                {complianceReport.overallStatus === "warning" && "RNE con Observaciones"}
                {complianceReport.overallStatus === "fail" && "Infracciones detectadas al RNE"}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed opacity-90">
              Validación ergonómica y espacial en tiempo real según la <strong>Norma Técnica A.020 (Vivienda)</strong> del Reglamento de Edificaciones.
            </p>
          </div>

          {/* REGLAS GLOBALES */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Parámetros de Ocupación de Lote</h4>
            <div className="flex flex-col gap-3">
              {complianceReport.terrainRules.map((rule) => (
                <div key={rule.ruleId} className="flex flex-col border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-xs font-semibold text-slate-800">{rule.name}</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                      rule.status === "pass" 
                        ? "bg-emerald-100 text-emerald-800"
                        : rule.status === "warning"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-red-100 text-red-800"
                    }`}>
                      {rule.status === "pass" ? "OK" : rule.status === "warning" ? "OBS" : "CRÍTICO"}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{rule.description}</p>
                  <div className="grid grid-cols-2 gap-2 mt-1.5 bg-slate-50 p-1.5 rounded-lg text-[10px] font-medium text-slate-500">
                    <span>Requerido: <strong className="text-slate-700">{rule.requiredValue}</strong></span>
                    <span>Actual: <strong className="text-slate-700">{rule.currentValue}</strong></span>
                  </div>
                  {rule.ruleId === "RNE_ROOM_COLLISION" && rule.status !== "pass" && onResolveCollisions && (
                    <button
                      id="resolve-collisions-btn"
                      onClick={onResolveCollisions}
                      className="mt-2 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Separa automáticamente los ambientes solapados"
                    >
                      <Zap className="w-3.5 h-3.5 text-indigo-200 fill-indigo-200" /> Resolver Solapamiento de Muros
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* CUMPLIMIENTO POR HABITACIÓN */}
          <div className="flex flex-col gap-3">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Validación por Ambiente</h4>
            
            {rooms.length === 0 ? (
              <div className="text-center py-6 bg-white border border-slate-200 rounded-2xl text-slate-400 text-xs">
                No hay ambientes que validar en el plano.
              </div>
            ) : (
              complianceReport.roomReports.map((report) => (
                <div key={report.roomId} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  {/* Cabecera del ambiente */}
                  <div className={`px-3 py-2 border-b flex justify-between items-center ${
                    report.overallStatus === "pass" 
                      ? "bg-emerald-50/20 border-slate-100" 
                      : report.overallStatus === "warning"
                        ? "bg-amber-50/20 border-slate-100"
                        : "bg-red-50/20 border-slate-100"
                  }`}>
                    <span className="text-xs font-bold text-slate-800">{report.roomName}</span>
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      report.overallStatus === "pass" ? "bg-emerald-500" : report.overallStatus === "warning" ? "bg-amber-500" : "bg-red-500"
                    }`} title={report.overallStatus.toUpperCase()} />
                  </div>

                  {/* Detalle de reglas del ambiente */}
                  <div className="p-3 flex flex-col gap-2.5">
                    {report.rules.map((rule, idx) => (
                      <div key={idx} className="text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              rule.status === "pass" ? "bg-emerald-500" : rule.status === "warning" ? "bg-amber-500" : "bg-red-500"
                            }`} />
                            {rule.name}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{rule.description}</p>
                        <div className="flex gap-4 mt-1 text-[10px] text-slate-400">
                          <span>Requerido: <strong className="text-slate-600 font-semibold">{rule.requiredValue}</strong></span>
                          <span>Actual: <strong className="text-slate-600 font-semibold">{rule.currentValue}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* RENDERIZADO: ESTÁNDAR PLAN BIM CHILE */}
      {activeTab === "bim" && (
        <div className="flex flex-col gap-4 animate-fade-in text-slate-800">
          
          {/* BANNER PLAN BIM CHILE */}
          <div className="bg-sky-50 border border-sky-100 p-4 rounded-2xl text-sky-950 flex flex-col gap-2">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-sky-600" /> Estándar Plan BIM Chile
            </h3>
            <p className="text-[11px] leading-relaxed opacity-95">
              Clasificación y estructuración semántica de componentes de acuerdo al estándar nacional para proyectos públicos e interoperabilidad <strong>IFC (Industry Foundation Classes)</strong>.
            </p>
          </div>

          {/* PARÁMETROS BIM DE ESPACIOS */}
          <div className="flex flex-col gap-3">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Clasificación IfcSpace (Ambientes)</h4>
            
            {rooms.length === 0 ? (
              <div className="text-center py-6 bg-white border border-slate-200 rounded-2xl text-slate-400 text-xs">
                No hay ambientes para clasificar.
              </div>
            ) : (
              rooms.map((room) => {
                const bim = getRoomBimMetadata(room);
                return (
                  <div key={room.id} className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-2">
                      <span className="text-xs font-bold text-slate-800">{room.name}</span>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-mono font-bold">{bim.ifcEntity}</span>
                    </div>

                    <div className="flex flex-col gap-1.5 text-[10px]">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Código de Zona BIM:</span>
                        <span className="font-mono font-semibold text-slate-700">{bim.bimCode}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Subtipo Normalizado:</span>
                        <span className="font-semibold text-slate-700">{bim.subType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Nivel de Información:</span>
                        <span className="font-semibold text-sky-700">{bim.ndi}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Capa de Exportación:</span>
                        <span className="font-mono text-emerald-600 font-semibold">{bim.layerName}</span>
                      </div>

                      {/* Parámetros Estructurados */}
                      <div className="mt-2 pt-2 border-t border-slate-50 flex flex-col gap-1 bg-slate-50 p-2 rounded-lg">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Set de Propiedades (Pset)</span>
                        {bim.parameters.map((p, idx) => (
                          <div key={idx} className="flex justify-between text-[9px]">
                            <span className="text-slate-500">{p.name}:</span>
                            <span className="font-semibold text-slate-700">{p.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* PARÁMETROS BIM DE COMPONENTES */}
          <div className="flex flex-col gap-3">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Componentes y Equipos en Modelo</h4>
            
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs text-xs flex flex-col gap-3">
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Cada abertura o mueble en la planta cuenta con identificadores únicos IFC que garantizan la compatibilidad al exportar a formatos abiertos CAD/BIM:
              </p>

              {/* Puertas */}
              <div className="flex items-start gap-2.5 pb-2 border-b border-slate-100">
                <span className="w-2 h-2 rounded-full bg-amber-500 mt-1.5" />
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="font-semibold text-slate-800">IfcDoor (Vanos Puertas)</span>
                    <span className="text-[9px] font-mono font-bold text-slate-400">BIM_COM_VANO_PUERTA</span>
                  </div>
                  <p className="text-[10px] text-slate-500">Capa: <code className="text-slate-700 bg-slate-50 px-1 rounded text-[9px]">BIM_A_Puertas</code> | Ancho libre estándar de evacuación: 0.90m.</p>
                </div>
              </div>

              {/* Ventanas */}
              <div className="flex items-start gap-2.5 pb-2 border-b border-slate-100">
                <span className="w-2 h-2 rounded-full bg-sky-500 mt-1.5" />
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="font-semibold text-slate-800">IfcWindow (Vanos Ventanas)</span>
                    <span className="text-[9px] font-mono font-bold text-slate-400">BIM_COM_VANO_VENTANA</span>
                  </div>
                  <p className="text-[10px] text-slate-500">Capa: <code className="text-slate-700 bg-slate-50 px-1 rounded text-[9px]">BIM_A_Ventanas</code> | Factor de iluminación natural calculado en tiempo real.</p>
                </div>
              </div>

              {/* Muebles */}
              <div className="flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5" />
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="font-semibold text-slate-800">IfcFurnishingElement (Equipos)</span>
                    <span className="text-[9px] font-mono font-bold text-slate-400">BIM_MOB_EQUIP_*</span>
                  </div>
                  <p className="text-[10px] text-slate-500">Capa: <code className="text-slate-700 bg-slate-50 px-1 rounded text-[9px]">BIM_A_Mobiliario</code> | Camas, clósets, mesas y sanitarios en coordenadas locales.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
