/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { Room, Terrain, PhysicsConfig } from "./types";
import FloorPlanCanvas from "./components/FloorPlanCanvas";
import ThreeDView from "./components/ThreeDView";
import EditorSidebar from "./components/EditorSidebar";
import MagnetizerControls from "./components/MagnetizerControls";
import { relaxRooms, snapAllToGrid } from "./utils/physics";
import { generateRandomLayout } from "./utils/generators";
import { Sparkles, LayoutGrid, RotateCcw, AlertTriangle, Eye, Layers } from "lucide-react";

// Pre-packaged starting rooms for immediate high-end visual feedback
const INITIAL_ROOMS: Room[] = [
  {
    id: "sala",
    name: "Sala / Estar",
    type: "living",
    x: 6.0,
    y: 7.0,
    w: 5.0,
    h: 4.0,
    targetW: 5.0,
    targetH: 4.0,
    color: "#FEF3C7", // amber-100
    connections: ["cocina", "pasillo"],
    openings: [
      { id: "win_sala", type: "window", side: "bottom", offset: 0.5, width: 2.0 },
      { id: "door_sala_pasillo", type: "door", side: "top", offset: 0.8, width: 0.9 },
    ],
    furniture: [
      { id: "s1", type: "sofa", name: "Sofá Familiar", x: 0, y: -1.2, w: 2.0, h: 0.9, rotation: 0 },
      { id: "s2", type: "tv", name: "Mueble TV", x: 0, y: 1.5, w: 1.6, h: 0.45, rotation: 180 },
      { id: "s3", type: "plant", name: "Ficus Maceta", x: -2.0, y: -1.2, w: 0.5, h: 0.5, rotation: 0 },
    ],
  },
  {
    id: "cocina",
    name: "Cocina Americana",
    type: "kitchen",
    x: 3.5,
    y: 11.5,
    w: 3.5,
    h: 3.0,
    targetW: 3.5,
    targetH: 3.0,
    color: "#FEE2E2", // red-100
    connections: ["sala"],
    openings: [
      { id: "win_coc", type: "window", side: "left", offset: 0.5, width: 1.2 },
    ],
    furniture: [
      { id: "k1", type: "fridge", name: "Nevera", x: -1.2, y: -0.9, w: 0.8, h: 0.8, rotation: 90 },
      { id: "k2", type: "stove", name: "Encimera", x: 0, y: -1.0, w: 0.75, h: 0.6, rotation: 0 },
      { id: "k3", type: "sink", name: "Fregadero", x: 1.2, y: -0.9, w: 0.7, h: 0.55, rotation: 270 },
    ],
  },
  {
    id: "dormitorio",
    name: "Dormitorio Principal",
    type: "bedroom",
    x: 8.5,
    y: 13.0,
    w: 4.5,
    h: 4.0,
    targetW: 4.5,
    targetH: 4.0,
    color: "#DBEAFE", // blue-100
    connections: ["pasillo", "bano_privado"],
    openings: [
      { id: "win_dorm", type: "window", side: "right", offset: 0.5, width: 1.5 },
      { id: "door_dorm_bano", type: "door", side: "top", offset: 0.2, width: 0.8 },
    ],
    furniture: [
      { id: "b1", type: "bed", name: "Cama King", x: 0, y: 0.5, w: 1.8, h: 2.0, rotation: 180 },
      { id: "b2", type: "wardrobe", name: "Ropero", x: -1.8, y: -1.0, w: 1.5, h: 0.6, rotation: 90 },
    ],
  },
  {
    id: "pasillo",
    name: "Pasillo Distribuidor",
    type: "corridor",
    x: 6.0,
    y: 11.5,
    w: 1.2,
    h: 4.0,
    targetW: 1.2,
    targetH: 4.0,
    color: "#F3F4F6", // grey-100
    connections: ["sala", "dormitorio", "bano"],
    openings: [
      { id: "door_pas_bano", type: "door", side: "left", offset: 0.8, width: 0.8 },
    ],
    furniture: [],
  },
  {
    id: "bano",
    name: "Baño Completo",
    type: "bathroom",
    x: 3.5,
    y: 15.5,
    w: 2.5,
    h: 2.0,
    targetW: 2.5,
    targetH: 2.0,
    color: "#E0F2FE", // sky-100
    connections: ["pasillo"],
    openings: [
      { id: "win_bano", type: "window", side: "left", offset: 0.3, width: 0.6 },
    ],
    furniture: [
      { id: "ba1", type: "toilet", name: "Inodoro", x: -0.8, y: -0.4, w: 0.45, h: 0.7, rotation: 90 },
      { id: "ba2", type: "sink", name: "Lavabo", x: -0.2, y: -0.6, w: 0.6, h: 0.5, rotation: 0 },
      { id: "ba3", type: "shower", name: "Ducha", x: 0.8, y: 0.5, w: 0.9, h: 0.9, rotation: 0 },
    ],
  },
  {
    id: "bano_privado",
    name: "Baño Suite",
    type: "bathroom",
    x: 8.5,
    y: 17.0,
    w: 2.2,
    h: 1.6,
    targetW: 2.2,
    targetH: 1.6,
    color: "#E0F2FE",
    connections: ["dormitorio"],
    openings: [
      { id: "win_bano_p", type: "window", side: "right", offset: 0.5, width: 0.6 },
    ],
    furniture: [
      { id: "bp1", type: "toilet", name: "Inodoro", x: -0.6, y: -0.2, w: 0.45, h: 0.7, rotation: 90 },
      { id: "bp2", type: "sink", name: "Lavamanos", x: 0.4, y: -0.4, w: 0.6, h: 0.5, rotation: 0 },
    ],
  },
];

const INITIAL_TERRAIN: Terrain = {
  width: 12.0,
  length: 20.0,
  setbackFront: 4.0, // 4m front setback
  setbackBack: 2.0,  // 2m back
  setbackLeft: 1.5,  // 1.5m side
  setbackRight: 1.5, // 1.5m side
  hasPerimeterWall: true, // enabled by default
};

const INITIAL_PHYSICS_CONFIG: PhysicsConfig = {
  attractionStrength: 4.5,
  repulsionStrength: 7.0,
  boundaryStrength: 5.5,
  gridSnap: true,
  gridSize: 0.1, // 10cm grid snap
  running: false,
  corridorAlignment: 3.5,
};

export default function App() {
  const [rooms, setRooms] = useState<Room[]>(INITIAL_ROOMS);
  const [terrain, setTerrain] = useState<Terrain>(INITIAL_TERRAIN);
  const [physicsConfig, setPhysicsConfig] = useState<PhysicsConfig>(INITIAL_PHYSICS_CONFIG);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"2d" | "3d">("2d");
  const [planName, setPlanName] = useState("Vivienda Unifamiliar Compacta");
  
  // AI State
  const [aiLoading, setAiLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset Confirmation State
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // FULL PROJECT RESET HANDLER
  const handleResetAll = () => {
    try {
      const generated = generateRandomLayout();
      setRooms(generated.rooms);
      setTerrain(generated.terrain);
      setPlanName(generated.planName);
    } catch (e) {
      // Fallback if anything fails
      setRooms(INITIAL_ROOMS);
      setTerrain(INITIAL_TERRAIN);
      setPlanName("Vivienda Unifamiliar Compacta");
    }
    setPhysicsConfig(INITIAL_PHYSICS_CONFIG);
    setSelectedRoomId(null);
    setErrorMessage(null);
    setShowResetConfirm(false);
  };

  // REAL-TIME PHYSICS SIMULATION LOOP (RUNS IN BACKGROUND WHILE PLAY ACTIVE)
  useEffect(() => {
    if (!physicsConfig.running) return;

    let animFrameId: number;
    const tick = () => {
      setRooms((prevRooms) => {
        // Run relaxation frame
        return relaxRooms(prevRooms, terrain, physicsConfig, null);
      });
      animFrameId = requestAnimationFrame(tick);
    };

    animFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameId);
  }, [physicsConfig.running, terrain, physicsConfig]);

  // SIMULATOR TRIGGER HANDLERS
  const handleResolveCollisions = () => {
    let tempRooms = rooms.map((r) => ({ ...r }));
    // Temp configuration with high repulsion and zero-attraction/low-attraction to maximize separation
    const tempConfig: PhysicsConfig = {
      ...physicsConfig,
      gridSnap: false,
      repulsionStrength: 10.0,
      attractionStrength: 1.5,
      boundaryStrength: 5.5,
      corridorAlignment: 2.0,
    };

    // Run 100 iterations of relaxation in memory
    for (let i = 0; i < 100; i++) {
      tempRooms = relaxRooms(tempRooms, terrain, tempConfig, null);
    }

    // Force perfect alignment back onto grid sizes
    const finalized = snapAllToGrid(tempRooms, physicsConfig.gridSize);
    setRooms(finalized);
  };

  const handleStepSimulation = () => {
    setRooms((prevRooms) => relaxRooms(prevRooms, terrain, physicsConfig, null));
  };

  const handleResetSimulation = () => {
    // Return all rooms closer to the terrain center with random spacing
    const centerX = terrain.width / 2;
    const centerY = terrain.length / 2;

    const resetRooms = rooms.map((room, idx) => {
      const angle = (idx / rooms.length) * Math.PI * 2;
      const radius = 1.5;
      return {
        ...room,
        x: Number((centerX + Math.cos(angle) * radius).toFixed(2)),
        y: Number((centerY + Math.sin(angle) * radius).toFixed(2)),
      };
    });

    setRooms(resetRooms);
  };

  const handleSnapToGrid = () => {
    const snapped = snapAllToGrid(rooms, physicsConfig.gridSize);
    setRooms(snapped);
  };

  // ROOM REPLACEMENT ACTIONS
  const handleAddRoom = (newRoom: Room) => {
    setRooms([...rooms, newRoom]);
    setSelectedRoomId(newRoom.id);
  };

  const handleDeleteRoom = (roomId: string) => {
    setRooms(rooms.filter((r) => r.id !== roomId));
    if (selectedRoomId === roomId) {
      setSelectedRoomId(null);
    }
  };

  const handleUpdateRoom = (updatedRoom: Room) => {
    setRooms(rooms.map((r) => (r.id === updatedRoom.id ? updatedRoom : r)));
  };

  // AI CALL WRAPPER (CALLS EXPRESS BACKEND)
  const handleGeneratePlanWithAI = async (promptText: string, metadata?: any) => {
    setAiLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/generate-floorplan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText,
          terrainWidth: terrain.width,
          terrainLength: terrain.length,
          metadata,
        }),
      });

      if (!response.ok) {
        let errMsg = "Fallo en la comunicación con el servidor de diseño.";
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          errMsg = errorData.error || errMsg;
        } else {
          const errorText = await response.text();
          if (response.status === 504) {
            errMsg = "La generación con IA tardó demasiado y la conexión expiró (Gateway Timeout). Intente de nuevo con un plano más simple.";
          } else {
            errMsg = `Error del servidor (${response.status}): ${errorText.substring(0, 100)}`;
          }
        }
        throw new Error(errMsg);
      }

      const data = await response.json();
      
      if (data.rooms && data.rooms.length > 0) {
        setRooms(data.rooms);
        setPlanName(data.name || "Distribución Sugerida por IA");
        setSelectedRoomId(null);
        setActiveTab("2d"); // Switch to 2D view so elements are immediately visible on the plane
        // Automatically run relaxation physics to seat rooms cleanly
        setPhysicsConfig((prev) => ({ ...prev, running: true }));
        // Stop relaxation after 2 seconds automatically to lock the plan
        setTimeout(() => {
          setPhysicsConfig((prev) => ({ ...prev, running: false }));
        }, 1800);
      } else {
        throw new Error("No se devolvió un programa válido de habitaciones.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "No se pudo conectar al generador generativo.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans flex flex-col text-slate-800 antialiased" id="main-applet-root">
      
      {/* GLOBAL TOP NAV-HEADER */}
      <header className="bg-slate-900 text-white px-6 py-4 flex flex-wrap justify-between items-center shadow-md border-b border-slate-800 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-xl shadow-inner">
            <LayoutGrid className="w-6 h-6 text-white stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-md font-extrabold tracking-tight">DISEÑO ARQUITECTÓNICO GENERATIVO IA</h1>
            <p className="text-[10px] text-slate-400 font-medium">Plataforma Profesional de Relajación Magnética y Distribución Espacial</p>
          </div>
        </div>

        {/* Project details card in header */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-1 text-center min-w-[120px]">
            <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest">Plano Activo</span>
            <span className="text-xs font-bold text-slate-100 truncate max-w-[180px] block">{planName}</span>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-1 text-center">
            <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest">Dimensiones</span>
            <span className="text-xs font-mono font-bold text-slate-100">{terrain.width}x{terrain.length}m</span>
          </div>

          {/* Reset button cluster */}
          <div className="flex items-center">
            {!showResetConfirm ? (
              <button
                id="reset-entire-app-btn"
                onClick={() => setShowResetConfirm(true)}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                title="Reiniciar todo al diseño por defecto"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Resetear Proyecto
              </button>
            ) : (
              <div className="flex items-center gap-1.5 bg-slate-800 border border-red-500/50 px-2.5 py-1 rounded-xl animate-fade-in shadow-inner">
                <span className="text-[9px] font-bold text-red-400">¿Borrar todo?</span>
                <button
                  id="reset-confirm-yes"
                  onClick={handleResetAll}
                  className="bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer"
                >
                  Sí
                </button>
                <button
                  id="reset-confirm-no"
                  onClick={() => setShowResetConfirm(false)}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer"
                >
                  No
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* DETAILED ERROR BANNER */}
      {errorMessage && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3 flex items-center justify-between text-red-800 text-sm animate-fade-in">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <strong>Error del Generador:</strong> {errorMessage}
          </span>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs font-semibold underline hover:text-red-900"
          >
            Descartar
          </button>
        </div>
      )}

      {/* MAIN WORKSPACE WRAPPER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: INTERACTIVE VIEW & SIMULATOR (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* View Tab Selectors (2D vs 3D) */}
          <div className="flex justify-between items-center bg-white border border-slate-200/80 p-2 rounded-2xl shadow-xs">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                id="tab-select-2d"
                onClick={() => setActiveTab("2d")}
                className={`px-5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "2d"
                    ? "bg-white text-slate-950 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Layers className="w-3.5 h-3.5" /> Vista 2D Técnica
              </button>
              <button
                id="tab-select-3d"
                onClick={() => setActiveTab("3d")}
                className={`px-5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "3d"
                    ? "bg-white text-slate-950 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Eye className="w-3.5 h-3.5" /> Vista 3D Interactiva
              </button>
            </div>

            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4">
              {activeTab === "2d" ? "Modo: Dibujo Técnico & Edición" : "Modo: Recorrido Virtual"}
            </div>
          </div>

          {/* ACTIVE VIEW CARRIER */}
          <div className="relative flex-1 min-h-[450px]">
            {activeTab === "2d" ? (
              <FloorPlanCanvas
                rooms={rooms}
                terrain={terrain}
                physicsConfig={physicsConfig}
                selectedRoomId={selectedRoomId}
                onSelectRoom={setSelectedRoomId}
                onUpdateRooms={setRooms}
              />
            ) : (
              <ThreeDView rooms={rooms} terrain={terrain} />
            )}
          </div>

          {/* SIMULATOR CONTROLLERS */}
          <MagnetizerControls
            rooms={rooms}
            terrain={terrain}
            physicsConfig={physicsConfig}
            planName={planName}
            onUpdateConfig={setPhysicsConfig}
            onStepSimulation={handleStepSimulation}
            onResetSimulation={handleResetSimulation}
            onSnapToGrid={handleSnapToGrid}
          />
        </div>

        {/* RIGHT COLUMN: WORKSPACE SIDEBAR (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <EditorSidebar
            rooms={rooms}
            terrain={terrain}
            selectedRoomId={selectedRoomId}
            onUpdateTerrain={setTerrain}
            onSelectRoom={setSelectedRoomId}
            onAddRoom={handleAddRoom}
            onDeleteRoom={handleDeleteRoom}
            onUpdateRoom={handleUpdateRoom}
            onGeneratePlanWithAI={handleGeneratePlanWithAI}
            aiLoading={aiLoading}
            onResolveCollisions={handleResolveCollisions}
          />
        </div>
      </main>

      {/* DECENTRALIZED FOOTER */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 py-4 text-center text-[10px] font-semibold tracking-wider mt-12">
        <p>© 2026 Plataforma de Diseño Arquitectónico Generativo. Desarrollado con Inteligencia Artificial.</p>
      </footer>
    </div>
  );
}
