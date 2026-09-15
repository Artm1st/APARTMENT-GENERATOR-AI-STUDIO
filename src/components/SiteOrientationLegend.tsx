import { Compass, DoorOpen } from "lucide-react";
import type { Room, Terrain } from "../types";

interface SiteOrientationLegendProps {
  terrain: Terrain;
  rooms: Room[];
}

function entryLabel(side: Terrain["entrySide"]): string {
  switch (side) {
    case "back": return "Fondo";
    case "left": return "Izquierda";
    case "right": return "Derecha";
    case "front":
    default: return "Frente";
  }
}

export default function SiteOrientationLegend({ terrain, rooms }: SiteOrientationLegendProps) {
  const north = Number.isFinite(Number(terrain.northAngleDeg))
    ? ((Number(terrain.northAngleDeg) % 360) + 360) % 360
    : 0;

  const entryRoom = rooms.find((room) =>
    room.openings.some((opening) => opening.id.includes("door_main_entry_"))
  );

  return (
    <div className="pointer-events-none absolute left-3 top-3 z-20 flex flex-col gap-2">
      <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="relative h-9 w-9 shrink-0 rounded-full border border-slate-200 bg-slate-50">
            <div
              className="absolute left-1/2 top-1/2 h-7 w-[2px] origin-bottom bg-indigo-600"
              style={{ transform: `translate(-50%, -100%) rotate(${north}deg)` }}
            >
              <div className="absolute -left-[3px] -top-1 h-0 w-0 border-x-[4px] border-b-[7px] border-x-transparent border-b-indigo-600" />
            </div>
            <span className="absolute left-1/2 top-[1px] -translate-x-1/2 text-[8px] font-black text-indigo-700">N</span>
          </div>
          <div>
            <div className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wide text-slate-500">
              <Compass className="h-3 w-3" /> Norte de proyecto
            </div>
            <div className="text-[11px] font-black text-slate-900">{north.toFixed(0)}°</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50/95 px-3 py-2 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wide text-amber-700">
          <DoorOpen className="h-3 w-3" /> Ingreso principal
        </div>
        <div className="mt-0.5 text-[10px] font-black text-amber-950">
          {entryLabel(terrain.entrySide)}{entryRoom ? ` → ${entryRoom.name}` : " → no resuelto"}
        </div>
      </div>
    </div>
  );
}
