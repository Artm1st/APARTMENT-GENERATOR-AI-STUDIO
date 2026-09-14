/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Room, Terrain } from "../types";

/**
 * Exports the floor plan as a standard formatted DXF file (as text string)
 * which can be downloaded and opened directly in AutoCAD, Rhino, etc.
 */
export function exportToDXF(rooms: Room[], terrain: Terrain, planName: string): string {
  let dxf = "";

  // Helper to add entity header
  const addEntity = (type: string, layer: string) => {
    dxf += `  0\n${type}\n  8\n${layer}\n`;
  };

  // Helper to add 2D Point
  const addPoint = (codeX: number, x: number, codeY: number, y: number) => {
    dxf += `${codeX}\n${x.toFixed(4)}\n${codeY}\n${y.toFixed(4)}\n`;
  };

  // 1. HEADER SECTION
  dxf += "  0\nSECTION\n  2\nHEADER\n  0\nENDSEC\n";

  // 2. TABLES SECTION (for Layers configuration)
  dxf += "  0\nSECTION\n  2\nTABLES\n  0\nTABLE\n  2\nLAYER\n 70\n     6\n";
  
  // Layer: BIM_A_Terreno (color 8 = grey)
  dxf += "  0\nLAYER\n  2\nBIM_A_Terreno\n 70\n     0\n 62\n     8\n  6\nCONTINUOUS\n";
  // Layer: BIM_A_Muros (color 7 = black/white)
  dxf += "  0\nLAYER\n  2\nBIM_A_Muros\n 70\n     0\n 62\n     7\n  6\nCONTINUOUS\n";
  // Layer: BIM_A_Puertas (color 1 = red)
  dxf += "  0\nLAYER\n  2\nBIM_A_Puertas\n 70\n     0\n 62\n     1\n  6\nCONTINUOUS\n";
  // Layer: BIM_A_Ventanas (color 4 = cyan)
  dxf += "  0\nLAYER\n  2\nBIM_A_Ventanas\n 70\n     0\n 62\n     4\n  6\nCONTINUOUS\n";
  // Layer: BIM_A_Mobiliario (color 3 = green)
  dxf += "  0\nLAYER\n  2\nBIM_A_Mobiliario\n 70\n     0\n 62\n     3\n  6\nCONTINUOUS\n";
  // Layer: BIM_A_Espacios (color 2 = yellow)
  dxf += "  0\nLAYER\n  2\nBIM_A_Espacios\n 70\n     0\n 62\n     2\n  6\nCONTINUOUS\n";

  dxf += "  0\nENDTAB\n  0\nENDSEC\n";

  // 3. ENTITIES SECTION
  dxf += "  0\nSECTION\n  2\nENTITIES\n";

  // Comments for Plan BIM Chile Exchange compatibility in DXF
  dxf += "  999\nESTANDAR PLAN BIM CHILE - IFC EXCHANGE DATA\n";
  dxf += "  999\nENTIDAD_DE_PROYECTO: IfcProject\n";
  dxf += `  999\nNOMBRE_PLANO: ${planName}\n`;
  dxf += "  999\nNORMATIVA_CONSTRUCCION: RNE Norma A.020 (Vivienda)\n";

  // Draw Terrain Border as a closed Polyline
  addEntity("LWPOLYLINE", "BIM_A_Terreno");
  dxf += ` 90\n     4\n 70\n     1\n`; // 4 vertices, closed (70=1)
  addPoint(10, 0, 20, 0);
  addPoint(10, terrain.width, 20, 0);
  addPoint(10, terrain.width, 20, terrain.length);
  addPoint(10, 0, 20, terrain.length);

  // Draw Setback Bounds
  const setbackMinX = terrain.setbackLeft;
  const setbackMaxX = terrain.width - terrain.setbackRight;
  const setbackMinY = terrain.setbackFront;
  const setbackMaxY = terrain.length - terrain.setbackBack;

  addEntity("LWPOLYLINE", "BIM_A_Terreno");
  dxf += ` 90\n     4\n 70\n     1\n`; // 4 vertices, closed
  addPoint(10, setbackMinX, 20, setbackMinY);
  addPoint(10, setbackMaxX, 20, setbackMinY);
  addPoint(10, setbackMaxX, 20, setbackMaxY);
  addPoint(10, setbackMinX, 20, setbackMaxY);

  // Draw Rooms and Walls
  rooms.forEach((room) => {
    const halfW = room.w / 2;
    const halfH = room.h / 2;
    const xMin = room.x - halfW;
    const xMax = room.x + halfW;
    const yMin = room.y - halfH;
    const yMax = room.y + halfH;

    // Outer Room Wall Polyline (IfcWallStandardCase / BIM_A_Muros)
    addEntity("LWPOLYLINE", "BIM_A_Muros");
    dxf += ` 90\n     4\n 70\n     1\n`; // 4 vertices, closed
    addPoint(10, xMin, 20, yMin);
    addPoint(10, xMax, 20, yMin);
    addPoint(10, xMax, 20, yMax);
    addPoint(10, xMin, 20, yMax);

    // BIM Space Label (IfcSpace / BIM_A_Espacios)
    addEntity("TEXT", "BIM_A_Espacios");
    addPoint(10, room.x, 20, room.y);
    dxf += ` 40\n0.35\n  1\n${room.name}\n`; // height 0.35m

    // Room Dimensions Label underneath
    addEntity("TEXT", "BIM_A_Espacios");
    addPoint(10, room.x, 20, room.y - 0.4);
    dxf += ` 40\n0.22\n  1\n${room.w.toFixed(1)}x${room.h.toFixed(1)} m\n`;

    // Draw Openings (Vanos)
    room.openings.forEach((opening) => {
      let opX1 = 0, opY1 = 0, opX2 = 0, opY2 = 0;
      const oHalfW = opening.width / 2;

      // Calculate placement segment based on room wall side and offset
      if (opening.side === "top" || opening.side === "bottom") {
        const wallY = opening.side === "top" ? yMax : yMin;
        const startX = xMin + room.w * opening.offset;
        opX1 = startX - oHalfW;
        opX2 = startX + oHalfW;
        opY1 = wallY;
        opY2 = wallY;
      } else {
        const wallX = opening.side === "right" ? xMax : xMin;
        const startY = yMin + room.h * opening.offset;
        opY1 = startY - oHalfW;
        opY2 = startY + oHalfW;
        opX1 = wallX;
        opX2 = wallX;
      }

      if (opening.type === "window") {
        // Draw window (IfcWindow / BIM_A_Ventanas)
        addEntity("LINE", "BIM_A_Ventanas");
        addPoint(10, opX1, 20, opY1);
        addPoint(11, opX2, 21, opY2);

        const dX = opening.side === "left" || opening.side === "right" ? 0.05 : 0;
        const dY = opening.side === "top" || opening.side === "bottom" ? 0.05 : 0;

        addEntity("LINE", "BIM_A_Ventanas");
        addPoint(10, opX1 + dX, 20, opY1 + dY);
        addPoint(11, opX2 + dX, 21, opY2 + dY);
      } else if (opening.type === "door") {
        // Draw door (IfcDoor / BIM_A_Puertas)
        addEntity("LINE", "BIM_A_Puertas");
        addPoint(10, opX1, 20, opY1);
        addPoint(11, opX2, 21, opY2);

        // Draw door leaf swung open (90 deg)
        let leafX2 = opX1;
        let leafY2 = opY1;

        if (opening.side === "top") {
          leafY2 = opY1 + opening.width;
        } else if (opening.side === "bottom") {
          leafY2 = opY1 - opening.width;
        } else if (opening.side === "left") {
          leafX2 = opX1 - opening.width;
        } else if (opening.side === "right") {
          leafX2 = opX1 + opening.width;
        }

        addEntity("LINE", "BIM_A_Puertas");
        addPoint(10, opX1, 20, opY1);
        addPoint(11, leafX2, 21, leafY2);
      }
    });

    // Draw Furniture items (IfcFurnishingElement / BIM_A_Mobiliario)
    room.furniture.forEach((item) => {
      // Calculate absolute position based on relative offsets
      const absX = room.x + item.x;
      const absY = room.y + item.y;
      const fHalfW = item.w / 2;
      const fHalfH = item.h / 2;

      addEntity("LWPOLYLINE", "BIM_A_Mobiliario");
      dxf += ` 90\n     4\n 70\n     1\n`; // 4 vertices, closed
      addPoint(10, absX - fHalfW, 20, absY - fHalfH);
      addPoint(10, absX + fHalfW, 20, absY - fHalfH);
      addPoint(10, absX + fHalfW, 20, absY + fHalfH);
      addPoint(10, absX - fHalfW, 20, absY + fHalfH);

      // Label furniture name small
      addEntity("TEXT", "BIM_A_Mobiliario");
      addPoint(10, absX, 20, absY - 0.1);
      dxf += ` 40\n0.12\n  1\n${item.name}\n`;
    });
  });

  // End section & EOF
  dxf += "  0\nENDSEC\n  0\nEOF\n";
  return dxf;
}

/**
 * Exports the floor plan as a styled SVG string for download or vector editing.
 */
export function exportToSVG(rooms: Room[], terrain: Terrain, planName: string): string {
  const scale = 40; // 40 pixels per meter
  const border = 50; // border margin
  const widthPx = terrain.width * scale + border * 2;
  const heightPx = terrain.length * scale + border * 2;

  let svg = `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthPx} ${heightPx + 170}" width="100%" height="100%" style="background-color: #FAFAFA; font-family: 'Inter', sans-serif;">
  <style>
    .terrain { stroke: #6B7280; stroke-width: 2; fill: #FFFFFF; stroke-dasharray: 4,4; }
    .setback { stroke: #EF4444; stroke-width: 1.5; fill: none; stroke-dasharray: 2,2; }
    .room { stroke: #1F2937; stroke-width: 3; fill-opacity: 0.85; transition: all 0.2s; }
    .wall-interior { stroke: #1F2937; stroke-width: 2; fill: none; }
    .door { stroke: #D97706; stroke-width: 2; fill: none; }
    .window { stroke: #0284C7; stroke-width: 4; fill: #E0F2FE; }
    .furniture { stroke: #10B981; stroke-width: 1.5; fill: #ECFDF5; fill-opacity: 0.7; }
    .text-title { font-size: 18px; font-weight: bold; fill: #111827; }
    .text-subtitle { font-size: 11px; fill: #4B5563; }
    .text-room { font-size: 12px; font-weight: 600; fill: #111827; text-anchor: middle; }
    .text-dims { font-size: 9px; fill: #374151; text-anchor: middle; }
    .grid-line { stroke: #E5E7EB; stroke-width: 0.5; }
    .axis-label { font-size: 9px; fill: #9CA3AF; }
    .bim-stamp-border { stroke: #059669; stroke-width: 1.5; fill: #ECFDF5; stroke-dasharray: 2,2; }
    .bim-stamp-text { font-size: 10px; font-weight: bold; fill: #065F46; }
  </style>

  <!-- Definition of patterns if any -->
  <defs>
    <pattern id="setbackPattern" width="10" height="10" patternUnits="userSpaceOnUse">
      <line x1="0" y1="10" x2="10" y2="0" stroke="#FEE2E2" stroke-width="1"/>
    </pattern>
  </defs>

  <g transform="translate(${border}, ${border})">
    <!-- Grid System -->
  `;

  // Draw meters grid lines
  for (let x = 0; x <= terrain.width; x++) {
    const xPx = x * scale;
    svg += `    <line x1="${xPx}" y1="0" x2="${xPx}" y2="${terrain.length * scale}" class="grid-line" />\n`;
    svg += `    <text x="${xPx}" y="-8" class="axis-label" text-anchor="middle">${x}m</text>\n`;
  }
  // Y Grid lines
  for (let y = 0; y <= terrain.length; y++) {
    const yPx = y * scale;
    svg += `    <line x1="0" y1="${yPx}" x2="${terrain.width * scale}" y2="${yPx}" class="grid-line" />\n`;
    svg += `    <text x="-12" y="${yPx + 3}" class="axis-label" text-anchor="end">${y}m</text>\n`;
  }

  // Draw Terrain Bounds
  svg += `
    <!-- Boundary lines -->
    <rect x="0" y="0" width="${terrain.width * scale}" height="${terrain.length * scale}" class="terrain" data-ifc-entity="IfcSite" />
  `;

  // Draw Setback Box
  const sMinX = terrain.setbackLeft * scale;
  const sMinY = terrain.setbackFront * scale;
  const sMaxX = (terrain.width - terrain.setbackRight) * scale;
  const sMaxY = (terrain.length - terrain.setbackBack) * scale;
  svg += `
    <rect x="${sMinX}" y="${sMinY}" width="${sMaxX - sMinX}" height="${sMaxY - sMinY}" class="setback" />
    <text x="${sMinX + 10}" y="${sMinY + 18}" style="fill:#EF4444; font-size:9px; font-weight:600;">ÁREA EDIFICABLE (Setbacks)</text>
  `;

  // Draw Rooms
  rooms.forEach((room) => {
    const rX = (room.x - room.w / 2) * scale;
    const rY = (room.y - room.h / 2) * scale;
    const rW = room.w * scale;
    const rH = room.h * scale;

    svg += `
    <!-- Habitación: ${room.name} -->
    <g data-ifc-entity="IfcSpace" data-bim-type="${room.type}" data-room-id="${room.id}">
      <rect x="${rX}" y="${rY}" width="${rW}" height="${rH}" fill="${room.color}" class="room" id="svg-room-${room.id}" />
    `;

    // Draw furniture in SVG
    room.furniture.forEach((item) => {
      const fX = (room.x + item.x - item.w / 2) * scale;
      const fY = (room.y + item.y - item.h / 2) * scale;
      const fW = item.w * scale;
      const fH = item.h * scale;
      const fRot = item.rotation;

      svg += `
      <!-- Furniture: ${item.name} -->
      <rect x="${fX}" y="${fY}" width="${fW}" height="${fH}" class="furniture" 
            data-ifc-entity="IfcFurnishingElement" data-bim-code="BIM_MOB_EQUIP_${item.type.toUpperCase()}"
            transform="rotate(${fRot}, ${fX + fW/2}, ${fY + fH/2})" rx="3" />
      <line x1="${fX}" y1="${fY}" x2="${fX + fW}" y2="${fY + fH}" stroke="#10B981" stroke-width="0.5" stroke-opacity="0.3" transform="rotate(${fRot}, ${fX + fW/2}, ${fY + fH/2})" />
      `;
    });

    // Draw Openings
    room.openings.forEach((opening) => {
      const oHalfW = opening.width / 2;
      let oXPx = 0;
      let oYPx = 0;

      // Calculate absolute position on the border
      const rX_meters = room.x - room.w / 2;
      const rY_meters = room.y - room.h / 2;

      if (opening.side === "top" || opening.side === "bottom") {
        const wallY_meters = opening.side === "top" ? rY_meters + room.h : rY_meters;
        const oXMeters = rX_meters + room.w * opening.offset;
        oXPx = oXMeters * scale;
        oYPx = wallY_meters * scale;

        if (opening.type === "window") {
          svg += `      <rect x="${oXPx - oHalfW * scale}" y="${oYPx - 3}" width="${opening.width * scale}" height="6" class="window" data-ifc-entity="IfcWindow" data-bim-code="BIM_COM_VANO_VENTANA" />\n`;
        } else if (opening.type === "door") {
          // Draw door gap
          svg += `      <rect x="${oXPx - oHalfW * scale}" y="${oYPx - 4}" width="${opening.width * scale}" height="8" fill="${room.color}" stroke="none" />\n`;
          // Draw swing line
          const rDir = opening.side === "top" ? -1 : 1;
          const arcPx = opening.width * scale;
          svg += `      <line x1="${oXPx - oHalfW * scale}" y1="${oYPx}" x2="${oXPx - oHalfW * scale}" y2="${oYPx + arcPx * rDir}" class="door" data-ifc-entity="IfcDoor" data-bim-code="BIM_COM_VANO_PUERTA" />\n`;
          svg += `      <path d="M ${oXPx - oHalfW * scale} ${oYPx + arcPx * rDir} A ${arcPx} ${arcPx} 0 0 ${opening.side === "top" ? 1 : 0} ${oXPx + oHalfW * scale} ${oYPx}" class="door" stroke-dasharray="2,2" />\n`;
        }
      } else {
        const wallX_meters = opening.side === "right" ? rX_meters + room.w : rX_meters;
        const oYMeters = rY_meters + room.h * opening.offset;
        oXPx = wallX_meters * scale;
        oYPx = oYMeters * scale;

        if (opening.type === "window") {
          svg += `      <rect x="${oXPx - 3}" y="${oYPx - oHalfW * scale}" width="6" height="${opening.width * scale}" class="window" data-ifc-entity="IfcWindow" data-bim-code="BIM_COM_VANO_VENTANA" />\n`;
        } else if (opening.type === "door") {
          // Draw door gap
          svg += `      <rect x="${oXPx - 4}" y="${oYPx - oHalfW * scale}" width="8" height="${opening.width * scale}" fill="${room.color}" stroke="none" />\n`;
          // Draw swing line
          const rDir = opening.side === "left" ? 1 : -1;
          const arcPx = opening.width * scale;
          svg += `      <line x1="${oXPx}" y1="${oYPx - oHalfW * scale}" x2="${oXPx + arcPx * rDir}" y2="${oYPx - oHalfW * scale}" class="door" data-ifc-entity="IfcDoor" data-bim-code="BIM_COM_VANO_PUERTA" />\n`;
          svg += `      <path d="M ${oXPx + arcPx * rDir} ${oYPx - oHalfW * scale} A ${arcPx} ${arcPx} 0 0 ${opening.side === "left" ? 1 : 0} ${oXPx} ${oYPx + oHalfW * scale}" class="door" stroke-dasharray="2,2" />\n`;
        }
      }
    });

    // Room Label and dimensions text
    svg += `
      <text x="${rX + rW / 2}" y="${rY + rH / 2}" class="text-room">${room.name}</text>
      <text x="${rX + rW / 2}" y="${rY + rH / 2 + 13}" class="text-dims">${room.w.toFixed(1)} x ${room.h.toFixed(1)} m</text>
    </g>
    `;
  });

  // End Group
  svg += `  </g>\n`;

  // Draw Title block and layout metadata at the bottom
  const titleY = heightPx + 20;
  const siteArea = terrain.width * terrain.length;
  const buildableArea = (terrain.width - terrain.setbackLeft - terrain.setbackRight) * 
                        (terrain.length - terrain.setbackFront - terrain.setbackBack);
  const totalBuilt = rooms.reduce((acc, r) => acc + (r.w * r.h), 0);

  svg += `
  <!-- BLOCK TITLE / PRESENTATION WITH BIM COMPLIANCE -->
  <g transform="translate(50, ${titleY})">
    <line x1="0" y1="0" x2="${terrain.width * scale}" y2="0" stroke="#D1D5DB" stroke-width="1.5" />
    
    <text x="0" y="25" class="text-title">${planName ? planName.toUpperCase() : "PLANO DE DISEÑO GENERATIVO DE VIVIENDA"}</text>
    <text x="0" y="42" class="text-subtitle">Terreno: ${terrain.width}m x ${terrain.length}m | Sitio: ${siteArea.toFixed(1)} m² | Área de Setbacks: ${buildableArea.toFixed(1)} m²</text>
    <text x="0" y="58" class="text-subtitle" style="font-weight: 500;">Área Construida: ${totalBuilt.toFixed(1)} m² | Coeficiente Ocupación: ${((totalBuilt / siteArea) * 100).toFixed(1)}%</text>

    <!-- PLAN BIM CHILE & RNE COMPLIANCE STAMP -->
    <g transform="translate(0, 75)">
      <rect x="0" y="0" width="360" height="36" class="bim-stamp-border" rx="4" />
      <text x="12" y="21" class="bim-stamp-text">ESTÁNDAR PLAN BIM CHILE</text>
      <text x="170" y="21" style="font-size: 9px; fill: #047857;">Mapeo IFC: IfcSpace, IfcDoor, IfcWindow | Entregable NDI 2 | Norma RNE A.020</text>
    </g>

    <!-- Scale Bar -->
    <g transform="translate(${terrain.width * scale - 120}, 15)">
      <text x="60" y="-8" style="font-size: 10px; fill: #4B5563; font-weight: bold;" text-anchor="middle">ESCALA GRÁFICA</text>
      <rect x="0" y="0" width="120" height="8" fill="none" stroke="#111827" stroke-width="1.5" />
      <rect x="0" y="0" width="40" height="8" fill="#111827" />
      <rect x="80" y="0" width="40" height="8" fill="#111827" />
      <text x="0" y="20" style="font-size: 9px; fill: #4B5563;" text-anchor="middle">0</text>
      <text x="40" y="20" style="font-size: 9px; fill: #4B5563;" text-anchor="middle">1m</text>
      <text x="80" y="20" style="font-size: 9px; fill: #4B5563;" text-anchor="middle">2m</text>
      <text x="120" y="20" style="font-size: 9px; fill: #4B5563;" text-anchor="middle">3m</text>
    </g>
    
    <!-- Legend / Symbology -->
    <g transform="translate(0, 135)">
      <!-- Walls -->
      <rect x="0" y="0" width="15" height="15" fill="#E5E7EB" stroke="#111827" stroke-width="2" />
      <text x="22" y="11" style="font-size:10px; fill:#374151;">Muros (IfcWall)</text>

      <!-- Doors -->
      <path d="M 110 7 L 125 7 A 15 15 0 0 1 110 15 Z" class="door" transform="translate(10, -5)" />
      <text x="145" y="11" style="font-size:10px; fill:#374151;">Puertas (IfcDoor)</text>

      <!-- Windows -->
      <rect x="250" y="5" width="20" height="5" class="window" />
      <text x="280" y="11" style="font-size:10px; fill:#374151;">Ventanas (IfcWindow)</text>

      <!-- Furniture -->
      <rect x="390" y="2" width="15" height="11" class="furniture" rx="2" />
      <text x="412" y="11" style="font-size:10px; fill:#374151;">Equipos (IfcFurnishing)</text>
    </g>

    <text x="${terrain.width * scale}" y="145" style="font-size: 8px; fill: #9CA3AF; font-style: italic;" text-anchor="end">Generación de Diseño Generativo de Arquitectura | Standard compatible con Plan BIM Chile</text>
  </g>
</svg>
  `;

  return svg;
}
