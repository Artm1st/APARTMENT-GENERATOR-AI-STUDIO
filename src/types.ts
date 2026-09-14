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
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
}

export interface RoomOpening {
  id: string;
  type: 'door' | 'window';
  side: 'top' | 'bottom' | 'left' | 'right';
  offset: number;
  width: number;
  targetRoomId?: string;
}

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  x: number;
  y: number;
  w: number;
  h: number;
  targetW: number;
  targetH: number;
  floor?: number;
  color: string;
  connections: string[];
  openings: RoomOpening[];
  furniture: FurnitureItem[];
}

export interface Terrain {
  width: number;
  length: number;
  setbackFront: number;
  setbackBack: number;
  setbackLeft: number;
  setbackRight: number;
  hasPerimeterWall?: boolean;
  entrySide?: 'front' | 'back' | 'left' | 'right';
  northAngleDeg?: number;
  hemisphere?: 'south' | 'north';
  levels?: number;
}

export interface PhysicsConfig {
  attractionStrength: number;
  repulsionStrength: number;
  boundaryStrength: number;
  gridSnap: boolean;
  gridSize: number;
  running: boolean;
  corridorAlignment: number;
}

export interface FloorPlan {
  id: string;
  name: string;
  rooms: Room[];
  terrain: Terrain;
  createdAt: string;
}
