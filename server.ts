/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Set up server-side Gemini client with lazy initialization to prevent startup crashes if key is unconfigured
let aiInstance: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("La clave GEMINI_API_KEY no está configurada. Por favor, añádela en la sección de Ajustes / Secretos de AI Studio.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
          'Connection': 'close',
        }
      }
    });
  }
  return aiInstance;
}

app.use(express.json());

// API route: Generative Floor Plan
app.post("/api/generate-floorplan", async (req, res) => {
  try {
    const { prompt, terrainWidth, terrainLength } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "El prompt es requerido para generar un plano." });
    }

    const tWidth = Number(terrainWidth) || 12;
    const tLength = Number(terrainLength) || 20;

    // Define room colors
    const colors = {
      living: "#FEF3C7", // amber 100
      bedroom: "#DBEAFE", // blue 100
      bathroom: "#E0F2FE", // sky 100
      kitchen: "#FEE2E2", // red 100
      dining: "#FEF3C7", // amber 100
      corridor: "#F3F4F6", // gray 100
      garage: "#E5E7EB", // gray 200
      laundry: "#ECEFfc", // indigo 50
      other: "#F5F5F5"
    };

    const systemInstruction = `
Eres un arquitecto experto de nivel mundial especializado en diseño de distribución generativa y programación espacial de viviendas residenciales. 
Tu tarea es analizar los requerimientos del usuario para su plano de vivienda y proponer un listado de ambientes (habitaciones) lógicos, con dimensiones realistas y funcionales en metros, junto con una red de conexiones (adyacencias) de magnetismo arquitectónico que definan qué ambientes deben estar pegados para una óptima circulación.

REGLAS DE DISEÑO ARQUITECTÓNICO:
1. Terreno Máximo: El terreno útil mide ${tWidth}m de ancho x ${tLength}m de largo. Ningún ambiente individual debe superar las dimensiones del terreno. Un dormitorio típico mide entre 3x3m y 4x4m. Un baño mide entre 1.5x2m y 2.5x3m. Una sala comedor mide de 3.5x5m a 5x8m. Una cocina mide de 2x3m a 3.5x4m.
2. Circulación: Agrega siempre un ambiente de tipo 'corridor' (Pasillo, Distribuidor o Hall) que actúe como conector central si la vivienda tiene más de 3 ambientes privados (como dormitorios). Esto evita que el usuario tenga que atravesar un dormitorio para llegar a otro.
3. Conexiones (Adjacency Matrix): Define un listado de IDs de ambientes a los que se conecta cada ambiente de forma atractiva ('connections'). Por ejemplo, la Cocina se conecta con Sala/Comedor; el Baño de Visitas con el Pasillo; el Dormitorio Principal con su Baño Principal (baño en suite); la Lavandería con la Cocina.
4. Mobiliario sugerido: Para cada ambiente, sugiere de 1 a 3 tipos de muebles esenciales de la siguiente lista: 'sofa', 'tv', 'dining_table', 'chair', 'bed', 'wardrobe', 'sink', 'toilet', 'shower', 'fridge', 'stove', 'desk', 'plant'.
5. Posicionamiento inicial: Asígnale a cada ambiente un centro inicial (x, y) aproximado dentro de los límites del terreno para que empiece la simulación de relajación.

Debes retornar los ambientes en un formato estructurado JSON que cumpla exactamente el esquema provisto.
    `;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        suggestedPlanName: {
          type: Type.STRING,
          description: "Nombre descriptivo sugerido para este plano (ej. Casa Moderna Compacta)"
        },
        rooms: {
          type: Type.ARRAY,
          description: "Lista de ambientes que componen el plano",
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING, description: "ID único para la habitación (ej. 'dormitorio_1', 'sala')" },
              name: { type: Type.STRING, description: "Nombre legible en español (ej. 'Dormitorio Principal', 'Cocina')" },
              type: { 
                type: Type.STRING, 
                enum: ["living", "bedroom", "bathroom", "kitchen", "dining", "corridor", "garage", "laundry", "other"],
                description: "Tipo de habitación estándar"
              },
              targetW: { type: Type.NUMBER, description: "Ancho ideal en metros (número flotante)" },
              targetH: { type: Type.NUMBER, description: "Largo ideal en metros (número flotante)" },
              connections: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "IDs de otras habitaciones que deben estar inmediatamente adyacentes a esta" 
              },
              suggestedFurniture: {
                type: Type.ARRAY,
                description: "Tipos de muebles recomendados de la lista de permitidos",
                items: { 
                  type: Type.STRING,
                  enum: ["sofa", "tv", "dining_table", "chair", "bed", "wardrobe", "sink", "toilet", "shower", "fridge", "stove", "desk", "plant"]
                }
              }
            },
            required: ["id", "name", "type", "targetW", "targetH", "connections", "suggestedFurniture"]
          }
        }
      },
      required: ["suggestedPlanName", "rooms"]
    };

    const userMessage = `Genera un plano arquitectónico en base a la siguiente descripción del usuario: "${prompt}". 
El terreno mide ${tWidth}m de ancho por ${tLength}m de largo. Distribuye adecuadamente las habitaciones y proporciona un diseño funcional.`;

    let planData: any;
    try {
      const response = await getAI().models.generateContent({
        model: "gemini-3.5-flash",
        contents: userMessage,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.2, // Low temperature for high structure consistency
        },
      });

      const resultText = response.text;
      if (!resultText) {
        throw new Error("No se recibió respuesta estructurada de Gemini.");
      }

      planData = JSON.parse(resultText);
      console.log("AI Generation Successful!");
    } catch (aiError: any) {
      console.warn("AI Generation failed, utilizing smart procedural fallback:", aiError.message);
      
      const meta = req.body.metadata || {};
      const bedrooms = Number(meta.bedroomsCount) || 2;
      const bathrooms = Number(meta.bathroomsCount) || 2;
      const kitchenOpen = meta.kitchenStyle !== "cerrada";
      const withGarage = !!meta.hasGarage;
      const withStudio = !!meta.hasStudio;
      const withLaundry = !!meta.hasLaundry;
      const withGarden = !!meta.hasGarden;
      const style = meta.layoutStyle || "moderna";

      const roomsList: any[] = [];

      // 1. Central corridor (Pasillo Distribuidor)
      roomsList.push({
        id: "pasillo",
        name: "Hall Distribuidor",
        type: "corridor",
        targetW: 1.2,
        targetH: 4.5,
        connections: ["sala"],
        suggestedFurniture: ["plant"]
      });

      // 2. Sala (Living)
      roomsList.push({
        id: "sala",
        name: "Sala de Estar",
        type: "living",
        targetW: 4.5,
        targetH: 4.0,
        connections: ["pasillo"],
        suggestedFurniture: ["sofa", "tv", "plant"]
      });

      // 3. Cocina
      roomsList.push({
        id: "cocina",
        name: kitchenOpen ? "Cocina Americana" : "Cocina Tradicional",
        type: "kitchen",
        targetW: 3.5,
        targetH: 3.0,
        connections: ["sala", "pasillo"],
        suggestedFurniture: ["fridge", "stove", "sink"]
      });

      // 4. Comedor
      roomsList.push({
        id: "comedor",
        name: "Comedor Familiar",
        type: "dining",
        targetW: 3.2,
        targetH: 3.0,
        connections: ["sala", "cocina"],
        suggestedFurniture: ["dining_table", "chair", "plant"]
      });

      // 5. Bedrooms
      for (let i = 1; i <= bedrooms; i++) {
        const isPrincipal = i === 1;
        const bId = `dormitorio_${i}`;
        const name = isPrincipal ? "Dormitorio Principal" : `Dormitorio ${i}`;
        roomsList.push({
          id: bId,
          name,
          type: "bedroom",
          targetW: isPrincipal ? 4.0 : 3.2,
          targetH: isPrincipal ? 3.5 : 3.0,
          connections: ["pasillo"],
          suggestedFurniture: isPrincipal ? ["bed", "wardrobe", "desk"] : ["bed", "wardrobe"]
        });

        const pasilloRoom = roomsList.find(r => r.id === "pasillo");
        if (pasilloRoom) {
          pasilloRoom.connections.push(bId);
        }
      }

      // 6. Bathrooms
      for (let i = 1; i <= bathrooms; i++) {
        const isSuite = i === 1 && bedrooms >= 1;
        const bId = `bano_${i}`;
        const name = isSuite ? "Baño Principal (Suite)" : `Baño Común ${i > 1 ? i : ""}`;
        roomsList.push({
          id: bId,
          name,
          type: "bathroom",
          targetW: 2.2,
          targetH: 1.8,
          connections: isSuite ? ["dormitorio_1"] : ["pasillo"],
          suggestedFurniture: ["toilet", "sink", "shower"]
        });

        if (isSuite) {
          const pBed = roomsList.find(r => r.id === "dormitorio_1");
          if (pBed) {
            pBed.connections.push(bId);
          }
        } else {
          const pasilloRoom = roomsList.find(r => r.id === "pasillo");
          if (pasilloRoom) {
            pasilloRoom.connections.push(bId);
          }
        }
      }

      // 7. Garage
      if (withGarage) {
        roomsList.push({
          id: "cochera",
          name: "Cochera Frontal",
          type: "garage",
          targetW: 3.0,
          targetH: 5.0,
          connections: ["sala"],
          suggestedFurniture: ["plant"]
        });
      }

      // 8. Studio
      if (withStudio) {
        roomsList.push({
          id: "estudio",
          name: "Oficina / Estudio",
          type: "other",
          targetW: 3.0,
          targetH: 2.5,
          connections: ["pasillo"],
          suggestedFurniture: ["desk", "chair", "plant"]
        });
        const pasilloRoom = roomsList.find(r => r.id === "pasillo");
        if (pasilloRoom) pasilloRoom.connections.push("estudio");
      }

      // 9. Laundry
      if (withLaundry) {
        roomsList.push({
          id: "lavanderia",
          name: "Área de Lavandería",
          type: "laundry",
          targetW: 2.5,
          targetH: 1.8,
          connections: ["cocina"],
          suggestedFurniture: ["sink"]
        });
      }

      // 10. Garden
      if (withGarden) {
        roomsList.push({
          id: "patio",
          name: "Patio / Jardín Interior",
          type: "other",
          targetW: 2.5,
          targetH: 2.5,
          connections: ["pasillo", "sala"],
          suggestedFurniture: ["plant"]
        });
        const pasilloRoom = roomsList.find(r => r.id === "pasillo");
        if (pasilloRoom) pasilloRoom.connections.push("patio");
      }

      const capitalizedStyle = style.charAt(0).toUpperCase() + style.slice(1);
      planData = {
        suggestedPlanName: `Distribución ${capitalizedStyle} Optimista (Soporte Local)`,
        rooms: roomsList
      };
    }

    // Map furniture types to dimensions and clean names
    const furniturePresets: Record<string, { name: string; w: number; h: number }> = {
      sofa: { name: "Sofá 3 Cuerpos", w: 2.0, h: 0.9 },
      tv: { name: "Mueble TV", w: 1.6, h: 0.45 },
      dining_table: { name: "Mesa Comedor", w: 1.8, h: 0.9 },
      chair: { name: "Silla", w: 0.5, h: 0.5 },
      bed: { name: "Cama Queen", w: 1.6, h: 2.0 },
      wardrobe: { name: "Armario", w: 1.5, h: 0.6 },
      sink: { name: "Lavamanos", w: 0.7, h: 0.55 },
      toilet: { name: "Inodoro", w: 0.45, h: 0.7 },
      shower: { name: "Ducha", w: 0.9, h: 0.9 },
      fridge: { name: "Refrigeradora", w: 0.8, h: 0.8 },
      stove: { name: "Cocina / Encimera", w: 0.75, h: 0.6 },
      desk: { name: "Escritorio Trabajo", w: 1.2, h: 0.6 },
      plant: { name: "Planta de Maceta", w: 0.5, h: 0.5 },
    };

    // Hydrate layout: give initial non-overlapping layout positions
    // Place them around the center with a slight random distribution
    const centerX = tWidth / 2;
    const centerY = tLength / 2;

    const hydratedRooms = planData.rooms.map((room: any, index: number) => {
      // Place them spiraling or slightly offset so the relaxation simulation separates them beautifully
      const angle = (index / planData.rooms.length) * Math.PI * 2;
      const radius = 2.0; // 2 meters initial radius
      const initialX = Number((centerX + Math.cos(angle) * radius).toFixed(2));
      const initialY = Number((centerY + Math.sin(angle) * radius).toFixed(2));

      // Standardize types
      const rType = room.type || "other";
      const roomColor = colors[rType as keyof typeof colors] || colors.other;

      const rW = Number(room.targetW) || 4.0;
      const rH = Number(room.targetH) || 4.0;

      // Safe mapping for connections
      const connections: string[] = Array.isArray(room.connections)
        ? room.connections.map((c: any) => String(c))
        : [];

      // Ensure openings has standard empty or template doors
      const openings: any[] = [];
      
      // Auto-assign doors for rooms connected to other rooms
      connections.forEach((connId: string, cIndex: number) => {
        // Just prepare a standard door direction
        // In the interactive editor, the user can change or add openings
        // Let's suggest standard doors along the edges
        const sides = ["bottom", "top", "left", "right"];
        const side = sides[cIndex % 4] as "bottom" | "top" | "left" | "right";
        openings.push({
          id: `door_${room.id}_${connId}`,
          type: "door",
          side,
          offset: 0.5,
          width: 0.9,
          targetRoomId: connId
        });
      });

      // Add a window by default for ventilation on external sides (except corridor)
      if (rType !== "corridor" && rType !== "other") {
        openings.push({
          id: `win_${room.id}`,
          type: "window",
          side: "top",
          offset: 0.25 + Math.random() * 0.5,
          width: 1.2
        });
      }

      // Ensure every non-corridor room has at least one door to keep it connected/unsealed
      const hasDoor = openings.some(o => o.type === "door");
      if (!hasDoor && rType !== "corridor") {
        const corridorRoom = planData.rooms.find((r: any) => r.type === "corridor");
        const targetRoomId = corridorRoom ? corridorRoom.id : undefined;
        openings.push({
          id: `door_${room.id}_default`,
          type: "door",
          side: "bottom",
          offset: 0.5,
          width: 0.9,
          targetRoomId
        });
      }

      // Hydrate recommended furniture list
      const suggestedList = room.suggestedFurniture || [];
      const furnitureItems: any[] = [];

      suggestedList.forEach((fType: string, fIndex: number) => {
        const preset = furniturePresets[fType];
        if (!preset) return;

        // Position on clean grid layout so they look visually sorted
        const slots = [
          { dx: -0.25, dy: -0.25 },
          { dx: 0.25, dy: 0.25 },
          { dx: -0.25, dy: 0.25 },
          { dx: 0.25, dy: -0.25 },
          { dx: 0, dy: 0 }
        ];
        const slot = slots[fIndex % slots.length];

        let suggestedX = rW * slot.dx;
        let suggestedY = rH * slot.dy;

        // Keep inside boundaries cleanly
        const maxOffsetX = Math.max(0, rW / 2 - preset.w / 2 - 0.2);
        const maxOffsetY = Math.max(0, rH / 2 - preset.h / 2 - 0.2);
        const posX = Number(Math.max(-maxOffsetX, Math.min(maxOffsetX, suggestedX)).toFixed(2));
        const posY = Number(Math.max(-maxOffsetY, Math.min(maxOffsetY, suggestedY)).toFixed(2));

        const randId = Math.random().toString(36).substring(2, 6);
        furnitureItems.push({
          id: `f_${room.id}_${fType}_${randId}`,
          type: fType,
          name: preset.name,
          x: posX,
          y: posY,
          w: preset.w,
          h: preset.h,
          rotation: 0
        });
      });

      return {
        id: room.id,
        name: room.name,
        type: rType,
        x: initialX,
        y: initialY,
        w: rW, // starts at target width
        h: rH, // starts at target height
        targetW: rW,
        targetH: rH,
        color: roomColor,
        connections,
        openings,
        furniture: furnitureItems
      };
    });

    res.json({
      name: planData.suggestedPlanName,
      rooms: hydratedRooms
    });

  } catch (error: any) {
    console.error("Error generating plan:", error);
    res.status(500).json({ error: "Ocurrió un error al generar el plano: " + error.message });
  }
});

// Configure Vite integration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
