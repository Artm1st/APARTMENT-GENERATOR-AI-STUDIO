/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Room, RoomType, Terrain } from "../types";

// ============================================================================
// REGLAMENTO NACIONAL DE EDIFICACIONES (RNE) - NORMATIVA DE VIVIENDA (A.020)
// ============================================================================

export interface RneRuleResult {
  ruleId: string;
  name: string;
  category: "area" | "dimension" | "ventilation" | "setback";
  status: "pass" | "warning" | "fail";
  description: string;
  currentValue: string;
  requiredValue: string;
}

export interface RoomComplianceReport {
  roomId: string;
  roomName: string;
  roomType: RoomType;
  overallStatus: "pass" | "warning" | "fail";
  rules: RneRuleResult[];
}

export interface GlobalComplianceReport {
  overallStatus: "pass" | "warning" | "fail";
  roomReports: RoomComplianceReport[];
  terrainRules: RneRuleResult[];
  totalConstructedArea: number;
}

/**
 * Validates a single room against RNE (Norma A.020) requirements
 */
export function validateRoomRNE(room: Room, terrain: Terrain): RoomComplianceReport {
  const rules: RneRuleResult[] = [];
  const area = room.w * room.h;
  const minDimension = Math.min(room.w, room.h);
  const maxDimension = Math.max(room.w, room.h);

  // 1. AREA VALIDATION
  if (room.type === "bedroom") {
    const isPrincipal = room.name.toLowerCase().includes("principal") || room.name.toLowerCase().includes("master") || room.name.toLowerCase().includes("suite");
    const minRequiredArea = isPrincipal ? 9.0 : 6.0;
    const passes = area >= minRequiredArea;
    rules.push({
      ruleId: "RNE_ROOM_AREA",
      name: isPrincipal ? "Área Mínima Dormitorio Principal" : "Área Mínima Dormitorio Secundario",
      category: "area",
      status: passes ? "pass" : "fail",
      requiredValue: `>= ${minRequiredArea.toFixed(1)} m²`,
      currentValue: `${area.toFixed(2)} m²`,
      description: passes 
        ? "El área es adecuada y cumple con la Norma RNE A.020 Art. 12 para dormitorios." 
        : `La Norma RNE A.020 exige un área mínima de ${minRequiredArea.toFixed(1)}m² para un dormitorio de este tipo para garantizar habitabilidad.`
    });
  } else if (room.type === "bathroom") {
    const minRequiredArea = 1.6;
    const passes = area >= minRequiredArea;
    rules.push({
      ruleId: "RNE_ROOM_AREA",
      name: "Área Mínima de Servicio (Baño)",
      category: "area",
      status: passes ? "pass" : "warning",
      requiredValue: `>= ${minRequiredArea.toFixed(1)} m²`,
      currentValue: `${area.toFixed(2)} m²`,
      description: passes 
        ? "El baño cumple con el área mínima recomendada para tres aparatos sanitarios."
        : "El área es reducida. Podría limitar la distribución de inodoro, lavatorio y ducha."
    });
  } else if (room.type === "kitchen") {
    const minRequiredArea = 4.5;
    const passes = area >= minRequiredArea;
    rules.push({
      ruleId: "RNE_ROOM_AREA",
      name: "Área Mínima de Cocina",
      category: "area",
      status: passes ? "pass" : "warning",
      requiredValue: `>= ${minRequiredArea.toFixed(1)} m²`,
      currentValue: `${area.toFixed(2)} m²`,
      description: passes 
        ? "La cocina tiene suficiente área para encimera, lavadero y refrigeradora." 
        : "Cocina compacta. Excelente para concepto abierto integrado, pero reducida si es cerrada."
    });
  } else if (room.type === "living" || room.type === "dining") {
    const minRequiredArea = 10.0;
    const passes = area >= minRequiredArea;
    rules.push({
      ruleId: "RNE_ROOM_AREA",
      name: "Área de Zona Social (Sala/Comedor)",
      category: "area",
      status: passes ? "pass" : "warning",
      requiredValue: `>= ${minRequiredArea.toFixed(1)} m²`,
      currentValue: `${area.toFixed(2)} m²`,
      description: passes 
        ? "Zona social espaciosa y apta para amoblamiento." 
        : "Área de sala/comedor menor a 10m². Recomendable integrar ambos ambientes en concepto abierto."
    });
  }

  // 2. MINIMUM WIDTH / DIMENSIONS VALIDATION
  if (room.type === "bedroom") {
    const isPrincipal = room.name.toLowerCase().includes("principal") || room.name.toLowerCase().includes("master") || room.name.toLowerCase().includes("suite");
    const minRequiredWidth = isPrincipal ? 2.40 : 2.00;
    const passes = minDimension >= minRequiredWidth;
    rules.push({
      ruleId: "RNE_ROOM_DIM",
      name: "Ancho Libre Mínimo en Dormitorio",
      category: "dimension",
      status: passes ? "pass" : "fail",
      requiredValue: `>= ${minRequiredWidth.toFixed(2)} m`,
      currentValue: `${minDimension.toFixed(2)} m`,
      description: passes 
        ? `Cumple. Permite colocar cama y circulaciones según el RNE.` 
        : `El lado menor es inferior a ${minRequiredWidth.toFixed(2)}m. Dificultará el paso y colocación de clósets o camas.`
    });
  } else if (room.type === "bathroom") {
    const minRequiredWidth = 0.90;
    const passes = minDimension >= minRequiredWidth;
    rules.push({
      ruleId: "RNE_ROOM_DIM",
      name: "Ancho Libre Mínimo en Baño",
      category: "dimension",
      status: passes ? "pass" : "fail",
      requiredValue: `>= ${minRequiredWidth.toFixed(2)} m`,
      currentValue: `${minDimension.toFixed(2)} m`,
      description: passes 
        ? "Cumple con el ancho libre mínimo de 0.90m para pasajes sanitarios." 
        : "Alerta crítica: Ancho menor a 0.90m vulnera el RNE y bloquea el acceso ergonómico básico."
    });
  } else if (room.type === "corridor") {
    const minRequiredWidth = 0.90;
    const passes = minDimension >= minRequiredWidth;
    rules.push({
      ruleId: "RNE_ROOM_DIM",
      name: "Ancho de Pasillo de Circulación",
      category: "dimension",
      status: passes ? "pass" : "fail",
      requiredValue: `>= ${minRequiredWidth.toFixed(2)} m`,
      currentValue: `${minDimension.toFixed(2)} m`,
      description: passes 
        ? "Pasillo cumple con el ancho mínimo libre de evacuación de 0.90m." 
        : "Error: El pasillo mide menos de 0.90m libres de ancho, violando la Norma RNE A.010 de evacuaciones."
    });
  } else if (room.type === "kitchen") {
    const minRequiredWidth = 1.40;
    const passes = minDimension >= minRequiredWidth;
    rules.push({
      ruleId: "RNE_ROOM_DIM",
      name: "Ancho de Cocina de Trabajo",
      category: "dimension",
      status: passes ? "pass" : "warning",
      requiredValue: `>= ${minRequiredWidth.toFixed(2)} m`,
      currentValue: `${minDimension.toFixed(2)} m`,
      description: passes 
        ? "Ancho óptimo para flujo de trabajo ergonómico (triángulo de cocina)." 
        : "Ancho inferior a 1.40m. Flujo de cocina limitado, adecuado solo como kitchenet lineal."
    });
  }

  // 3. VENTILATION & ILLUMINATION VALIDATION (RNE A.020 Art. 16)
  if (room.type !== "corridor" && room.type !== "laundry" && room.type !== "garage") {
    // Sum window widths
    const windows = room.openings.filter(op => op.type === "window");
    const totalWindowArea = windows.reduce((acc, win) => acc + (win.width * 1.0), 0); // Assume standard nominal window height of 1.0m for simplified area calculation
    const windowRatio = (totalWindowArea / area) * 100;
    const passes = windowRatio >= 10.0;

    rules.push({
      ruleId: "RNE_ROOM_VENT",
      name: "Área de Ventilación e Iluminación Natural",
      category: "ventilation",
      status: passes ? "pass" : "fail",
      requiredValue: ">= 10.0% del piso",
      currentValue: `${windowRatio.toFixed(1)}% (Vanos: ${totalWindowArea.toFixed(1)} m²)`,
      description: passes 
        ? `Excelente. El área acristalada representa el ${windowRatio.toFixed(1)}% del piso (Excede el 10% RNE).` 
        : `Deficiente ventilación (${windowRatio.toFixed(1)}% del piso). El RNE Art. 16 exige vanos de ventana mayores al 10% para higiene y salud.`
    });
  }

  // 4. SETBACK INVASION (RETIROS OBLIGATORIOS)
  const halfW = room.w / 2;
  const halfH = room.h / 2;
  const rXMin = room.x - halfW;
  const rXMax = room.x + halfW;
  const rYMin = room.y - halfH;
  const rYMax = room.y + halfH;

  const bMinX = terrain.setbackLeft;
  const bMaxX = terrain.width - terrain.setbackRight;
  const bMinY = terrain.setbackFront;
  const bMaxY = terrain.length - terrain.setbackBack;

  let isInvading = false;
  let invasionDetails = "";

  if (rXMin < bMinX) { isInvading = true; invasionDetails += `Invade Retiro Izquierdo (${(bMinX - rXMin).toFixed(2)}m). `; }
  if (rXMax > bMaxX) { isInvading = true; invasionDetails += `Invade Retiro Derecho (${(rXMax - bMaxX).toFixed(2)}m). `; }
  if (rYMin < bMinY) { isInvading = true; invasionDetails += `Invade Retiro Frontal (${(bMinY - rYMin).toFixed(2)}m). `; }
  if (rYMax > bMaxY) { isInvading = true; invasionDetails += `Invade Retiro Posterior (${(rYMax - bMaxY).toFixed(2)}m). `; }

  rules.push({
    ruleId: "RNE_BUILD_LIMIT",
    name: "Límite de Retiros Municipales",
    category: "setback",
    status: isInvading ? "fail" : "pass",
    requiredValue: "Dentro de Área Edificable",
    currentValue: isInvading ? "¡INVASIÓN!" : "CUMPLE",
    description: isInvading 
      ? `Crítico: El ambiente se superpone a las áreas libres obligatorias de la propiedad. Detalles: ${invasionDetails}` 
      : "El ambiente se encuentra perfectamente asentado dentro del polígono edificable del terreno."
  });

  // Calculate Overall Status for this room
  let overallStatus: "pass" | "warning" | "fail" = "pass";
  if (rules.some(r => r.status === "fail")) {
    overallStatus = "fail";
  } else if (rules.some(r => r.status === "warning")) {
    overallStatus = "warning";
  }

  return {
    roomId: room.id,
    roomName: room.name,
    roomType: room.type,
    overallStatus,
    rules
  };
}

/**
 * Validates the entire floor plan layout
 */
export function validateFloorPlanRNE(rooms: Room[], terrain: Terrain): GlobalComplianceReport {
  const roomReports = rooms.map(room => validateRoomRNE(room, terrain));
  const terrainRules: RneRuleResult[] = [];

  const totalConstructedArea = rooms.reduce((acc, r) => acc + (r.w * r.h), 0);
  const totalTerrainArea = terrain.width * terrain.length;
  
  // Calculate buildable zone area
  const buildableW = terrain.width - terrain.setbackLeft - terrain.setbackRight;
  const buildableH = terrain.length - terrain.setbackFront - terrain.setbackBack;
  const buildableArea = buildableW * buildableH;

  // Max Occupancy Coeff (Simplified standard coefficient of 70% of buildable area)
  const isOverBuilt = totalConstructedArea > buildableArea;
  terrainRules.push({
    ruleId: "RNE_SITE_OCCUPANCY",
    name: "Coeficiente Máximo de Edificación",
    category: "area",
    status: isOverBuilt ? "fail" : (totalConstructedArea > buildableArea * 0.9 ? "warning" : "pass"),
    requiredValue: `<= ${buildableArea.toFixed(1)} m² (Área Edificable)`,
    currentValue: `${totalConstructedArea.toFixed(1)} m² ocupados`,
    description: isOverBuilt
      ? "Alerta: El área de edificación supera el polígono de retiros permitidos. Reajuste el tamaño o mueva ambientes."
      : "El volumen total edificado es compatible con los retiros municipales exigidos."
  });

  // Check overlap of rooms between themselves (Structural Collisions)
  let overlapCount = 0;
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const r1 = rooms[i];
      const r2 = rooms[j];
      
      const r1_halfW = r1.w / 2;
      const r1_halfH = r1.h / 2;
      const r2_halfW = r2.w / 2;
      const r2_halfH = r2.h / 2;

      const overlapX = Math.min(r1.x + r1_halfW, r2.x + r2_halfW) - Math.max(r1.x - r1_halfW, r2.x - r2_halfW);
      const overlapY = Math.min(r1.y + r1_halfH, r2.y + r2_halfH) - Math.max(r1.y - r1_halfH, r2.y - r2_halfH);

      if (overlapX > 0.05 && overlapY > 0.05) { // 5cm tolerance
        overlapCount++;
      }
    }
  }

  terrainRules.push({
    ruleId: "RNE_ROOM_COLLISION",
    name: "Colisiones y Solapamiento de Muros",
    category: "dimension",
    status: overlapCount > 0 ? "fail" : "pass",
    requiredValue: "0 Solapamientos",
    currentValue: `${overlapCount} cruces de muro`,
    description: overlapCount > 0
      ? `Fallo: Existen ${overlapCount} ambientes solapados entre sí. Encienda la 'Simulación de Relajación' para separarlos mecánicamente.`
      : "Correcto. Todos los ambientes se encuentran perfectamente adyacentes o separados, sin colisión de cimientos."
  });

  let overallStatus: "pass" | "warning" | "fail" = "pass";
  if (roomReports.some(r => r.overallStatus === "fail") || terrainRules.some(t => t.status === "fail")) {
    overallStatus = "fail";
  } else if (roomReports.some(r => r.overallStatus === "warning") || terrainRules.some(t => t.status === "warning")) {
    overallStatus = "warning";
  }

  return {
    overallStatus,
    roomReports,
    terrainRules,
    totalConstructedArea
  };
}


// ============================================================================
// PLAN BIM CHILE - ESTÁNDAR DE DATOS, CLASIFICACIÓN Y ENTIDADES IFC
// ============================================================================

export interface BimMetadata {
  ifcEntity: "IfcSpace" | "IfcDoor" | "IfcWindow" | "IfcFurnishingElement" | "IfcSite";
  bimCode: string;
  subType: string;
  ndi: string; // Nivel de Información (NDI-2 / LOD-200 para conceptual, NDI-3 / LOD-300 para detalle)
  layerName: string;
  parameters: { name: string; value: string }[];
}

/**
 * Returns standard Plan BIM Chile metadata for a given Room (IfcSpace)
 */
export function getRoomBimMetadata(room: Room): BimMetadata {
  const codeMapping: Record<RoomType, { code: string; name: string }> = {
    bedroom: { code: "BIM_ESP_PRIV_DORM", name: "Dormitorio Habitacional" },
    living: { code: "BIM_ESP_SOCIAL_SALA", name: "Estar / Sala Social" },
    dining: { code: "BIM_ESP_SOCIAL_COM", name: "Comedor Social" },
    bathroom: { code: "BIM_ESP_SERV_BANO", name: "Servicio Sanitario" },
    kitchen: { code: "BIM_ESP_SERV_COCI", name: "Servicio de Cocción / Cocina" },
    corridor: { code: "BIM_ESP_CIRC_PASI", name: "Circulación / Pasillo" },
    garage: { code: "BIM_ESP_SERV_ESTA", name: "Estacionamiento" },
    laundry: { code: "BIM_ESP_SERV_LAVA", name: "Área de Lavandería" },
    other: { code: "BIM_ESP_OTRO_GENE", name: "Espacio Genérico" },
  };

  const map = codeMapping[room.type] || codeMapping.other;

  return {
    ifcEntity: "IfcSpace",
    bimCode: map.code,
    subType: map.name,
    ndi: "NDI 2 (Conceptual)",
    layerName: "BIM_A_Espacios",
    parameters: [
      { name: "Nombre del Espacio", value: room.name },
      { name: "Superficie Útil (m²)", value: `${(room.w * room.h).toFixed(2)} m²` },
      { name: "Perímetro (m)", value: `${((room.w + room.h) * 2).toFixed(2)} m` },
      { name: "Fase del Modelo", value: "Fase 01 - Anteproyecto Generativo" },
      { name: "Clasificación IFC", value: "IfcSpaceType" },
      { name: "Estándar BIM Chile", value: "Documento de Entrega Plan BIM Chile 2026" }
    ]
  };
}

/**
 * Returns standard Plan BIM Chile metadata for components (doors, windows, furniture)
 */
export function getComponentBimMetadata(type: "door" | "window" | "furniture", subType: string, w: number, h: number): BimMetadata {
  if (type === "door") {
    return {
      ifcEntity: "IfcDoor",
      bimCode: "BIM_COM_VANO_PUERTA",
      subType: "Puerta Abatible Madera/Metal",
      ndi: "NDI 3 (Técnico)",
      layerName: "BIM_A_Puertas",
      parameters: [
        { name: "Ancho de Vano (m)", value: `${w.toFixed(2)} m` },
        { name: "Alto Estimado (m)", value: "2.10 m" },
        { name: "Entidad IFC", value: "IfcDoor" },
        { name: "Tipo de Elemento", value: "Abertura / Paso de Evacuación" }
      ]
    };
  } else if (type === "window") {
    return {
      ifcEntity: "IfcWindow",
      bimCode: "BIM_COM_VANO_VENTANA",
      subType: "Ventana Corrediza Alum/Vidrio",
      ndi: "NDI 3 (Técnico)",
      layerName: "BIM_A_Ventanas",
      parameters: [
        { name: "Ancho de Ventana (m)", value: `${w.toFixed(2)} m` },
        { name: "Alto Estimado (m)", value: "1.20 m" },
        { name: "Alféizar Estimado (m)", value: "0.90 m" },
        { name: "Iluminación / Ventilación", value: "Ventilación Natural Conforme RNE" }
      ]
    };
  } else {
    // Furniture
    return {
      ifcEntity: "IfcFurnishingElement",
      bimCode: `BIM_MOB_EQUIP_${subType.toUpperCase()}`,
      subType: `Equipamiento: ${subType}`,
      ndi: "NDI 2 (Equipamiento)",
      layerName: "BIM_A_Mobiliario",
      parameters: [
        { name: "Tipo de Mobiliario", value: subType },
        { name: "Dimensiones en Planta", value: `${w.toFixed(2)}m x ${h.toFixed(2)}m` },
        { name: "Entidad IFC", value: "IfcFurnishingElement" }
      ]
    };
  }
}
