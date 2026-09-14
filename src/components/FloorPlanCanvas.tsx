/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, MouseEvent } from "react";
import { Room, RoomOpening, FurnitureItem, Terrain, PhysicsConfig } from "../types";
import { ZoomIn, ZoomOut, RotateCw, Trash2, Plus, Move, Compass, PenTool } from "lucide-react";

interface FloorPlanCanvasProps {
  rooms: Room[];
  terrain: Terrain;
  physicsConfig: PhysicsConfig;
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string | null) => void;
  onUpdateRooms: (rooms: Room[]) => void;
}

type EditTarget =
  | { type: "room"; id: string }
  | { type: "resize"; id: string; handle: string }
  | { type: "opening"; roomId: string; openingId: string }
  | { type: "furniture"; roomId: string; furnitureId: string }
  | null;

export default function FloorPlanCanvas({
  rooms,
  terrain,
  physicsConfig,
  selectedRoomId,
  onSelectRoom,
  onUpdateRooms,
}: FloorPlanCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Viewport transformation states
  const [zoom, setZoom] = useState(25); // Pixels per meter
  const [offset, setOffset] = useState({ x: 100, y: 50 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Interactive editing states
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [selectedElement, setSelectedElement] = useState<{
    type: "furniture" | "opening";
    roomId: string;
    id: string;
  } | null>(null);
  const [dragStartMeters, setDragStartMeters] = useState({ x: 0, y: 0 });
  const [dragStartRoomState, setDragStartRoomState] = useState<Room | null>(null);

  // Sync selected element with selectedRoomId
  useEffect(() => {
    if (selectedElement && selectedElement.roomId !== selectedRoomId) {
      setSelectedElement(null);
    }
  }, [selectedRoomId, selectedElement]);

  // Palettes & Placement mode
  const [editorMode, setEditorMode] = useState<"select" | "add_door" | "add_window" | "add_furniture" | "draw_corridor">("select");
  const [isDrawingCorridor, setIsDrawingCorridor] = useState(false);
  const [corridorStartMeters, setCorridorStartMeters] = useState({ x: 0, y: 0 });
  const [corridorPoints, setCorridorPoints] = useState<{ x: number; y: number }[]>([]);
  const [activeDrawPoint, setActiveDrawPoint] = useState<{ x: number; y: number } | null>(null);
  const [selectedFurnitureType, setSelectedFurnitureType] = useState<FurnitureItem["type"]>("sofa");

  // Reset drawing states when editorMode changes
  useEffect(() => {
    if (editorMode !== "draw_corridor") {
      setCorridorPoints([]);
      setActiveDrawPoint(null);
      setIsDrawingCorridor(false);
    }
  }, [editorMode]);

  // Finish current corridor drawing
  const handleFinishCorridor = () => {
    setIsDrawingCorridor(false);
    setCorridorPoints([]);
    setActiveDrawPoint(null);
    setEditorMode("select");
  };

  // Keyboard shortcuts for finishing corridor drawing, deleting, and rotating selected elements
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key events if the user is typing in a text field or input
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (editorMode === "draw_corridor") {
        if (e.key === "Escape" || e.key === "Enter") {
          handleFinishCorridor();
        }
      } else {
        if (e.key === "Delete" || e.key === "Backspace") {
          deleteSelectedElement();
        }
        if (e.key === "r" || e.key === "R") {
          rotateSelectedElement();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editorMode, corridorPoints, selectedElement, selectedRoomId, rooms]);

  // Furniture list to select from
  const furniturePresets = [
    { type: "sofa", name: "Sofá 3 Cuerpos", w: 2.0, h: 0.9 },
    { type: "tv", name: "Mueble TV", w: 1.6, h: 0.45 },
    { type: "dining_table", name: "Mesa Comedor", w: 1.8, h: 0.9 },
    { type: "chair", name: "Silla", w: 0.5, h: 0.5 },
    { type: "bed", name: "Cama Queen", w: 1.6, h: 2.0 },
    { type: "wardrobe", name: "Armario", w: 1.5, h: 0.6 },
    { type: "sink", name: "Lavamanos", w: 0.7, h: 0.55 },
    { type: "toilet", name: "Inodoro", w: 0.45, h: 0.7 },
    { type: "shower", name: "Ducha", w: 0.9, h: 0.9 },
    { type: "fridge", name: "Refrigeradora", w: 0.8, h: 0.8 },
    { type: "stove", name: "Cocina / Encimera", w: 0.75, h: 0.6 },
    { type: "desk", name: "Escritorio Trabajo", w: 1.2, h: 0.6 },
    { type: "plant", name: "Planta de Maceta", w: 0.5, h: 0.5 },
  ];

  // Auto-fit terrain inside canvas on mount or when terrain sizes change
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;

    canvasRef.current.width = cw;
    canvasRef.current.height = ch;

    // Calculate optimal zoom to fit terrain with margin
    const padding = 60;
    const zoomX = (cw - padding * 2) / terrain.width;
    const zoomY = (ch - padding * 2) / terrain.length;
    const optimalZoom = Math.min(zoomX, zoomY, 35); // cap zoom max

    setZoom(optimalZoom);

    // Center terrain
    const offX = (cw - terrain.width * optimalZoom) / 2;
    const offY = (ch - terrain.length * optimalZoom) / 2;
    setOffset({ x: offX, y: offY });
  }, [terrain.width, terrain.length]);

  // Handle Resize of canvas container
  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !containerRef.current) return;
      canvasRef.current.width = containerRef.current.clientWidth;
      canvasRef.current.height = containerRef.current.clientHeight;
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // COORDINATE MAP HELPERS
  const toPixels = (metersX: number, metersY: number) => {
    return {
      x: offset.x + metersX * zoom,
      y: offset.y + metersY * zoom,
    };
  };

  const toMeters = (pixelsX: number, pixelsY: number) => {
    return {
      x: (pixelsX - offset.x) / zoom,
      y: (pixelsY - offset.y) / zoom,
    };
  };

  // MAIN DRAW FUNCTION IN CANVAS
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#F9FAFB"; // Slate-50 background
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Save state
    ctx.save();

    // 1. DRAW METRIC GRID
    ctx.strokeStyle = "#E5E7EB"; // slate 100
    ctx.lineWidth = 0.5;
    const startCell = toMeters(0, 0);
    const endCell = toMeters(canvas.width, canvas.height);

    const minGridX = Math.floor(Math.max(0, startCell.x));
    const maxGridX = Math.ceil(Math.min(terrain.width, endCell.x));
    const minGridY = Math.floor(Math.max(0, startCell.y));
    const maxGridY = Math.ceil(Math.min(terrain.length, endCell.y));

    // Draw 0.5m subdivisions if zoomed in enough
    if (zoom > 20) {
      ctx.strokeStyle = "#F3F4F6";
      for (let x = Math.max(0, Math.floor(startCell.x * 2) / 2); x <= Math.min(terrain.width, endCell.x); x += 0.5) {
        const p1 = toPixels(x, 0);
        const p2 = toPixels(x, terrain.length);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      for (let y = Math.max(0, Math.floor(startCell.y * 2) / 2); y <= Math.min(terrain.length, endCell.y); y += 0.5) {
        const p1 = toPixels(0, y);
        const p2 = toPixels(terrain.width, y);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }

    // Draw main 1m grid lines
    ctx.strokeStyle = "#E5E7EB";
    for (let x = minGridX; x <= maxGridX; x++) {
      const p1 = toPixels(x, 0);
      const p2 = toPixels(x, terrain.length);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    for (let y = minGridY; y <= maxGridY; y++) {
      const p1 = toPixels(0, y);
      const p2 = toPixels(terrain.width, y);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // 2. DRAW TERRAIN BOUNDS & SETBACKS
    const terrainStart = toPixels(0, 0);
    const terrainSize = { w: terrain.width * zoom, h: terrain.length * zoom };

    // Outer Terrain Property dashed line
    ctx.strokeStyle = "#6B7280"; // Gray-500
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(terrainStart.x, terrainStart.y, terrainSize.w, terrainSize.h);

    // Label Property Border
    ctx.fillStyle = "#4B5563";
    ctx.font = "bold 10px sans-serif";
    ctx.setLineDash([]);
    ctx.fillText("LÍMITE TERRENO", terrainStart.x + 10, terrainStart.y - 8);
    ctx.fillText(`${terrain.width.toFixed(1)}m x ${terrain.length.toFixed(1)}m`, terrainStart.x + 10, terrainStart.y + 18);

    // Draw Setbacks (Buildable boundary)
    const setMin = toPixels(terrain.setbackLeft, terrain.setbackFront);
    const setMax = toPixels(terrain.width - terrain.setbackRight, terrain.length - terrain.setbackBack);
    ctx.strokeStyle = "#EF4444"; // Red-500 buildable box
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(setMin.x, setMin.y, setMax.x - setMin.x, setMax.y - setMin.y);
    ctx.fillStyle = "#EF4444";
    ctx.setLineDash([]);
    ctx.fillText("ÁREA EDIFICABLE", setMin.x + 6, setMin.y - 6);

    // 2.5 DRAW PERIMETER WALL (MURO PERIMÉTRICO)
    if (terrain.hasPerimeterWall) {
      ctx.save();
      ctx.fillStyle = "#E2E8F0"; // Slate 200 (masonry structure)
      ctx.strokeStyle = "#475569"; // Slate 600 (structural dark lines)
      ctx.lineWidth = 1.5;

      const wallThick = 0.15 * zoom; // 15cm thickness in pixels

      // Left Wall (entire left length)
      const pLeftTop = toPixels(0, 0);
      const pLeftBot = toPixels(0, terrain.length);
      ctx.fillRect(pLeftTop.x - wallThick / 2, pLeftTop.y, wallThick, pLeftBot.y - pLeftTop.y);
      ctx.strokeRect(pLeftTop.x - wallThick / 2, pLeftTop.y, wallThick, pLeftBot.y - pLeftTop.y);

      // Right Wall (entire right length)
      const pRightTop = toPixels(terrain.width, 0);
      const pRightBot = toPixels(terrain.width, terrain.length);
      ctx.fillRect(pRightTop.x - wallThick / 2, pRightTop.y, wallThick, pRightBot.y - pRightTop.y);
      ctx.strokeRect(pRightTop.x - wallThick / 2, pRightTop.y, wallThick, pRightBot.y - pRightTop.y);

      // Back Wall (entire back width, connecting left and right walls)
      const pBackLeft = toPixels(0, terrain.length);
      const pBackRight = toPixels(terrain.width, terrain.length);
      ctx.fillRect(pBackLeft.x - wallThick / 2, pBackLeft.y - wallThick / 2, (pBackRight.x - pBackLeft.x) + wallThick, wallThick);
      ctx.strokeRect(pBackLeft.x - wallThick / 2, pBackLeft.y - wallThick / 2, (pBackRight.x - pBackLeft.x) + wallThick, wallThick);

      // Front Wall (with 4m gate in the center)
      const gateWidth = 4.0;
      const wallPartWidth = (terrain.width - gateWidth) / 2;
      const rightPartStart = wallPartWidth + gateWidth;

      // Front-Left Segment
      const pFrontLeftStart = toPixels(0, 0);
      const pFrontLeftEnd = toPixels(wallPartWidth, 0);
      ctx.fillRect(pFrontLeftStart.x - wallThick / 2, pFrontLeftStart.y - wallThick / 2, (pFrontLeftEnd.x - pFrontLeftStart.x) + wallThick / 2, wallThick);
      ctx.strokeRect(pFrontLeftStart.x - wallThick / 2, pFrontLeftStart.y - wallThick / 2, (pFrontLeftEnd.x - pFrontLeftStart.x) + wallThick / 2, wallThick);

      // Front-Right Segment
      const pFrontRightStart = toPixels(rightPartStart, 0);
      const pFrontRightEnd = toPixels(terrain.width, 0);
      ctx.fillRect(pFrontRightStart.x - wallThick / 2, pFrontRightStart.y - wallThick / 2, (pFrontRightEnd.x - pFrontRightStart.x) + wallThick / 2, wallThick);
      ctx.strokeRect(pFrontRightStart.x - wallThick / 2, pFrontRightStart.y - wallThick / 2, (pFrontRightEnd.x - pFrontRightStart.x) + wallThick / 2, wallThick);

      // Double-Swing Gate Visuals
      ctx.strokeStyle = "#4F46E5"; // Indigo-600 for high-end gate lines
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);

      // Left gate panel swing arc
      ctx.beginPath();
      ctx.arc(pFrontLeftEnd.x, pFrontLeftEnd.y, (gateWidth / 2) * zoom, 0, Math.PI / 2);
      ctx.stroke();

      // Left gate panel leaf (slid open at 45 degrees)
      ctx.setLineDash([]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pFrontLeftEnd.x, pFrontLeftEnd.y);
      ctx.lineTo(pFrontLeftEnd.x + Math.cos(Math.PI / 4) * (gateWidth / 2) * zoom, pFrontLeftEnd.y + Math.sin(Math.PI / 4) * (gateWidth / 2) * zoom);
      ctx.stroke();

      // Right gate panel swing arc
      ctx.strokeStyle = "#4F46E5";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(pFrontRightStart.x, pFrontRightStart.y, (gateWidth / 2) * zoom, Math.PI, Math.PI / 2, true);
      ctx.stroke();

      // Right gate panel leaf
      ctx.setLineDash([]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pFrontRightStart.x, pFrontRightStart.y);
      ctx.lineTo(pFrontRightStart.x - Math.cos(Math.PI / 4) * (gateWidth / 2) * zoom, pFrontRightStart.y + Math.sin(Math.PI / 4) * (gateWidth / 2) * zoom);
      ctx.stroke();

      // Label
      ctx.fillStyle = "#4F46E5";
      ctx.font = "italic bold 8px sans-serif";
      ctx.fillText("INGRESO / PORTÓN", pFrontLeftEnd.x + 5, pFrontLeftEnd.y + 12);

      ctx.restore();
    }

    // 3. DRAW ROOMS
    rooms.forEach((room) => {
      const rX = room.x - room.w / 2;
      const rY = room.y - room.h / 2;
      const roomPos = toPixels(rX, rY);
      const roomSize = { w: room.w * zoom, h: room.h * zoom };

      const isSelected = room.id === selectedRoomId;

      // Draw Room Fill Base
      ctx.fillStyle = room.color;
      ctx.fillRect(roomPos.x, roomPos.y, roomSize.w, roomSize.h);

      // Draw Walls (thick lines)
      ctx.strokeStyle = isSelected ? "#4F46E5" : "#1F2937"; // Indigo-600 when selected, else Charcoal
      ctx.lineWidth = isSelected ? 3.5 : 2.5;
      ctx.strokeRect(roomPos.x, roomPos.y, roomSize.w, roomSize.h);

      // Draw Inner Double-Line Wall effect for aesthetics
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(roomPos.x + 2, roomPos.y + 2, roomSize.w - 4, roomSize.h - 4);

      // Special: If corridor, draw a dashed spinal centerline to highlight its routing role (as requested!)
      if (room.type === "corridor") {
        ctx.save();
        ctx.strokeStyle = "#4F46E5EE"; // Strong indigo line
        ctx.lineWidth = 1.8;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        if (room.w >= room.h) {
          // Horizontal centerline
          const startPx = toPixels(room.x - room.w / 2, room.y);
          const endPx = toPixels(room.x + room.w / 2, room.y);
          ctx.moveTo(startPx.x, startPx.y);
          ctx.lineTo(endPx.x, endPx.y);
        } else {
          // Vertical centerline
          const startPx = toPixels(room.x, room.y - room.h / 2);
          const endPx = toPixels(room.x, room.y + room.h / 2);
          ctx.moveTo(startPx.x, startPx.y);
          ctx.lineTo(endPx.x, endPx.y);
        }
        ctx.stroke();
        ctx.restore();
      }

      // 4. DRAW FURNITURE ITEMS
      room.furniture.forEach((fItem) => {
        const absX = room.x + fItem.x;
        const absY = room.y + fItem.y;
        const fPos = toPixels(absX, absY);
        const fSize = { w: fItem.w * zoom, h: fItem.h * zoom };

        // Save context to rotate
        ctx.save();
        ctx.translate(fPos.x, fPos.y);
        ctx.rotate((-fItem.rotation * Math.PI) / 180); // Rotate

        const isElementSelected = selectedElement?.type === "furniture" && selectedElement.id === fItem.id;

        // Soft pastel teal style for furniture (or red/rose if selected)
        ctx.fillStyle = isElementSelected ? "#FEF2F2" : "#ECFDF5"; 
        ctx.strokeStyle = isElementSelected ? "#EF4444" : "#10B981"; 
        ctx.lineWidth = isElementSelected ? 2.5 : 1.5;

        // Draw item shape (centered)
        ctx.fillRect(-fSize.w / 2, -fSize.h / 2, fSize.w, fSize.h);
        ctx.strokeRect(-fSize.w / 2, -fSize.h / 2, fSize.w, fSize.h);

        // Selection outer frame overlay
        if (isElementSelected) {
          ctx.strokeStyle = "#EF444488";
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 2]);
          ctx.strokeRect(-fSize.w / 2 - 4, -fSize.h / 2 - 4, fSize.w + 8, fSize.h + 8);
          ctx.setLineDash([]);
        }

        // Draw cross lines or indicators for stylized CAD look
        ctx.strokeStyle = isElementSelected ? "#EF444433" : "#10B98133";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-fSize.w / 2, -fSize.h / 2);
        ctx.lineTo(fSize.w / 2, fSize.h / 2);
        ctx.moveTo(-fSize.w / 2, fSize.h / 2);
        ctx.lineTo(fSize.w / 2, -fSize.h / 2);
        ctx.stroke();

        // Label furniture
        ctx.fillStyle = isElementSelected ? "#991B1B" : "#065F46";
        ctx.font = "8px monospace";
        ctx.textAlign = "center";
        ctx.fillText(fItem.name.substring(0, 10), 0, 3);

        ctx.restore();
      });

      // 5. DRAW OPENINGS (Doors and Windows)
      room.openings.forEach((opening) => {
        const oHalfW = opening.width / 2;
        let oPosMeters = { x: 0, y: 0 };

        // Compute coordinate along room borders
        if (opening.side === "top" || opening.side === "bottom") {
          const wallY = opening.side === "top" ? rY + room.h : rY;
          oPosMeters = { x: rX + room.w * opening.offset, y: wallY };
        } else {
          const wallX = opening.side === "right" ? rX + room.w : rX;
          oPosMeters = { x: wallX, y: rY + room.h * opening.offset };
        }

        const oPosPx = toPixels(oPosMeters.x, oPosMeters.y);
        const opW_px = opening.width * zoom;

        ctx.save();

        const isElementSelected = selectedElement?.type === "opening" && selectedElement.id === opening.id;

        if (opening.type === "window") {
          // Drawing Window: Glazed double blue/red lines
          ctx.fillStyle = isElementSelected ? "#FEF2F2" : "#E0F2FE"; 
          ctx.strokeStyle = isElementSelected ? "#EF4444" : "#0284C7"; 
          ctx.lineWidth = isElementSelected ? 3.5 : 2.5;

          if (opening.side === "top" || opening.side === "bottom") {
            ctx.fillRect(oPosPx.x - opW_px / 2, oPosPx.y - 3, opW_px, 6);
            ctx.strokeRect(oPosPx.x - opW_px / 2, oPosPx.y - 3, opW_px, 6);
            // glass partition line
            ctx.strokeStyle = isElementSelected ? "#B91C1C" : "#0284C7";
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(oPosPx.x - opW_px / 2, oPosPx.y);
            ctx.lineTo(oPosPx.x + opW_px / 2, oPosPx.y);
            ctx.stroke();
          } else {
            ctx.fillRect(oPosPx.x - 3, oPosPx.y - opW_px / 2, 6, opW_px);
            ctx.strokeRect(oPosPx.x - 3, oPosPx.y - opW_px / 2, 6, opW_px);
            // glass partition line
            ctx.strokeStyle = isElementSelected ? "#B91C1C" : "#0284C7";
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(oPosPx.x, oPosPx.y - opW_px / 2);
            ctx.lineTo(oPosPx.x, oPosPx.y + opW_px / 2);
            ctx.stroke();
          }
        } else if (opening.type === "door") {
          // Drawing Door Swing Arc & Panel
          ctx.strokeStyle = isElementSelected ? "#EF4444" : "#D97706"; 
          ctx.lineWidth = isElementSelected ? 2.5 : 1.5;

          if (opening.side === "top" || opening.side === "bottom") {
            const dir = opening.side === "top" ? -1 : 1;
            // Draw opening cut-out (overdrawing with room color to erase background wall line)
            ctx.fillStyle = room.color;
            ctx.fillRect(oPosPx.x - opW_px / 2, oPosPx.y - 4, opW_px, 8);

            // Draw door swing hinge point
            ctx.beginPath();
            ctx.arc(oPosPx.x - opW_px / 2, oPosPx.y, isElementSelected ? 3.5 : 2, 0, Math.PI * 2);
            ctx.fillStyle = isElementSelected ? "#EF4444" : "#D97706";
            ctx.fill();

            // Draw swing leaf panel
            ctx.beginPath();
            ctx.moveTo(oPosPx.x - opW_px / 2, oPosPx.y);
            ctx.lineTo(oPosPx.x - opW_px / 2, oPosPx.y + opW_px * dir);
            ctx.stroke();

            // Draw swing dotted arc
            ctx.strokeStyle = isElementSelected ? "#EF4444AA" : "#D9770699";
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.arc(
              oPosPx.x - opW_px / 2,
              oPosPx.y,
              opW_px,
              opening.side === "top" ? -Math.PI / 2 : Math.PI / 2,
              0,
              opening.side === "top"
            );
            ctx.stroke();
          } else {
            const dir = opening.side === "left" ? 1 : -1;
            // Draw opening cut-out
            ctx.fillStyle = room.color;
            ctx.fillRect(oPosPx.x - 4, oPosPx.y - opW_px / 2, 8, opW_px);

            // Draw hinge
            ctx.beginPath();
            ctx.arc(oPosPx.x, oPosPx.y - opW_px / 2, isElementSelected ? 3.5 : 2, 0, Math.PI * 2);
            ctx.fillStyle = isElementSelected ? "#EF4444" : "#D97706";
            ctx.fill();

            // Draw swing leaf
            ctx.beginPath();
            ctx.moveTo(oPosPx.x, oPosPx.y - opW_px / 2);
            ctx.lineTo(oPosPx.x + opW_px * dir, oPosPx.y - opW_px / 2);
            ctx.stroke();

            // Draw swing arc
            ctx.strokeStyle = isElementSelected ? "#EF4444AA" : "#D9770699";
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.arc(
              oPosPx.x,
              oPosPx.y - opW_px / 2,
              opW_px,
              opening.side === "left" ? 0 : Math.PI,
              Math.PI / 2,
              true
            );
            ctx.stroke();
          }
        }

        // Selection outer frame overlay for openings
        if (isElementSelected) {
          ctx.strokeStyle = "#EF444488";
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);
          ctx.strokeRect(oPosPx.x - 12, oPosPx.y - 12, 24, 24);
          ctx.setLineDash([]);
        }

        ctx.restore();
      });

      // 6. DRAW ROOM LABELS (Center-aligned)
      ctx.fillStyle = "#111827"; // Gray-900
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const roomCenterPx = toPixels(room.x, room.y);

      // Adjust font size based on zoom and room dimensions
      const idealFontSize = Math.min(14, Math.max(10, room.w * zoom * 0.12));
      ctx.font = `bold ${idealFontSize}px sans-serif`;
      ctx.fillText(room.name, roomCenterPx.x, roomCenterPx.y - 6);

      // Area tag underneath
      ctx.fillStyle = "#4B5563"; // Gray-600
      ctx.font = `${idealFontSize - 2}px sans-serif`;
      const areaText = `${room.w.toFixed(1)} x ${room.h.toFixed(1)} m`;
      ctx.fillText(areaText, roomCenterPx.x, roomCenterPx.y + 10);
    });

    // 7. DRAW RESIZE HANDLES & OVERLAYS FOR SELECTED ROOM
    if (selectedRoomId) {
      const activeRoom = rooms.find((r) => r.id === selectedRoomId);
      if (activeRoom) {
        const rX = activeRoom.x - activeRoom.w / 2;
        const rY = activeRoom.y - activeRoom.h / 2;
        const rW = activeRoom.w;
        const rH = activeRoom.h;

        const pos = toPixels(rX, rY);
        const size = { w: rW * zoom, h: rH * zoom };

        // Highlight selected frame with a pulsing blue shadow
        ctx.strokeStyle = "#4F46E5";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 2]);
        ctx.strokeRect(pos.x - 4, pos.y - 4, size.w + 8, size.h + 8);
        ctx.setLineDash([]);

        // Handle points mapping
        // Corner handles: tl, tr, bl, br
        // Edge handles: t, b, l, r
        const handles = [
          { name: "tl", x: pos.x, y: pos.y },
          { name: "tr", x: pos.x + size.w, y: pos.y },
          { name: "bl", x: pos.x, y: pos.y + size.h },
          { name: "br", x: pos.x + size.w, y: pos.y + size.h },
          { name: "t", x: pos.x + size.w / 2, y: pos.y },
          { name: "b", x: pos.x + size.w / 2, y: pos.y + size.h },
          { name: "l", x: pos.x, y: pos.y + size.h / 2 },
          { name: "r", x: pos.x + size.w / 2 * 2, y: pos.y + size.h / 2 },
        ];

        handles.forEach((h) => {
          ctx.beginPath();
          ctx.arc(h.x, h.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = "#FFFFFF";
          ctx.strokeStyle = "#4F46E5";
          ctx.lineWidth = 2;
          ctx.fill();
          ctx.stroke();
        });

        // Overlay helper guidelines to terrain borders
        ctx.strokeStyle = "#312E8144"; // subtle deep blue
        ctx.lineWidth = 0.8;
        ctx.setLineDash([2, 4]);

        // left clearance
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y + size.h / 2);
        ctx.lineTo(offset.x + terrain.setbackLeft * zoom, pos.y + size.h / 2);
        ctx.stroke();

        // right clearance
        ctx.beginPath();
        ctx.moveTo(pos.x + size.w, pos.y + size.h / 2);
        ctx.lineTo(offset.x + (terrain.width - terrain.setbackRight) * zoom, pos.y + size.h / 2);
        ctx.stroke();

        ctx.setLineDash([]);
      }
    }

    // 8. DRAW ACTIVE MULTI-SEGMENT CORRIDOR PATH PREVIEW
    if (editorMode === "draw_corridor" && corridorPoints.length > 0) {
      ctx.save();
      
      // Draw already placed segments path centerlines
      ctx.strokeStyle = "rgba(79, 70, 229, 0.4)"; // translucent indigo
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      corridorPoints.forEach((pt, idx) => {
        const px = toPixels(pt.x, pt.y);
        if (idx === 0) {
          ctx.moveTo(px.x, px.y);
        } else {
          ctx.lineTo(px.x, px.y);
        }
      });
      ctx.stroke();

      // Draw active/live preview segment
      if (activeDrawPoint) {
        const pLast = corridorPoints[corridorPoints.length - 1];
        const dx = Math.abs(activeDrawPoint.x - pLast.x);
        const dy = Math.abs(activeDrawPoint.y - pLast.y);
        let w = 1.2;
        let h = 1.2;
        let x = activeDrawPoint.x;
        let y = activeDrawPoint.y;
        
        if (dx > dy) {
          w = Math.max(1.2, dx);
          h = 1.2;
          x = (pLast.x + activeDrawPoint.x) / 2;
          y = pLast.y;
        } else {
          w = 1.2;
          h = Math.max(1.2, dy);
          x = pLast.x;
          y = (pLast.y + activeDrawPoint.y) / 2;
        }

        // Draw translucent preview of the 1.20m width (0.60m offset) box
        const rectMinX = x - w / 2;
        const rectMinY = y - h / 2;
        const rectPx = toPixels(rectMinX, rectMinY);
        const rectW_px = w * zoom;
        const rectH_px = h * zoom;

        ctx.fillStyle = "rgba(79, 70, 229, 0.22)"; // soft indigo fill
        ctx.strokeStyle = "#4F46E5";
        ctx.lineWidth = 2;
        ctx.fillRect(rectPx.x, rectPx.y, rectW_px, rectH_px);
        ctx.strokeRect(rectPx.x, rectPx.y, rectW_px, rectH_px);

        // Draw live segment centerline
        ctx.strokeStyle = "#4F46E5";
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 2;
        const startPx = toPixels(pLast.x, pLast.y);
        const endPx = toPixels(activeDrawPoint.x, activeDrawPoint.y);
        ctx.beginPath();
        ctx.moveTo(startPx.x, startPx.y);
        ctx.lineTo(endPx.x, endPx.y);
        ctx.stroke();

        // Label for length
        const lengthMeters = Math.max(dx, dy);
        if (lengthMeters > 0.1) {
          ctx.fillStyle = "#4F46E5";
          ctx.font = "bold 11px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          const midX = (startPx.x + endPx.x) / 2;
          const midY = (startPx.y + endPx.y) / 2;
          ctx.fillText(`${lengthMeters.toFixed(2)} m (Offset 1.20 m)`, midX, midY - 6);
        }
      }

      // Draw vertex nodes
      corridorPoints.forEach((pt, idx) => {
        const px = toPixels(pt.x, pt.y);
        ctx.beginPath();
        ctx.arc(px.x, px.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = idx === 0 ? "#10B981" : "#4F46E5"; // green for starting vertex
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
      });

      ctx.restore();
    }

    ctx.restore();
  }, [rooms, terrain, zoom, offset, selectedRoomId, editorMode, corridorPoints, activeDrawPoint, selectedElement]);

  // WORKSPACE ACTION HANDLERS
  const handleZoom = (factor: number) => {
    setZoom((prev) => Math.max(5, Math.min(100, prev + factor)));
  };

  // MOUSE CLICK & DRAG EVENT INTERACTION
  const getMousePosOnCanvas = (e: MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || e.button === 2) {
      // Middle or Right click = panning
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    const mPos = getMousePosOnCanvas(e);
    const mMeters = toMeters(mPos.x, mPos.y);

    // 0. Check Corridor Drawing mode (Multi-click polyline)
    if (editorMode === "draw_corridor") {
      let px = mMeters.x;
      let py = mMeters.y;
      if (physicsConfig.gridSnap) {
        px = Math.round(px / physicsConfig.gridSize) * physicsConfig.gridSize;
        py = Math.round(py / physicsConfig.gridSize) * physicsConfig.gridSize;
      }

      if (corridorPoints.length === 0) {
        // First point clicked!
        setCorridorPoints([{ x: px, y: py }]);
        setIsDrawingCorridor(true);
        setActiveDrawPoint({ x: px, y: py });
      } else {
        // Subsequent click! Commit segment
        const pLast = corridorPoints[corridorPoints.length - 1];
        
        // Lock to dominant axis (orthogonal drawing)
        const dx = Math.abs(px - pLast.x);
        const dy = Math.abs(py - pLast.y);
        let commitX = px;
        let commitY = py;
        if (dx > dy) {
          commitY = pLast.y;
        } else {
          commitX = pLast.x;
        }

        const finalDx = Math.abs(commitX - pLast.x);
        const finalDy = Math.abs(commitY - pLast.y);

        // Ensure there's a minimum distance to prevent double clicks creating tiny segments
        if (Math.max(finalDx, finalDy) > 0.25) {
          let w = 1.2;
          let h = 1.2;
          let x = commitX;
          let y = commitY;

          if (finalDx > finalDy) {
            w = finalDx;
            h = 1.2;
            x = (pLast.x + commitX) / 2;
            y = pLast.y;
          } else {
            w = 1.2;
            h = finalDy;
            x = pLast.x;
            y = (pLast.y + commitY) / 2;
          }

          const segmentId = `corridor_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

          // Dynamically detect nearby rooms (centers within 5m) to establish natural magnetic anchors
          const nearbyRoomIds = rooms
            .filter((r) => r.type !== "corridor")
            .map((r) => {
              const dx = r.x - x;
              const dy = r.y - y;
              const dist = Math.hypot(dx, dy);
              return { id: r.id, dist };
            })
            .sort((a, b) => a.dist - b.dist)
            .slice(0, 3) // Take up to the 3 closest rooms
            .map((r) => r.id);

          const segmentRoom: Room = {
            id: segmentId,
            name: `Pasillo ${rooms.filter((r) => r.type === "corridor").length + 1}`,
            type: "corridor",
            x: Number(x.toFixed(2)),
            y: Number(y.toFixed(2)),
            w: Number(w.toFixed(2)),
            h: Number(h.toFixed(2)),
            targetW: Number(w.toFixed(2)),
            targetH: Number(h.toFixed(2)),
            color: "#F8FAFC", // pristine slate off-white for corridors
            connections: nearbyRoomIds, // Auto-connect to closest rooms dynamically
            openings: [],
            furniture: [],
          };

          // Apply bidirectional connections: add this corridor segment's ID to adjacent rooms' connections list
          const updatedExistingRooms = rooms.map((r) => {
            if (nearbyRoomIds.includes(r.id)) {
              const alreadyConnected = r.connections.includes(segmentId);
              return {
                ...r,
                connections: alreadyConnected ? r.connections : [...r.connections, segmentId],
              };
            }
            return r;
          });

          onUpdateRooms([...updatedExistingRooms, segmentRoom]);
          setCorridorPoints([...corridorPoints, { x: commitX, y: commitY }]);
          setActiveDrawPoint({ x: commitX, y: commitY });
        }
      }
      return;
    }

    // 1. Check if placement modes are active
    if (editorMode === "add_door" || editorMode === "add_window") {
      // Find room clicked on and which side
      const clickedRoom = rooms.find((r) => {
        const halfW = r.w / 2;
        const halfH = r.h / 2;
        return (
          mMeters.x >= r.x - halfW &&
          mMeters.x <= r.x + halfW &&
          mMeters.y >= r.y - halfH &&
          mMeters.y <= r.y + halfH
        );
      });

      if (clickedRoom) {
        // Determine closest side edge of room clicked
        const rx = mMeters.x - clickedRoom.x;
        const ry = mMeters.y - clickedRoom.y;
        const normX = rx / (clickedRoom.w / 2);
        const normY = ry / (clickedRoom.h / 2);

        let side: "top" | "bottom" | "left" | "right" = "top";
        let offsetFraction = 0.5;

        if (Math.abs(normX) > Math.abs(normY)) {
          side = normX > 0 ? "right" : "left";
          offsetFraction = Number(((ry + clickedRoom.h / 2) / clickedRoom.h).toFixed(2));
        } else {
          side = normY > 0 ? "top" : "bottom";
          offsetFraction = Number(((rx + clickedRoom.w / 2) / clickedRoom.w).toFixed(2));
        }

        // Add opening
        const newOpening: RoomOpening = {
          id: `${editorMode === "add_door" ? "door" : "win"}_${Date.now()}`,
          type: editorMode === "add_door" ? "door" : "window",
          side,
          offset: Math.max(0.1, Math.min(0.9, offsetFraction)),
          width: editorMode === "add_door" ? 0.9 : 1.2,
        };

        const updatedRooms = rooms.map((r) => {
          if (r.id === clickedRoom.id) {
            return { ...r, openings: [...r.openings, newOpening] };
          }
          return r;
        });

        onUpdateRooms(updatedRooms);
        setEditorMode("select"); // revert back
      }
      return;
    }

    if (editorMode === "add_furniture") {
      // Place furniture in clicked room
      const clickedRoom = rooms.find((r) => {
        const halfW = r.w / 2;
        const halfH = r.h / 2;
        return (
          mMeters.x >= r.x - halfW &&
          mMeters.x <= r.x + halfW &&
          mMeters.y >= r.y - halfH &&
          mMeters.y <= r.y + halfH
        );
      });

      if (clickedRoom) {
        const relativeX = Number((mMeters.x - clickedRoom.x).toFixed(2));
        const relativeY = Number((mMeters.y - clickedRoom.y).toFixed(2));

        const preset = furniturePresets.find((f) => f.type === selectedFurnitureType);
        const newFurniture: FurnitureItem = {
          id: `f_${Date.now()}`,
          type: selectedFurnitureType,
          name: preset ? preset.name : "Mueble",
          x: relativeX,
          y: relativeY,
          w: preset ? preset.w : 1.0,
          h: preset ? preset.h : 1.0,
          rotation: 0,
        };

        const updatedRooms = rooms.map((r) => {
          if (r.id === clickedRoom.id) {
            return { ...r, furniture: [...r.furniture, newFurniture] };
          }
          return r;
        });

        onUpdateRooms(updatedRooms);
        setEditorMode("select");
      }
      return;
    }

    // 2. CHECK INTERACTION HIERARCHY (Resize, Opening, Furniture, Room Select)
    // 2.1 Check selected room's resize handles
    if (selectedRoomId) {
      const activeRoom = rooms.find((r) => r.id === selectedRoomId);
      if (activeRoom) {
        const pos = toPixels(activeRoom.x - activeRoom.w / 2, activeRoom.y - activeRoom.h / 2);
        const size = { w: activeRoom.w * zoom, h: activeRoom.h * zoom };

        const handles = [
          { name: "tl", x: pos.x, y: pos.y },
          { name: "tr", x: pos.x + size.w, y: pos.y },
          { name: "bl", x: pos.x, y: pos.y + size.h },
          { name: "br", x: pos.x + size.w, y: pos.y + size.h },
          { name: "t", x: pos.x + size.w / 2, y: pos.y },
          { name: "b", x: pos.x + size.w / 2, y: pos.y + size.h },
          { name: "l", x: pos.x, y: pos.y + size.h / 2 },
          { name: "r", x: pos.x + size.w, y: pos.y + size.h / 2 },
        ];

        const clickedHandle = handles.find((h) => Math.hypot(h.x - mPos.x, h.y - mPos.y) < 8);
        if (clickedHandle) {
          setEditTarget({ type: "resize", id: activeRoom.id, handle: clickedHandle.name });
          setDragStartMeters(mMeters);
          setDragStartRoomState({ ...activeRoom });
          return;
        }
      }
    }

    // 2.2 Check Furniture clicks
    for (const r of rooms) {
      for (const f of r.furniture) {
        const absX = r.x + f.x;
        const absY = r.y + f.y;
        const distance = Math.hypot(absX - mMeters.x, absY - mMeters.y);
        // within item boundary
        if (distance < Math.max(f.w, f.h) / 2) {
          setEditTarget({ type: "furniture", roomId: r.id, furnitureId: f.id });
          setSelectedElement({ type: "furniture", roomId: r.id, id: f.id });
          setDragStartMeters(mMeters);
          onSelectRoom(r.id);
          return;
        }
      }
    }

    // 2.3 Check Openings clicks
    for (const r of rooms) {
      const rX = r.x - r.w / 2;
      const rY = r.y - r.h / 2;

      for (const op of r.openings) {
        let opX = 0, opY = 0;
        if (op.side === "top" || op.side === "bottom") {
          const wallY = op.side === "top" ? rY + r.h : rY;
          opX = rX + r.w * op.offset;
          opY = wallY;
        } else {
          const wallX = op.side === "right" ? rX + r.w : rX;
          opX = wallX;
          opY = rY + r.h * op.offset;
        }

        if (Math.hypot(opX - mMeters.x, opY - mMeters.y) < 0.6) {
          setEditTarget({ type: "opening", roomId: r.id, openingId: op.id });
          setSelectedElement({ type: "opening", roomId: r.id, id: op.id });
          setDragStartMeters(mMeters);
          onSelectRoom(r.id);
          return;
        }
      }
    }

    // 2.4 Check Room body click
    const clickedRoom = rooms.find((r) => {
      const halfW = r.w / 2;
      const halfH = r.h / 2;
      return (
        mMeters.x >= r.x - halfW &&
        mMeters.x <= r.x + halfW &&
        mMeters.y >= r.y - halfH &&
        mMeters.y <= r.y + halfH
      );
    });

    if (clickedRoom) {
      setEditTarget({ type: "room", id: clickedRoom.id });
      setSelectedElement(null); // Clear selected object inside room when selecting room itself
      setDragStartMeters(mMeters);
      setDragStartRoomState({ ...clickedRoom });
      onSelectRoom(clickedRoom.id);
    } else {
      setSelectedElement(null); // Clear selected object when clicking on empty space
      onSelectRoom(null);
    }
  };

  const handleMouseMove = (e: MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (editorMode === "draw_corridor" && corridorPoints.length > 0) {
      const mPos = getMousePosOnCanvas(e);
      const mMeters = toMeters(mPos.x, mPos.y);

      // Snap cursor coordinate to grid if active
      let curX = mMeters.x;
      let curY = mMeters.y;
      if (physicsConfig.gridSnap) {
        curX = Math.round(curX / physicsConfig.gridSize) * physicsConfig.gridSize;
        curY = Math.round(curY / physicsConfig.gridSize) * physicsConfig.gridSize;
      }

      const pLast = corridorPoints[corridorPoints.length - 1];
      const dx = Math.abs(curX - pLast.x);
      const dy = Math.abs(curY - pLast.y);

      // Lock to dominant orthogonal axis
      let activeX = curX;
      let activeY = curY;
      if (dx > dy) {
        activeY = pLast.y;
      } else {
        activeX = pLast.x;
      }

      setActiveDrawPoint({ x: activeX, y: activeY });
      return;
    }

    if (!editTarget) return;

    const mPos = getMousePosOnCanvas(e);
    const mMeters = toMeters(mPos.x, mPos.y);

    const deltaX = mMeters.x - dragStartMeters.x;
    const deltaY = mMeters.y - dragStartMeters.y;

    if (editTarget.type === "room" && dragStartRoomState) {
      // Dragging entire room
      const snap = physicsConfig.gridSnap ? physicsConfig.gridSize : 0.01;
      let nextX = dragStartRoomState.x + deltaX;
      let nextY = dragStartRoomState.y + deltaY;

      // grid snap
      nextX = Math.round(nextX / snap) * snap;
      nextY = Math.round(nextY / snap) * snap;

      // Keep inside terrain boundaries
      const minBoundX = physicsConfig.gridSnap ? Math.round(terrain.setbackLeft / physicsConfig.gridSize) * physicsConfig.gridSize : terrain.setbackLeft;
      const maxBoundX = terrain.width - terrain.setbackRight;
      const minBoundY = physicsConfig.gridSnap ? Math.round(terrain.setbackFront / physicsConfig.gridSize) * physicsConfig.gridSize : terrain.setbackFront;
      const maxBoundY = terrain.length - terrain.setbackBack;

      nextX = Math.max(minBoundX + dragStartRoomState.w / 2, Math.min(maxBoundX - dragStartRoomState.w / 2, nextX));
      nextY = Math.max(minBoundY + dragStartRoomState.h / 2, Math.min(maxBoundY - dragStartRoomState.h / 2, nextY));

      const updated = rooms.map((r) => {
        if (r.id === editTarget.id) {
          return { ...r, x: Number(nextX.toFixed(2)), y: Number(nextY.toFixed(2)) };
        }
        return r;
      });
      onUpdateRooms(updated);
    } 
    
    else if (editTarget.type === "resize" && dragStartRoomState) {
      // Resizing Room
      const snap = physicsConfig.gridSnap ? physicsConfig.gridSize : 0.05;
      let nextW = dragStartRoomState.w;
      let nextH = dragStartRoomState.h;
      let nextX = dragStartRoomState.x;
      let nextY = dragStartRoomState.y;

      const handle = editTarget.handle;

      if (handle.includes("r")) {
        nextW = dragStartRoomState.w + deltaX * 2;
        nextW = Math.max(1.0, Math.round(nextW / snap) * snap);
      }
      if (handle.includes("l")) {
        nextW = dragStartRoomState.w - deltaX * 2;
        nextW = Math.max(1.0, Math.round(nextW / snap) * snap);
      }
      if (handle.includes("b")) {
        nextH = dragStartRoomState.h + deltaY * 2;
        nextH = Math.max(1.0, Math.round(nextH / snap) * snap);
      }
      if (handle.includes("t")) {
        nextH = dragStartRoomState.h - deltaY * 2;
        nextH = Math.max(1.0, Math.round(nextH / snap) * snap);
      }

      // diagonals
      if (handle === "tr") {
        nextW = dragStartRoomState.w + deltaX;
        nextH = dragStartRoomState.h - deltaY;
        nextX = dragStartRoomState.x + deltaX / 2;
        nextY = dragStartRoomState.y + deltaY / 2;
      }
      if (handle === "tl") {
        nextW = dragStartRoomState.w - deltaX;
        nextH = dragStartRoomState.h - deltaY;
        nextX = dragStartRoomState.x + deltaX / 2;
        nextY = dragStartRoomState.y + deltaY / 2;
      }
      if (handle === "br") {
        nextW = dragStartRoomState.w + deltaX;
        nextH = dragStartRoomState.h + deltaY;
        nextX = dragStartRoomState.x + deltaX / 2;
        nextY = dragStartRoomState.y + deltaY / 2;
      }
      if (handle === "bl") {
        nextW = dragStartRoomState.w - deltaX;
        nextH = dragStartRoomState.h + deltaY;
        nextX = dragStartRoomState.x + deltaX / 2;
        nextY = dragStartRoomState.y + deltaY / 2;
      }

      const updated = rooms.map((r) => {
        if (r.id === editTarget.id) {
          return {
            ...r,
            w: Number(nextW.toFixed(2)),
            h: Number(nextH.toFixed(2)),
            x: Number(nextX.toFixed(2)),
            y: Number(nextY.toFixed(2)),
            targetW: Number(nextW.toFixed(2)),
            targetH: Number(nextH.toFixed(2)),
          };
        }
        return r;
      });
      onUpdateRooms(updated);
    } 
    
    else if (editTarget.type === "opening") {
      // Dragging Door/Window along wall segment (updating offset percentage)
      const targetRoom = rooms.find((r) => r.id === editTarget.roomId);
      if (targetRoom) {
        const opening = targetRoom.openings.find((o) => o.id === editTarget.openingId);
        if (opening) {
          // Calculate click offset percentage based on coordinate axis relative to room
          let relativeOffset = 0.5;
          if (opening.side === "top" || opening.side === "bottom") {
            const rx = mMeters.x - (targetRoom.x - targetRoom.w / 2);
            relativeOffset = rx / targetRoom.w;
          } else {
            const ry = mMeters.y - (targetRoom.y - targetRoom.h / 2);
            relativeOffset = ry / targetRoom.h;
          }

          const constrainedOffset = Math.max(0.08, Math.min(0.92, relativeOffset));

          const updated = rooms.map((r) => {
            if (r.id === editTarget.roomId) {
              const ops = r.openings.map((o) => {
                if (o.id === editTarget.openingId) {
                  return { ...o, offset: Number(constrainedOffset.toFixed(2)) };
                }
                return o;
              });
              return { ...r, openings: ops };
            }
            return r;
          });
          onUpdateRooms(updated);
        }
      }
    } 
    
    else if (editTarget.type === "furniture") {
      // Dragging Furniture relative to parent Room center
      const targetRoom = rooms.find((r) => r.id === editTarget.roomId);
      if (targetRoom) {
        // Calculate offset in meters relative to parent room center
        const relativeX = Number((mMeters.x - targetRoom.x).toFixed(2));
        const relativeY = Number((mMeters.y - targetRoom.y).toFixed(2));

        // keep within bounds of the room with minor buffer
        const boundX = targetRoom.w / 2 - 0.2;
        const boundY = targetRoom.h / 2 - 0.2;

        const constrainedX = Math.max(-boundX, Math.min(boundX, relativeX));
        const constrainedY = Math.max(-boundY, Math.min(boundY, relativeY));

        const updated = rooms.map((r) => {
          if (r.id === editTarget.roomId) {
            const furn = r.furniture.map((f) => {
              if (f.id === editTarget.furnitureId) {
                return { ...f, x: constrainedX, y: constrainedY };
              }
              return f;
            });
            return { ...r, furniture: furn };
          }
          return r;
        });
        onUpdateRooms(updated);
      }
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setEditTarget(null);
    setDragStartRoomState(null);
    if (editorMode === "draw_corridor") {
      // Keep drawing multi-segment corridor
      return;
    }
  };

  // ACTIONS FOR ACTIVE ROOM ELEMENTS
  const rotateSelectedElement = () => {
    if (selectedElement && selectedElement.type === "furniture") {
      const { roomId, id } = selectedElement;
      const updatedRooms = rooms.map((r) => {
        if (r.id === roomId) {
          const furn = r.furniture.map((f) => {
            if (f.id === id) {
              return { ...f, rotation: (f.rotation + 90) % 360 };
            }
            return f;
          });
          return { ...r, furniture: furn };
        }
        return r;
      });
      onUpdateRooms(updatedRooms);
    } else if (selectedRoomId) {
      // Fallback: rotate the last furniture item in the room
      const activeRoom = rooms.find((r) => r.id === selectedRoomId);
      if (activeRoom && activeRoom.furniture.length > 0) {
        const updatedRooms = rooms.map((r) => {
          if (r.id === selectedRoomId) {
            const furn = r.furniture.map((f, idx) => {
              if (idx === r.furniture.length - 1) {
                return { ...f, rotation: (f.rotation + 90) % 360 };
              }
              return f;
            });
            return { ...r, furniture: furn };
          }
          return r;
        });
        onUpdateRooms(updatedRooms);
      }
    }
  };

  const deleteSelectedElement = () => {
    if (selectedElement) {
      const { type, roomId, id } = selectedElement;
      const updatedRooms = rooms.map((r) => {
        if (r.id === roomId) {
          if (type === "furniture") {
            return {
              ...r,
              furniture: r.furniture.filter((f) => f.id !== id),
            };
          } else if (type === "opening") {
            return {
              ...r,
              openings: r.openings.filter((op) => op.id !== id),
            };
          }
        }
        return r;
      });
      onUpdateRooms(updatedRooms);
      setSelectedElement(null);
    } else if (selectedRoomId) {
      // Delete the selected room
      const updatedRooms = rooms.filter((r) => r.id !== selectedRoomId);
      onUpdateRooms(updatedRooms);
      onSelectRoom(null);
    }
  };

  return (
    <div className="flex flex-col w-full h-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
      
      {/* Interactive Sub-header tool bar */}
      <div className="flex flex-wrap justify-between items-center bg-slate-50 border-b border-slate-200 px-4 py-2.5 gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Modos de Edición:</span>
          
          <button
            id="editor-select-mode"
            onClick={() => setEditorMode("select")}
            className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-all flex items-center gap-1 cursor-pointer ${
              editorMode === "select"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 hover:bg-slate-100 border-slate-200"
            }`}
          >
            <Move className="w-3.5 h-3.5" /> Seleccionar / Mover
          </button>

          <button
            id="editor-draw-corridor-mode"
            onClick={() => setEditorMode("draw_corridor")}
            className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-all flex items-center gap-1 cursor-pointer ${
              editorMode === "draw_corridor"
                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                : "bg-white text-indigo-600 hover:bg-indigo-50 border-slate-200"
            }`}
          >
            <PenTool className="w-3.5 h-3.5" /> Dibujar Corredor
          </button>

          <button
            id="editor-add-door-mode"
            onClick={() => setEditorMode("add_door")}
            className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-all flex items-center gap-1 cursor-pointer ${
              editorMode === "add_door"
                ? "bg-amber-600 text-white border-amber-600"
                : "bg-white text-slate-600 hover:bg-slate-100 border-slate-200"
            }`}
          >
            <Plus className="w-3.5 h-3.5" /> + Puerta
          </button>

          <button
            id="editor-add-window-mode"
            onClick={() => setEditorMode("add_window")}
            className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-all flex items-center gap-1 ${
              editorMode === "add_window"
                ? "bg-sky-600 text-white border-sky-600"
                : "bg-white text-slate-600 hover:bg-slate-100 border-slate-200"
            }`}
          >
            <Plus className="w-3.5 h-3.5" /> + Ventana
          </button>
        </div>

        {/* Add furniture palette dropdown */}
        <div className="flex items-center gap-2">
          <select
            id="furniture-select-dropdown"
            value={selectedFurnitureType}
            onChange={(e) => {
              setSelectedFurnitureType(e.target.value as FurnitureItem["type"]);
              setEditorMode("add_furniture");
            }}
            className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 font-medium focus:ring-1 focus:ring-slate-900"
          >
            {furniturePresets.map((f) => (
              <option key={f.type} value={f.type}>
                🛋️ {f.name} ({f.w}x{f.h}m)
              </option>
            ))}
          </select>
          
          <button
            id="add-furniture-mode-btn"
            onClick={() => setEditorMode("add_furniture")}
            className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-all ${
              editorMode === "add_furniture"
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-emerald-600 hover:bg-slate-100 border-slate-200"
            }`}
          >
            + Amoblar plano
          </button>
        </div>
      </div>

      {/* Editor active warnings / guide banner */}
      {editorMode !== "select" && (
        <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-2 text-xs text-indigo-700 flex justify-between items-center animate-fade-in">
          <span>
            {editorMode === "draw_corridor" && (
              corridorPoints.length === 0 
                ? "👉 Haz CLICK en el plano para colocar el primer vértice del Corredor."
                : `👉 Haz CLICK para añadir más tramos continuos de 1.20m (0.60m a cada lado). Tramos actuales: ${corridorPoints.length - 1}.`
            )}
            {editorMode === "add_door" && "👉 Haz CLICK en un muro de la habitación para añadir una Puerta abatible."}
            {editorMode === "add_window" && "👉 Haz CLICK en un muro de la habitación para añadir una Ventana acristalada."}
            {editorMode === "add_furniture" && `👉 Haz CLICK dentro de una habitación para colocar un(a): ${furniturePresets.find(f => f.type === selectedFurnitureType)?.name}.`}
          </span>
          <div className="flex items-center gap-2">
            {editorMode === "draw_corridor" && corridorPoints.length > 1 && (
              <button
                onClick={handleFinishCorridor}
                className="px-2.5 py-1 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold cursor-pointer shadow-xs mr-2"
              >
                ✔️ Finalizar y Guardar
              </button>
            )}
            <button
              onClick={() => setEditorMode("select")}
              className="text-xs underline hover:text-indigo-900 font-semibold cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Canvas container with absolute floating buttons */}
      <div ref={containerRef} className="relative flex-1 w-full h-full min-h-[450px]">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleFinishCorridor}
          className="absolute inset-0 w-full h-full block cursor-crosshair touch-none"
          id="2d-floorplan-canvas"
        />

        {/* Floating Zoom & Action bar */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-10">
          <div className="flex flex-col bg-white border border-slate-200 rounded-xl shadow-md p-1">
            <button
              id="zoom-in-btn"
              onClick={() => handleZoom(4)}
              title="Aumentar Zoom"
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all"
            >
              <ZoomIn className="w-4.5 h-4.5" />
            </button>
            <button
              id="zoom-out-btn"
              onClick={() => handleZoom(-4)}
              title="Disminuir Zoom"
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg border-t border-slate-100 transition-all"
            >
              <ZoomOut className="w-4.5 h-4.5" />
            </button>
          </div>

          {(selectedElement || selectedRoomId) && (
            <div className="flex flex-col bg-white border border-slate-200 rounded-xl shadow-md p-1">
              {/* Rotate Option (only if a furniture item is selected, or if a room with furniture is selected as fallback) */}
              {((selectedElement && selectedElement.type === "furniture") || 
                (!selectedElement && selectedRoomId && rooms.find(r => r.id === selectedRoomId)?.furniture.length)) && (
                <button
                  id="rotate-furniture-btn"
                  onClick={rotateSelectedElement}
                  title={selectedElement ? "Rotar mueble seleccionado (R)" : "Rotar último mueble (R)"}
                  className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                >
                  <RotateCw className="w-4.5 h-4.5" />
                </button>
              )}
              {/* Delete Option */}
              <button
                id="delete-element-btn"
                onClick={deleteSelectedElement}
                title={
                  selectedElement 
                    ? selectedElement.type === "furniture" 
                      ? "Eliminar mueble seleccionado (Supr/Retroceso)" 
                      : "Eliminar puerta/ventana seleccionada (Supr/Retroceso)"
                    : "Eliminar habitación seleccionada (Supr/Retroceso)"
                }
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg border-t border-slate-100 transition-all"
              >
                <Trash2 className="w-4.5 h-4.5" />
              </button>
            </div>
          )}
        </div>

        {/* 2D Guide hint on margins */}
        <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-md border border-slate-200/50 rounded-xl px-3 py-2 shadow-sm pointer-events-none text-[10px] text-slate-500 flex flex-col gap-0.5">
          <span className="font-semibold text-slate-700 flex items-center gap-1">🛠️ Controles de Edición</span>
          <span>• Seleccione muebles o vanos para eliminarlos o rotarlos.</span>
          <span>• Arrastre habitaciones para reubicarlas.</span>
          <span>• Arrastre los círculos azules para redimensionar.</span>
          <span>• Arrastre muebles y vanos para deslizarlos.</span>
          <span>• Teclas: [Supr / Retroceso] para borrar, [R] para rotar.</span>
        </div>
      </div>
    </div>
  );
}
