/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PhysicsConfig, Room, Terrain } from "../types";
import { Play, Pause, RefreshCw, Grid, Download, ShieldCheck, Zap } from "lucide-react";
import { exportToDXF, exportToSVG } from "../utils/exporters";

interface MagnetizerControlsProps {
  rooms: Room[];
  terrain: Terrain;
  physicsConfig: PhysicsConfig;
  planName: string;
  onUpdateConfig: (config: PhysicsConfig) => void;
  onStepSimulation: () => void;
  onResetSimulation: () => void;
  onSnapToGrid: () => void;
}

export default function MagnetizerControls({
  rooms,
  terrain,
  physicsConfig,
  planName,
  onUpdateConfig,
  onStepSimulation,
  onResetSimulation,
  onSnapToGrid,
}: MagnetizerControlsProps) {
  
  // Handles Downloading SVG
  const handleDownloadSVG = () => {
    const svgContent = exportToSVG(rooms, terrain, planName || "Plano Arquitectónico Generado");
    const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = `${planName.toLowerCase().replace(/\s+/g, "_") || "plano_generativo"}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handles Downloading DXF (CAD)
  const handleDownloadDXF = () => {
    const dxfContent = exportToDXF(rooms, terrain, planName || "Plano Arquitectónico Generado");
    const blob = new Blob([dxfContent], { type: "application/dxf;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = `${planName.toLowerCase().replace(/\s+/g, "_") || "plano_generativo"}.dxf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col gap-5" id="magnetizer-controls-container">
      
      {/* HEADER CONTROLS */}
      <div className="flex flex-wrap justify-between items-center gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Zap className="w-4.5 h-4.5 text-indigo-600 fill-indigo-600/10" /> Motor de Simulación Magnética
          </h2>
          <p className="text-[11px] text-slate-500">Relaja los ambientes atrayendo conexiones y evitando solapes.</p>
        </div>

        {/* Action button cluster */}
        <div className="flex flex-wrap gap-1.5">
          <button
            id="sim-play-pause-btn"
            onClick={() => onUpdateConfig({ ...physicsConfig, running: !physicsConfig.running })}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-1 transition-all cursor-pointer ${
              physicsConfig.running
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "bg-slate-900 hover:bg-slate-800 text-white"
            }`}
          >
            {physicsConfig.running ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-white" /> Pausar Relajación
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-white" /> Iniciar Magnetización
              </>
            )}
          </button>

          <button
            id="sim-step-btn"
            onClick={onStepSimulation}
            disabled={physicsConfig.running}
            className="px-2.5 py-1.5 text-xs font-medium bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
            title="Avanzar un solo frame de fuerzas"
          >
            Paso a Paso
          </button>

          <button
            id="sim-reset-btn"
            onClick={onResetSimulation}
            className="px-2.5 py-1.5 text-xs font-medium bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
            title="Agrupar todo al centro del terreno"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reagrupar
          </button>

          <button
            id="sim-snap-btn"
            onClick={onSnapToGrid}
            className="px-2.5 py-1.5 text-xs font-medium bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-700 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
            title="Forzar redondeo de medidas a la rejilla actual"
          >
            <Grid className="w-3.5 h-3.5" /> Forzar Rejilla
          </button>
        </div>
      </div>

      {/* PHYSICS SLIDERS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Attraction */}
        <div className="flex flex-col">
          <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1.5 uppercase">
            <span>🧲 Atracción (Magnetismo)</span>
            <span className="text-slate-800 font-mono">{physicsConfig.attractionStrength.toFixed(1)}</span>
          </div>
          <input
            id="sim-attraction-slider"
            type="range"
            min="0"
            max="10"
            step="0.5"
            value={physicsConfig.attractionStrength}
            onChange={(e) => onUpdateConfig({ ...physicsConfig, attractionStrength: Number(e.target.value) })}
            className="h-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
        </div>

        {/* Repulsion */}
        <div className="flex flex-col">
          <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1.5 uppercase">
            <span>🛡️ Solape (Repulsión)</span>
            <span className="text-slate-800 font-mono">{physicsConfig.repulsionStrength.toFixed(1)}</span>
          </div>
          <input
            id="sim-repulsion-slider"
            type="range"
            min="1"
            max="15"
            step="0.5"
            value={physicsConfig.repulsionStrength}
            onChange={(e) => onUpdateConfig({ ...physicsConfig, repulsionStrength: Number(e.target.value) })}
            className="h-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
        </div>

        {/* Boundary Force */}
        <div className="flex flex-col">
          <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1.5 uppercase">
            <span>🚪 Retención (Márgenes)</span>
            <span className="text-slate-800 font-mono">{physicsConfig.boundaryStrength.toFixed(1)}</span>
          </div>
          <input
            id="sim-boundary-slider"
            type="range"
            min="0"
            max="8"
            step="0.5"
            value={physicsConfig.boundaryStrength}
            onChange={(e) => onUpdateConfig({ ...physicsConfig, boundaryStrength: Number(e.target.value) })}
            className="h-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
        </div>

        {/* Corridor Force */}
        <div className="flex flex-col">
          <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1.5 uppercase">
            <span>🛣️ Pasillos (Alineación)</span>
            <span className="text-slate-800 font-mono">{physicsConfig.corridorAlignment.toFixed(1)}</span>
          </div>
          <input
            id="sim-corridor-slider"
            type="range"
            min="0"
            max="10"
            step="0.5"
            value={physicsConfig.corridorAlignment}
            onChange={(e) => onUpdateConfig({ ...physicsConfig, corridorAlignment: Number(e.target.value) })}
            className="h-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
        </div>
      </div>

      {/* REJILLA CONFIG & TECHNICAL EXPORTS */}
      <div className="border-t border-slate-100 pt-4 flex flex-wrap justify-between items-center gap-4">
        {/* Rejilla snaps details */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer">
            <input
              id="sim-grid-snap-checkbox"
              type="checkbox"
              checked={physicsConfig.gridSnap}
              onChange={(e) => onUpdateConfig({ ...physicsConfig, gridSnap: e.target.checked })}
              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            Auto-ajuste a Rejilla
          </label>

          {physicsConfig.gridSnap && (
            <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Módulo:</span>
              <select
                id="sim-grid-size-select"
                value={physicsConfig.gridSize}
                onChange={(e) => onUpdateConfig({ ...physicsConfig, gridSize: Number(e.target.value) })}
                className="text-xs bg-transparent border-none py-0 focus:ring-0 text-slate-800 font-semibold cursor-pointer"
              >
                <option value="0.1">0.10 m (Fino)</option>
                <option value="0.25">0.25 m (Métrico)</option>
                <option value="0.5">0.50 m (Modular)</option>
              </select>
            </div>
          )}
        </div>

        {/* Technical Exporters Buttons */}
        <div className="flex gap-2">
          <button
            id="export-svg-btn"
            onClick={handleDownloadSVG}
            className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            title="Exportar plano a gráficos vectoriales SVG para Illustrator/Rhino"
          >
            <Download className="w-3.5 h-3.5" /> Exportar SVG Vectorial
          </button>

          <button
            id="export-dxf-btn"
            onClick={handleDownloadDXF}
            className="px-3.5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            title="Exportar plano a archivo DXF listo para AutoCAD/Revit"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Exportar DXF (AutoCAD)
          </button>
        </div>
      </div>
    </div>
  );
}
