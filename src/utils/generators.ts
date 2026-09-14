/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Room, Terrain, RoomOpening, FurnitureItem, RoomType } from "../types";

// Helper to generate a unique short ID
function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).substr(2, 9)}`;
}

// Helper to choose a random item from an array
function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generate procedurally randomized floor plans
export interface GeneratedLayout {
  planName: string;
  rooms: Room[];
  terrain: Terrain;
}

export function generateRandomLayout(): GeneratedLayout {
  // 1. Randomize Terrain dimensions
  const widthOptions = [10.0, 11.0, 12.0, 13.0, 14.0, 15.0];
  const lengthOptions = [16.0, 18.0, 20.0, 22.0, 24.0];
  
  const width = randomChoice(widthOptions);
  const length = randomChoice(lengthOptions);

  const setbackFront = randomChoice([3.5, 4.0, 4.5, 5.0]);
  const setbackBack = randomChoice([2.0, 2.5]);
  const setbackLeft = randomChoice([1.2, 1.5]);
  const setbackRight = randomChoice([1.2, 1.5]);

  const terrain: Terrain = {
    width,
    length,
    setbackFront,
    setbackBack,
    setbackLeft,
    setbackRight,
    hasPerimeterWall: true,
  };

  const buildableW = width - setbackLeft - setbackRight;
  const buildableH = length - setbackFront - setbackBack;
  const xCenter = width / 2;
  const yCenter = setbackFront + buildableH / 2;

  // Decide layout theme / style
  const layoutStyles = [
    {
      name: "Bungalow Familiar Compacto",
      description: "Distribución eficiente con pasillo central conector y optimización de flujos de luz.",
    },
    {
      name: "Villa Contemporánea de un Piso",
      description: "Zonas sociales abiertas de grandes dimensiones con circulación fluida alrededor del distribuidor principal.",
    },
    {
      name: "Casa de Campo Ecológica",
      description: "Concepto de casa de campo espaciosa con ventilación cruzada y hall distribuidor integrado.",
    },
    {
      name: "Pabellón Moderno con Pasillo Central",
      description: "Estilo minimalista donde el hall organiza la transición de áreas sociales frontales a recámaras traseras.",
    }
  ];

  const style = randomChoice(layoutStyles);
  const planName = style.name;

  // We need a corridor (Hall Distribuidor) that CONNECTS TO ALL SPACES.
  // To make sure it connects to all spaces physically and logically:
  // Let's design the layout with a central Hall Distribuidor ("pasillo").
  // Then we lay out:
  // - Sala / Estar
  // - Cocina / Comedor
  // - Dormitorio Principal
  // - Dormitorio Secundario / Estudio
  // - Baño Común
  // - Baño Suite (connected to bedroom and optionally pasillo, or just bedroom)
  // All major spaces are explicitly connected to ["pasillo"] for attraction!

  const pasilloW = 1.2;
  const pasilloH = Math.max(3.0, Math.floor(buildableH * 0.3)); // 3.0 to 4.5 meters
  const pasilloX = xCenter;
  const pasilloY = setbackFront + (buildableH * 0.5); // centered vertically in the buildable area

  // Generate rooms relative to this central spinal corridor
  const rooms: Room[] = [];

  // 1. HALL DISTRIBUIDOR (PASILLO) - The central node
  const corridorId = "pasillo";
  
  // Connections will include all generated rooms
  const corridorConnections = ["sala", "cocina", "dormitorio", "dormitorio_2", "bano"];

  const corridorRoom: Room = {
    id: corridorId,
    name: "Hall Distribuidor",
    type: "corridor",
    x: pasilloX,
    y: pasilloY,
    w: pasilloW,
    h: pasilloH,
    targetW: pasilloW,
    targetH: pasilloH,
    color: "#F1F5F9", // Slate 100
    connections: ["sala", "cocina", "dormitorio", "dormitorio_2", "bano"],
    openings: [],
    furniture: [],
  };

  // 2. SALA / ESTAR (Social area - front left)
  const salaW = Math.max(4.0, parseFloat((buildableW * 0.5).toFixed(1)));
  const salaH = Math.max(3.5, parseFloat((buildableH * 0.35).toFixed(1)));
  const salaX = xCenter - (buildableW * 0.22);
  const salaY = setbackFront + salaH / 2;

  const salaFurniture: FurnitureItem[] = [
    { id: generateId("fur"), type: "sofa", name: "Sofá Modular", x: 0, y: -0.8, w: 1.8, h: 0.85, rotation: 0 },
    { id: generateId("fur"), type: "tv", name: "Consola de Entretenimiento", x: 0, y: 1.2, w: 1.5, h: 0.4, rotation: 180 },
    { id: generateId("fur"), type: "plant", name: "Palmera Interior", x: -salaW / 2 + 0.5, y: -0.8, w: 0.5, h: 0.5, rotation: 0 },
  ];

  const salaRoom: Room = {
    id: "sala",
    name: "Sala de Estar",
    type: "living",
    x: salaX,
    y: salaY,
    w: salaW,
    h: salaH,
    targetW: salaW,
    targetH: salaH,
    color: "#FEF3C7", // Amber 100
    connections: [corridorId, "cocina"],
    openings: [
      { id: generateId("op"), type: "window", side: "bottom", offset: 0.5, width: 1.8 },
      { id: generateId("op"), type: "door", side: "top", offset: 0.7, width: 0.9 },
    ],
    furniture: salaFurniture,
  };

  // 3. COCINA / COMEDOR INTEGRADO (Social/Service area - front right)
  const cocinaW = Math.max(3.5, parseFloat((buildableW - salaW).toFixed(1)));
  const cocinaH = salaH; // match height of sala for structural harmony
  const cocinaX = salaX + (salaW / 2 + cocinaW / 2);
  const cocinaY = salaY;

  const cocinaFurniture: FurnitureItem[] = [
    { id: generateId("fur"), type: "fridge", name: "Nevera Side-by-Side", x: -cocinaW / 2 + 0.6, y: -cocinaH / 2 + 0.5, w: 0.8, h: 0.8, rotation: 90 },
    { id: generateId("fur"), type: "stove", name: "Cocina con Campana", x: 0, y: -cocinaH / 2 + 0.4, w: 0.8, h: 0.6, rotation: 0 },
    { id: generateId("fur"), type: "sink", name: "Fregadero de Acero", x: cocinaW / 2 - 0.6, y: -cocinaH / 2 + 0.4, w: 0.7, h: 0.5, rotation: 270 },
  ];

  // Maybe add a dining table if there's space
  if (cocinaW >= 3.8) {
    cocinaFurniture.push({
      id: generateId("fur"),
      type: "dining_table",
      name: "Mesa Comedor",
      x: 0,
      y: 0.8,
      w: 1.4,
      h: 0.8,
      rotation: 0,
    });
  }

  const cocinaRoom: Room = {
    id: "cocina",
    name: "Cocina Americana",
    type: "kitchen",
    x: cocinaX,
    y: cocinaY,
    w: cocinaW,
    h: cocinaH,
    targetW: cocinaW,
    targetH: cocinaH,
    color: "#FEE2E2", // Red 100
    connections: [corridorId, "sala"],
    openings: [
      { id: generateId("op"), type: "window", side: "right", offset: 0.4, width: 1.2 },
    ],
    furniture: cocinaFurniture,
  };

  // 4. DORMITORIO PRINCIPAL (Private area - back right)
  const dormPrincipalW = Math.max(3.8, parseFloat((buildableW * 0.48).toFixed(1)));
  const dormPrincipalH = Math.max(3.5, parseFloat((buildableH * 0.32).toFixed(1)));
  const dormPrincipalX = pasilloX + (pasilloW / 2 + dormPrincipalW / 2);
  const dormPrincipalY = pasilloY + (pasilloH / 2 - dormPrincipalH / 2);

  const dormPrincipalFurniture: FurnitureItem[] = [
    { id: generateId("fur"), type: "bed", name: "Cama Queen Size", x: 0, y: 0.6, w: 1.6, h: 1.9, rotation: 180 },
    { id: generateId("fur"), type: "wardrobe", name: "Armario Empotrado", x: -dormPrincipalW / 2 + 0.4, y: -0.8, w: 1.2, h: 0.6, rotation: 90 },
  ];

  const dormPrincipalRoom: Room = {
    id: "dormitorio",
    name: "Dormitorio Principal",
    type: "bedroom",
    x: dormPrincipalX,
    y: dormPrincipalY,
    w: dormPrincipalW,
    h: dormPrincipalH,
    targetW: dormPrincipalW,
    targetH: dormPrincipalH,
    color: "#DBEAFE", // Blue 100
    connections: [corridorId, "bano_privado"],
    openings: [
      { id: generateId("op"), type: "window", side: "right", offset: 0.6, width: 1.5 },
      { id: generateId("op"), type: "door", side: "left", offset: 0.2, width: 0.8 },
    ],
    furniture: dormPrincipalFurniture,
  };

  // 5. BAÑO SUITE (Inside Dormitorio Principal)
  const banoSuiteW = 2.0;
  const banoSuiteH = 1.6;
  const banoSuiteX = dormPrincipalX;
  const banoSuiteY = dormPrincipalY + (dormPrincipalH / 2 + banoSuiteH / 2) + 0.1;

  const banoSuiteRoom: Room = {
    id: "bano_privado",
    name: "Baño Suite",
    type: "bathroom",
    x: banoSuiteX,
    y: banoSuiteY,
    w: banoSuiteW,
    h: banoSuiteH,
    targetW: banoSuiteW,
    targetH: banoSuiteH,
    color: "#E0F2FE", // Sky 100
    connections: ["dormitorio"],
    openings: [
      { id: generateId("op"), type: "window", side: "right", offset: 0.5, width: 0.6 },
    ],
    furniture: [
      { id: generateId("fur"), type: "toilet", name: "Inodoro", x: -0.6, y: -0.2, w: 0.45, h: 0.65, rotation: 90 },
      { id: generateId("fur"), type: "sink", name: "Lavabo", x: 0.4, y: -0.3, w: 0.55, h: 0.45, rotation: 0 },
    ],
  };

  // 6. DORMITORIO SECUNDARIO o ESTUDIO (Private area - back left)
  const dorm2W = Math.max(3.4, parseFloat((buildableW * 0.44).toFixed(1)));
  const dorm2H = Math.max(3.2, parseFloat((buildableH * 0.28).toFixed(1)));
  const dorm2X = pasilloX - (pasilloW / 2 + dorm2W / 2);
  const dorm2Y = pasilloY + 0.4;

  const isOffice = Math.random() < 0.35;
  const dorm2Name = isOffice ? "Oficina / Estudio" : "Dormitorio Secundario";
  const dorm2Color = isOffice ? "#E2E8F0" : "#DBEAFE"; // Slate 100 or Blue 100

  const dorm2Furniture: FurnitureItem[] = isOffice ? [
    { id: generateId("fur"), type: "desk", name: "Escritorio Trabajo", x: 0, y: -0.5, w: 1.3, h: 0.65, rotation: 0 },
    { id: generateId("fur"), type: "chair", name: "Silla de Oficina", x: 0, y: 0.1, w: 0.55, h: 0.55, rotation: 180 },
    { id: generateId("fur"), type: "plant", name: "Planta de Interior", x: dorm2W / 2 - 0.4, y: -dorm2H / 2 + 0.4, w: 0.4, h: 0.4, rotation: 0 },
  ] : [
    { id: generateId("fur"), type: "bed", name: "Cama Individual", x: -0.4, y: 0.5, w: 1.0, h: 1.9, rotation: 180 },
    { id: generateId("fur"), type: "wardrobe", name: "Clóset Secundario", x: dorm2W / 2 - 0.4, y: -0.6, w: 1.0, h: 0.55, rotation: 270 },
  ];

  const dorm2Room: Room = {
    id: "dormitorio_2",
    name: dorm2Name,
    type: "bedroom",
    x: dorm2X,
    y: dorm2Y,
    w: dorm2W,
    h: dorm2H,
    targetW: dorm2W,
    targetH: dorm2H,
    color: dorm2Color,
    connections: [corridorId],
    openings: [
      { id: generateId("op"), type: "window", side: "left", offset: 0.5, width: 1.2 },
      { id: generateId("op"), type: "door", side: "right", offset: 0.2, width: 0.8 },
    ],
    furniture: dorm2Furniture,
  };

  // 7. BAÑO COMÚN / DE VISITAS (Next to pasillo / left side)
  const banoW = Math.max(2.2, parseFloat((buildableW * 0.22).toFixed(1)));
  const banoH = 1.8;
  const banoX = pasilloX - (pasilloW / 2 + banoW / 2);
  const banoY = pasilloY - 1.2;

  const banoRoom: Room = {
    id: "bano",
    name: "Baño Común",
    type: "bathroom",
    x: banoX,
    y: banoY,
    w: banoW,
    h: banoH,
    targetW: banoW,
    targetH: banoH,
    color: "#E0F2FE", // Sky 100
    connections: [corridorId],
    openings: [
      { id: generateId("op"), type: "window", side: "left", offset: 0.3, width: 0.6 },
      { id: generateId("op"), type: "door", side: "right", offset: 0.5, width: 0.8 },
    ],
    furniture: [
      { id: generateId("fur"), type: "toilet", name: "Inodoro", x: -banoW / 2 + 0.4, y: -0.3, w: 0.45, h: 0.65, rotation: 90 },
      { id: generateId("fur"), type: "sink", name: "Lavamanos", x: 0.1, y: -0.5, w: 0.55, h: 0.45, rotation: 0 },
      { id: generateId("fur"), type: "shower", name: "Ducha Mampara", x: banoW / 2 - 0.5, y: 0.3, w: 0.8, h: 0.8, rotation: 0 },
    ],
  };

  // Push all calculated rooms
  rooms.push(corridorRoom);
  rooms.push(salaRoom);
  rooms.push(cocinaRoom);
  rooms.push(dormPrincipalRoom);
  rooms.push(banoSuiteRoom);
  rooms.push(dorm2Room);
  rooms.push(banoRoom);

  // Return generated plan with aligned variables
  return {
    planName,
    rooms,
    terrain,
  };
}
