/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type RoomType =
  | 'living'
  | 'bedroom'
  | 'bathroom'
  | 'kitchen'
  | 'dining'
  | 'corridor'
  | 'garage'
  | 'laundry'
  | 'other';

export interface FurnitureItem {
  id: string;
  type: 'sofa' | 'tv' | 'dining_table' | 'chair' | 'bed' | 'wardrobe' | 'sink' | 'toilet' | 'shower' | 'fridge' | 'stove' | 'desk' | 'plant';
  name: string;
  x: number; // offset relative to room center (meters)
  y: number; // offset relative to room center (meters)
  w: number; // width (meters)
  h: number; // height (meters)
  rotation: number; // rotation in degrees (0, 90, 180, 270)
}

export interface RoomOpening {
  id: string;
  type: 'door' | 'window';
  side: 'top' | 'bottom' | 'left' | 'right';
  offset: number; // Position from 0 to 1 along the wall side
  width: number; // Width of the door/window in meters
  targetRoomId?: string; // If door, which room it leads to
}

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  x: number; // center x coordinate (meters)
  y: number; // center y coordinate (meters)
  w: number; // current width (meters)
  h: number; // current height (meters)
  targetW: number; // target/desired width (meters)
  targetH: number; // target/desired height (meters)
  color: string; // hex code for styling
  connections: string[]; // IDs of other rooms this room should be adjacent to (attractive forces)
  openings: RoomOpening[];
  furniture: FurnitureItem[];
}

export interface Terrain {
  width: number; // total terrain width in meters (e.g., 10m)
  length: number; // total terrain length in meters (e.g., 20m)
  setbackFront: number; // front setback (meters)
  setbackBack: number; // back setback (meters)
  setbackLeft: number; // left side setback (meters)
  setbackRight: number; // right side setback (meters)
  hasPerimeterWall?: boolean; // toggle for perimeter wall around the terrain bounds
}

export interface PhysicsConfig {
  attractionStrength: number; // force drawing connected rooms together
  repulsionStrength: number; // force pushing overlapping rooms apart
  boundaryStrength: number; // force keeping rooms inside the terrain buildable area
  gridSnap: boolean; // whether to snap to standard offsets during relaxation
  gridSize: number; // grid size in meters (e.g., 0.1m or 0.5m)
  running: boolean; // simulation running state
  corridorAlignment: number; // alignment force to hallways
}

export interface FloorPlan {
  id: string;
  name: string;
  rooms: Room[];
  terrain: Terrain;
  createdAt: string;
}
