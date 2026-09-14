/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Cpu, Eye, Layers, LayoutGrid, RotateCcw, Sparkles } from "lucide-react";
import type { PhysicsConfig, Room, Terrain } from "./types";
import FloorPlanCanvas from "./components/FloorPlanCanvas";
import ThreeDView from "./components/ThreeDView";
import EditorSidebar from "./components/EditorSidebar";
import V2HouseholdDesignSidebar from "./components/V2HouseholdDesignSidebar";
import MagnetizerControls from "./components/MagnetizerControls";
import { relaxRooms, snapAllToGrid } from "./utils/physics";
import { generateRandomLayout } from "./utils/generators";
import { INITIAL_PHYSICS_CONFIG, INITIAL_ROOMS, INITIAL_TERRAIN } from "./config/defaultProject";

type EngineMode = "legacy" | "v2";

interface V2Score {
  total: number;
  hardConstraintPass: boolean;
  adjacency: number;
  circulation: number;
  compactness: number;
  daylight: number;
  solarOrientation: number;
  privacy: number;
  areaEfficiency: number;
  structuralRegularity: number;
  zoning: number;
  issues: Array<{ code: string; severity: string; message: string; spaceIds: string[] }>;
}

interface V2StrategyInfo {
  id: string;
  title: string;
  description: string;
  suitability: number;
  reasons: string[];
  generated: number;
  valid: number;
}

interface V2CandidateOption {
  id: string;
  seed?: number;
  score?: V2Score;
  rooms: Room[];
  strategy?: V2StrategyInfo;
  topology?: {
    sharedBoundaryCount: number;
    exteriorBoundaryCount: number;
    openingCount: number;
  };
}

interface V2GenerationStats {
  generated: number;
  valid: number;
  returned: number;
  strategies?: string[];
  levels?: number;
}

export default function App() {
  const [rooms, setRooms] = useState<Room[]>(INITIAL_ROOMS);
  const [terrain, setTerrain] = useState<Terrain>(INITIAL_TERRAIN);
  const [physicsConfig, setPhysicsConfig] = useState<PhysicsConfig>(INITIAL_PHYSICS_CONFIG);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"2d" | "3d">("2d");
  const [activeFloor, setActiveFloor] = useState(0);
  const [planName, setPlanName] = useState("Vivienda Unifamiliar Compacta");
  const [engineMode, setEngineMode] = useState<EngineMode>("v2");
  const [v2Candidates, setV2Candidates] = useState<V2CandidateOption[]>([]);
  const [activeV2Candidate, setActiveV2Candidate] = useState(0);
  const [v2GenerationStats, setV2GenerationStats] = useState<V2GenerationStats | null>(null);
  const [v2BaseSeed, setV2BaseSeed] = useState<number | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const levelCount = Math.max(
    1,
    terrain.levels ?? 1,
    ...rooms.map((room) => (room.floor ?? 0) + 1)
  );
  const visibleRooms = useMemo(
    () => rooms.filter((room) => (room.floor ?? 0) === activeFloor),
    [rooms, activeFloor]
  );

  useEffect(() => {
    if (activeFloor >= levelCount) setActiveFloor(Math.max(0, levelCount - 1));
  }, [activeFloor, levelCount]);

  const handleUpdateVisibleRooms = (updatedFloorRooms: Room[]) => {
    const updatedById = new Map(updatedFloorRooms.map((room) => [room.id, room]));
    setRooms((previous) => previous.map((room) => updatedById.get(room.id) ?? room));
  };

  const handleResetAll = () => {
    try {
      const generated = generateRandomLayout();
      setRooms(generated.rooms.map((room) => ({ ...room, floor: room.floor ?? 0 })));
      setTerrain({ ...generated.terrain, entrySide: "front", northAngleDeg: 0, hemisphere: "south", levels: 1 });
      setPlanName(generated.planName);
    } catch {
      setRooms(INITIAL_ROOMS);
      setTerrain(INITIAL_TERRAIN);
      setPlanName("Vivienda Unifamiliar Compacta");
    }
    setPhysicsConfig(INITIAL_PHYSICS_CONFIG);
    setSelectedRoomId(null);
    setErrorMessage(null);
    setV2Candidates([]);
    setV2GenerationStats(null);
    setV2BaseSeed(null);
    setActiveV2Candidate(0);
    setActiveFloor(0);
    setShowResetConfirm(false);
  };

  useEffect(() => {
    if (!physicsConfig.running) return;

    let animFrameId: number;
    const tick = () => {
      setRooms((prevRooms) => relaxRooms(prevRooms, terrain, physicsConfig, null));
      animFrameId = requestAnimationFrame(tick);
    };

    animFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameId);
  }, [physicsConfig.running, terrain, physicsConfig]);

  const handleResolveCollisions = () => {
    let tempRooms = rooms.map((room) => ({ ...room }));
    const tempConfig: PhysicsConfig = {
      ...physicsConfig,
      gridSnap: false,
      repulsionStrength: 10,
      attractionStrength: 1.5,
      boundaryStrength: 5.5,
      corridorAlignment: 2,
    };

    for (let i = 0; i < 100; i++) {
      tempRooms = relaxRooms(tempRooms, terrain, tempConfig, null);
    }

    setRooms(snapAllToGrid(tempRooms, physicsConfig.gridSize));
  };

  const handleStepSimulation = () => {
    setRooms((prevRooms) => relaxRooms(prevRooms, terrain, physicsConfig, null));
  };

  const handleResetSimulation = () => {
    const centerX = terrain.width / 2;
    const centerY = terrain.length / 2;
    const resetRooms = rooms.map((room, index) => {
      const angle = (index / rooms.length) * Math.PI * 2;
      const radius = 1.5;
      return {
        ...room,
        x: Number((centerX + Math.cos(angle) * radius).toFixed(2)),
        y: Number((centerY + Math.sin(angle) * radius).toFixed(2)),
      };
    });
    setRooms(resetRooms);
  };

  const handleSnapToGrid = () => setRooms(snapAllToGrid(rooms, physicsConfig.gridSize));

  const handleAddRoom = (newRoom: Room) => {
    const room = { ...newRoom, floor: newRoom.floor ?? activeFloor };
    setRooms([...rooms, room]);
    setSelectedRoomId(room.id);
  };

  const handleDeleteRoom = (roomId: string) => {
    setRooms(rooms.filter((room) => room.id !== roomId));
    if (selectedRoomId === roomId) setSelectedRoomId(null);
  };

  const handleUpdateRoom = (updatedRoom: Room) => {
    setRooms(rooms.map((room) => (room.id === updatedRoom.id ? updatedRoom : room)));
  };

  const candidateTitle = (candidate: V2CandidateOption, index: number): string =>
    candidate.strategy?.title ?? `Alternativa ${String.fromCharCode(65 + index)}`;

  const applyV2Candidate = (index: number) => {
    const candidate = v2Candidates[index];
    if (!candidate) return;
    setActiveV2Candidate(index);
    setRooms(candidate.rooms);
    setSelectedRoomId(null);
    setActiveTab("2d");
    setActiveFloor(0);
    setPhysicsConfig((prev) => ({ ...prev, running: false }));
    const score = candidate.score?.total ?? 0;
    setPlanName(`${candidateTitle(candidate, index)} · ${score}/100`);
  };

  const changeEngineMode = (mode: EngineMode) => {
    setEngineMode(mode);
    setErrorMessage(null);
    setActiveFloor(0);
    setPhysicsConfig((prev) => ({ ...prev, running: false }));
    if (mode === "legacy") {
      setV2Candidates([]);
      setV2GenerationStats(null);
      setV2BaseSeed(null);
      setActiveV2Candidate(0);
    }
  };

  const handleGeneratePlanWithAI = async (promptText: string, metadata?: Record<string, unknown>) => {
    setAiLoading(true);
    setErrorMessage(null);

    try {
      const isV2 = engineMode === "v2";
      const endpoint = isV2 ? "/api/v2/generate-candidates" : "/api/generate-floorplan";
      const householdAnswers = isV2 ? metadata?.householdAnswers : undefined;
      const semanticProfileMode = isV2 ? metadata?.semanticProfileMode : undefined;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText,
          terrainWidth: terrain.width,
          terrainLength: terrain.length,
          setbackFront: terrain.setbackFront,
          setbackBack: terrain.setbackBack,
          setbackLeft: terrain.setbackLeft,
          setbackRight: terrain.setbackRight,
          entrySide: terrain.entrySide ?? "front",
          northAngleDeg: terrain.northAngleDeg ?? 0,
          hemisphere: terrain.hemisphere ?? "south",
          levels: terrain.levels ?? 1,
          candidateCount: isV2 ? 36 : undefined,
          householdAnswers,
          semanticProfileMode,
          metadata,
        }),
      });

      if (!response.ok) {
        let errMsg = "Fallo en la comunicación con el servidor de diseño.";
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          const errorData = await response.json();
          errMsg = errorData.error || errMsg;
        } else {
          const errorText = await response.text();
          errMsg = response.status === 504
            ? "La generación con IA tardó demasiado y la conexión expiró. Intenta nuevamente."
            : `Error del servidor (${response.status}): ${errorText.substring(0, 100)}`;
        }
        throw new Error(errMsg);
      }

      const data = await response.json();

      if (isV2) {
        if (!Array.isArray(data.candidates) || data.candidates.length === 0) {
          throw new Error("Engine v3 no devolvió alternativas de planta.");
        }

        const candidates = data.candidates as V2CandidateOption[];
        setV2Candidates(candidates);
        setV2GenerationStats(data.stats ?? null);
        setV2BaseSeed(Number.isFinite(Number(data.seed)) ? Number(data.seed) : null);
        setActiveV2Candidate(0);
        setRooms(candidates[0].rooms);
        setSelectedRoomId(null);
        setActiveTab("2d");
        setActiveFloor(0);
        setPhysicsConfig((prev) => ({ ...prev, running: false }));
        const score = candidates[0].score?.total ?? 0;
        setPlanName(`${candidateTitle(candidates[0], 0)} · ${score}/100`);
        return;
      }

      if (data.rooms?.length > 0) {
        setV2Candidates([]);
        setV2GenerationStats(null);
        setV2BaseSeed(null);
        setRooms(data.rooms.map((room: Room) => ({ ...room, floor: room.floor ?? 0 })));
        setPlanName(data.name || "Distribución Sugerida por IA");
        setSelectedRoomId(null);
        setActiveTab("2d");
        setActiveFloor(0);
        setPhysicsConfig((prev) => ({ ...prev, running: true }));
        setTimeout(() => setPhysicsConfig((prev) => ({ ...prev, running: false })), 1800);
      } else {
        throw new Error("No se devolvió un programa válido de habitaciones.");
      }
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || "No se pudo conectar al generador generativo.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans flex flex-col text-slate-800 antialiased" id="main-applet-root">
      <header className="bg-slate-900 text-white px-6 py-4 flex flex-wrap justify-between items-center shadow-md border-b border-slate-800 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-xl shadow-inner"><LayoutGrid className="w-6 h-6 text-white stroke-[2.5]" /></div>
          <div>
            <h1 className="text-md font-extrabold tracking-tight">DISEÑO ARQUITECTÓNICO GENERATIVO IA</h1>
            <p className="text-[10px] text-slate-400 font-medium">
              {engineMode === "v2"
                ? "Prediseño habitacional · familia + gramática arquitectónica + restricciones verificables"
                : "Motor experimental anterior de distribución y relajación magnética"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-1 flex items-center gap-1">
            <button id="engine-mode-v2" onClick={() => changeEngineMode("v2")} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${engineMode === "v2" ? "bg-indigo-500 text-white shadow" : "text-slate-400 hover:text-white"}`}><Cpu className="w-3 h-3" /> Engine v3 Beta</button>
            <button id="engine-mode-legacy" onClick={() => changeEngineMode("legacy")} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${engineMode === "legacy" ? "bg-white text-slate-900" : "text-slate-400 hover:text-white"}`}>Motor anterior</button>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-1 text-center min-w-[150px]">
            <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest">Plano activo</span>
            <span className="text-xs font-bold text-slate-100 truncate max-w-[220px] block">{planName}</span>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-1 text-center">
            <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest">Proyecto</span>
            <span className="text-xs font-mono font-bold text-slate-100">{terrain.width}×{terrain.length}m · {levelCount}N</span>
          </div>

          <div className="flex items-center">
            {!showResetConfirm ? (
              <button id="reset-entire-app-btn" onClick={() => setShowResetConfirm(true)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"><RotateCcw className="w-3.5 h-3.5" /> Resetear</button>
            ) : (
              <div className="flex items-center gap-1.5 bg-slate-800 border border-red-500/50 px-2.5 py-1 rounded-xl shadow-inner">
                <span className="text-[9px] font-bold text-red-400">¿Borrar todo?</span>
                <button onClick={handleResetAll} className="bg-red-600 text-white px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer">Sí</button>
                <button onClick={() => setShowResetConfirm(false)} className="bg-slate-700 text-slate-200 px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer">No</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {errorMessage && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3 flex items-center justify-between text-red-800 text-sm animate-fade-in">
          <span className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-600" /><strong>Error del generador:</strong> {errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-xs font-semibold underline">Descartar</button>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="flex flex-wrap justify-between items-center gap-2 bg-white border border-slate-200/80 p-2 rounded-2xl shadow-xs">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              <button onClick={() => setActiveTab("2d")} className={`px-5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === "2d" ? "bg-white text-slate-950 shadow-xs" : "text-slate-500"}`}><Layers className="w-3.5 h-3.5" /> Vista 2D</button>
              <button onClick={() => setActiveTab("3d")} className={`px-5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === "3d" ? "bg-white text-slate-950 shadow-xs" : "text-slate-500"}`}><Eye className="w-3.5 h-3.5" /> Vista 3D</button>
            </div>

            {engineMode === "v2" && levelCount > 1 && (
              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                {Array.from({ length: levelCount }, (_, floor) => (
                  <button key={floor} type="button" onClick={() => { setActiveFloor(floor); setSelectedRoomId(null); }} className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold cursor-pointer ${activeFloor === floor ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>Planta {floor + 1}</button>
                ))}
              </div>
            )}

            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4">{activeTab === "2d" ? `Prediseño · planta ${activeFloor + 1}` : `Volumen conceptual · planta ${activeFloor + 1}`}</div>
          </div>

          {engineMode === "v2" && (
            <div className="bg-indigo-950 text-white border border-indigo-800 rounded-2xl p-4 shadow-sm">
              <div className="flex flex-wrap justify-between gap-3 items-start mb-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-indigo-100"><Sparkles className="w-4 h-4 text-indigo-300" /> Estrategias para tu hogar</div>
                  <p className="text-[10px] text-indigo-300 mt-1 max-w-xl">Cada alternativa representa una intención arquitectónica distinta. El motor considera ingreso, privacidad, incompatibilidades funcionales, orientación solar preliminar y, si corresponde, conexión vertical.</p>
                </div>
                {v2GenerationStats && (
                  <div className="text-right text-[9px] text-indigo-300 font-mono">
                    <div>{v2GenerationStats.generated} candidatas · {v2GenerationStats.valid} válidas</div>
                    {v2BaseSeed !== null && <div>seed base: {v2BaseSeed}</div>}
                  </div>
                )}
              </div>

              {v2Candidates.length === 0 ? (
                <div className="border border-indigo-800 bg-indigo-900/40 rounded-xl p-3 text-[11px] text-indigo-200">Completa el perfil familiar y los parámetros del lote. Aquí aparecerán tres estrategias arquitectónicas comparables.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {v2Candidates.map((candidate, index) => {
                    const score = candidate.score;
                    const strategy = candidate.strategy;
                    const isActive = activeV2Candidate === index;
                    const hardPass = score?.hardConstraintPass ?? false;
                    const affinity = Math.round((strategy?.suitability ?? 0) * 100);

                    return (
                      <button key={candidate.id} onClick={() => applyV2Candidate(index)} className={`text-left rounded-xl border p-3 transition-all cursor-pointer ${isActive ? "bg-white text-slate-900 border-white shadow-md" : "bg-indigo-900/60 border-indigo-700 hover:bg-indigo-900 text-white"}`}>
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <div><span className={`text-[8px] uppercase tracking-wider font-black ${isActive ? "text-indigo-500" : "text-indigo-300"}`}>Alternativa {String.fromCharCode(65 + index)}</span><div className="text-xs font-extrabold leading-tight mt-0.5">{candidateTitle(candidate, index)}</div></div>
                          <span className={`text-lg font-black ${isActive ? "text-indigo-700" : "text-indigo-200"}`}>{score?.total ?? 0}</span>
                        </div>

                        {strategy && (
                          <>
                            <div className={`text-[9px] mt-1 ${isActive ? "text-slate-500" : "text-indigo-200"}`}>{strategy.description}</div>
                            <div className={`mt-2 text-[9px] font-extrabold ${isActive ? "text-violet-700" : "text-violet-300"}`}>Afinidad familiar {affinity}%</div>
                            <div className={`mt-1 space-y-0.5 text-[8px] ${isActive ? "text-slate-500" : "text-indigo-300"}`}>{strategy.reasons.slice(0, 2).map((reason) => <div key={reason}>• {reason}</div>)}</div>
                          </>
                        )}

                        <div className={`mt-2 flex items-center gap-1 text-[9px] font-bold ${hardPass ? (isActive ? "text-emerald-700" : "text-emerald-300") : (isActive ? "text-red-700" : "text-red-300")}`}>
                          {hardPass ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                          {hardPass ? "Restricciones geométricas OK" : "Con restricciones pendientes"}
                        </div>

                        <div className={`mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[8px] ${isActive ? "text-slate-500" : "text-indigo-300"}`}>
                          <span>Adyacencia {score?.adjacency ?? 0}/24</span>
                          <span>Circulación {score?.circulation ?? 0}/24</span>
                          <span>Privacidad {score?.privacy ?? 0}/10</span>
                          <span>Luz {score?.daylight ?? 0}/10</span>
                          <span>Asoleamiento {score?.solarOrientation ?? 0}/8</span>
                          <span>Zonificación {score?.zoning ?? 0}/8</span>
                          <span>Compacidad {score?.compactness ?? 0}/4</span>
                        </div>
                        <div className={`mt-2 text-[8px] font-mono ${isActive ? "text-slate-400" : "text-indigo-400"}`}>seed {candidate.seed ?? "—"}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="relative flex-1 min-h-[450px]">
            {activeTab === "2d" ? (
              <FloorPlanCanvas rooms={visibleRooms} terrain={terrain} physicsConfig={physicsConfig} selectedRoomId={selectedRoomId} onSelectRoom={setSelectedRoomId} onUpdateRooms={handleUpdateVisibleRooms} />
            ) : (
              <ThreeDView rooms={visibleRooms} terrain={terrain} />
            )}
          </div>

          {engineMode === "legacy" ? (
            <MagnetizerControls rooms={rooms} terrain={terrain} physicsConfig={physicsConfig} planName={planName} onUpdateConfig={setPhysicsConfig} onStepSimulation={handleStepSimulation} onResetSimulation={handleResetSimulation} onSnapToGrid={handleSnapToGrid} />
          ) : (
            <div className="bg-white border border-indigo-100 rounded-2xl p-3 text-[10px] text-slate-500 shadow-xs"><strong className="text-indigo-700">Engine v3:</strong> el magnetizador queda desactivado durante la comparación para no deformar una solución ya evaluada. Cambia de planta con el selector superior y edita manualmente después de elegir una estrategia.</div>
          )}
        </div>

        <div className="lg:col-span-4 flex flex-col gap-6">
          {engineMode === "v2" ? (
            <V2HouseholdDesignSidebar terrain={terrain} onUpdateTerrain={setTerrain} onGeneratePlanWithAI={handleGeneratePlanWithAI} aiLoading={aiLoading} />
          ) : (
            <EditorSidebar rooms={rooms} terrain={terrain} selectedRoomId={selectedRoomId} onUpdateTerrain={setTerrain} onSelectRoom={setSelectedRoomId} onAddRoom={handleAddRoom} onDeleteRoom={handleDeleteRoom} onUpdateRoom={handleUpdateRoom} onGeneratePlanWithAI={handleGeneratePlanWithAI} aiLoading={aiLoading} onResolveCollisions={handleResolveCollisions} />
          )}
        </div>
      </main>

      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 py-4 text-center text-[10px] font-semibold tracking-wider mt-12"><p>© 2026 Plataforma de Prediseño Arquitectónico Generativo · Propuestas conceptuales sujetas a desarrollo profesional.</p></footer>
    </div>
  );
}
