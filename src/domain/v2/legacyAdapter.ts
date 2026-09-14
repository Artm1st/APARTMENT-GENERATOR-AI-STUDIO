import { Room, Terrain } from "../../types";
import {
  ArchitecturalProgram,
  LayoutSpace,
  ProgramSpace,
  SiteConstraints,
  SpatialRelation,
  SpaceType,
} from "./types";

const privacyByType: Record<SpaceType, ProgramSpace["privacy"]> = {
  living: "public",
  dining: "public",
  kitchen: "service",
  bedroom: "private",
  bathroom: "private",
  corridor: "semi_private",
  garage: "service",
  laundry: "service",
  terrace: "public",
  patio: "semi_private",
  studio: "semi_private",
  stair: "semi_private",
  other: "semi_private",
};

const needsExteriorOpening = (type: SpaceType): boolean =>
  type === "bedroom" || type === "living" || type === "dining" || type === "kitchen";

export function legacyRoomsToLayoutSpaces(rooms: Room[]): LayoutSpace[] {
  return rooms.map((room) => ({
    id: room.id,
    programSpaceId: room.id,
    type: room.type,
    label: room.name,
    x: room.x,
    y: room.y,
    w: room.w,
    h: room.h,
    floor: room.floor ?? 0,
  }));
}

export function legacyRoomsToProgram(rooms: Room[]): ArchitecturalProgram {
  const spaces: ProgramSpace[] = rooms.map((room) => ({
    id: room.id,
    type: room.type,
    label: room.name,
    targetArea: room.targetW * room.targetH,
    privacy: privacyByType[room.type],
    requiresExteriorOpening: needsExteriorOpening(room.type),
    wetArea: room.type === "bathroom" || room.type === "kitchen" || room.type === "laundry",
    floor: room.floor ?? 0,
  }));

  const knownIds = new Set(rooms.map((room) => room.id));
  const seen = new Set<string>();
  const relations: SpatialRelation[] = [];

  for (const room of rooms) {
    for (const targetId of room.connections) {
      if (!knownIds.has(targetId) || targetId === room.id) continue;
      const pair = [room.id, targetId].sort();
      const key = pair.join("::");
      if (seen.has(key)) continue;
      seen.add(key);

      relations.push({
        id: `legacy_prefer_${pair.join("_")}`,
        a: pair[0],
        b: pair[1],
        kind: "prefer_touch",
        weight: 0.7,
      });
    }
  }

  return {
    projectType: "single_family_house",
    spaces,
    relations,
    preferences: [
      { id: "legacy_compactness", key: "compactness", weight: 0.8 },
      { id: "legacy_short_circulation", key: "short_circulation", weight: 0.8 },
      { id: "legacy_daylight", key: "daylight", weight: 0.7 },
    ],
  };
}

export function legacyTerrainToSiteConstraints(terrain: Terrain): SiteConstraints {
  return {
    width: terrain.width,
    length: terrain.length,
    setbackFront: terrain.setbackFront,
    setbackBack: terrain.setbackBack,
    setbackLeft: terrain.setbackLeft,
    setbackRight: terrain.setbackRight,
    entrySide: terrain.entrySide,
    northAngleDeg: terrain.northAngleDeg,
    hemisphere: terrain.hemisphere,
    levels: terrain.levels,
    source: "legacy-ui-input",
  };
}
