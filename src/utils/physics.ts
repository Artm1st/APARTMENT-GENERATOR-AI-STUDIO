/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Room, Terrain, PhysicsConfig } from "../types";

/**
 * Calculates a single tick of the magnetic relaxation simulation.
 * Returns the updated rooms with new positions.
 */
export function relaxRooms(
  rooms: Room[],
  terrain: Terrain,
  config: PhysicsConfig,
  draggingRoomId: string | null
): Room[] {
  // Create a deep copy to manipulate positions and velocities
  const updated = rooms.map((r) => ({ ...r }));

  // Keep track of total force displacements for each room
  const fx = new Array(rooms.length).fill(0);
  const fy = new Array(rooms.length).fill(0);

  const minX = config.gridSnap ? Math.round(terrain.setbackLeft / config.gridSize) * config.gridSize : terrain.setbackLeft;
  const maxX = terrain.width - terrain.setbackRight;
  const minY = config.gridSnap ? Math.round(terrain.setbackFront / config.gridSize) * config.gridSize : terrain.setbackFront;
  const maxY = terrain.length - terrain.setbackBack;

  // 1. REPULSION FORCE (to prevent room overlaps)
  for (let i = 0; i < updated.length; i++) {
    for (let j = i + 1; j < updated.length; j++) {
      const rA = updated[i];
      const rB = updated[j];

      // Skip forces for dragging room to let user position it freely,
      // but let other rooms repel from the dragging room.
      
      const halfW_A = rA.w / 2;
      const halfH_A = rA.h / 2;
      const halfW_B = rB.w / 2;
      const halfH_B = rB.h / 2;

      // Check overlap
      const overlapX = Math.min(rA.x + halfW_A, rB.x + halfW_B) - Math.max(rA.x - halfW_A, rB.x - halfW_B);
      const overlapY = Math.min(rA.y + halfH_A, rB.y + halfH_B) - Math.max(rA.y - halfH_A, rB.y - halfH_B);

      if (overlapX > 0 && overlapY > 0) {
        // Rooms overlap, apply repulsion force along the axis of least overlap
        const pushStrength = config.repulsionStrength * 0.15;

        if (overlapX < overlapY) {
          // Push horizontally
          const dirX = rA.x < rB.x ? -1 : 1;
          const force = overlapX * pushStrength * dirX;
          
          if (rA.id !== draggingRoomId) fx[i] += force;
          if (rB.id !== draggingRoomId) fx[j] -= force;
        } else {
          // Push vertically
          const dirY = rA.y < rB.y ? -1 : 1;
          const force = overlapY * pushStrength * dirY;

          if (rA.id !== draggingRoomId) fy[i] += force;
          if (rB.id !== draggingRoomId) fy[j] -= force;
        }
      }
    }
  }

  // 2. ATTRACTION FORCE (drawn connected rooms/adjacencies together)
  for (let i = 0; i < updated.length; i++) {
    const rA = updated[i];
    if (rA.id === draggingRoomId) continue;

    rA.connections.forEach((connId) => {
      const j = updated.findIndex((r) => r.id === connId);
      if (j === -1) return;

      const rB = updated[j];
      const dx = rB.x - rA.x;
      const dy = rB.y - rA.y;
      const dist = Math.hypot(dx, dy) || 0.001;

      // Target distance is when boundaries are exactly touching
      // For horizontal adjacency: targetDx = (rA.w + rB.w)/2, targetDy = 0
      // For vertical adjacency: targetDy = (rA.h + rB.h)/2, targetDx = 0
      // Determine dominant adjacency axis
      const targetDistX = (rA.w + rB.w) / 2;
      const targetDistY = (rA.h + rB.h) / 2;

      const scaleX = Math.abs(dx) / targetDistX;
      const scaleY = Math.abs(dy) / targetDistY;

      const pullStrength = config.attractionStrength * 0.05;

      if (scaleX > scaleY) {
        // Adjacency is mainly horizontal
        const errorX = Math.abs(dx) - targetDistX;
        // Force to touch horizontally
        const forceX = errorX * pullStrength * Math.sign(dx);
        fx[i] += forceX;

        // Alignment force vertically
        const forceY = dy * pullStrength * 0.2;
        fy[i] += forceY;
      } else {
        // Adjacency is mainly vertical
        const errorY = Math.abs(dy) - targetDistY;
        // Force to touch vertically
        const forceY = errorY * pullStrength * Math.sign(dy);
        fy[i] += forceY;

        // Alignment force horizontally
        const forceX = dx * pullStrength * 0.2;
        fx[i] += forceX;
      }

      // Special corridor alignment (rooms connect cleanly to corridor edges)
      if (rA.type === "corridor" || rB.type === "corridor") {
        const corrForce = config.corridorAlignment * 0.08;
        if (rA.type === "corridor") {
          // Align rB to corridor edge
          if (rA.w > rA.h) {
            // Horizontal corridor, align vertically
            const targetY = rA.y + (dy > 0 ? (rA.h + rB.h) / 2 : -(rA.h + rB.h) / 2);
            fy[j] += (targetY - rB.y) * corrForce;
          } else {
            // Vertical corridor, align horizontally
            const targetX = rA.x + (dx > 0 ? (rA.w + rB.w) / 2 : -(rA.w + rB.w) / 2);
            fx[j] += (targetX - rB.x) * corrForce;
          }
        }
      }
    });
  }

  // 3. BOUNDARY CONSTRAINT FORCES (keep inside terrain setback box)
  for (let i = 0; i < updated.length; i++) {
    const r = updated[i];
    if (r.id === draggingRoomId) continue;

    const rMinX = r.x - r.w / 2;
    const rMaxX = r.x + r.w / 2;
    const rMinY = r.y - r.h / 2;
    const rMaxY = r.y + r.h / 2;

    const boundForce = config.boundaryStrength * 0.2;

    if (rMinX < minX) fx[i] += (minX - rMinX) * boundForce;
    if (rMaxX > maxX) fx[i] -= (rMaxX - maxX) * boundForce;
    if (rMinY < minY) fy[i] += (minY - rMinY) * boundForce;
    if (rMaxY > maxY) fy[i] -= (rMaxY - maxY) * boundForce;
  }

  // 4. APPLY DISPLACEMENTS AND GRID SNAP
  for (let i = 0; i < updated.length; i++) {
    const r = updated[i];
    if (r.id === draggingRoomId) continue;

    // Dampen physics movement
    let nextX = r.x + Math.max(-1.5, Math.min(1.5, fx[i]));
    let nextY = r.y + Math.max(-1.5, Math.min(1.5, fy[i]));

    // Constraint limits
    nextX = Math.max(minX + r.w / 2, Math.min(maxX - r.w / 2, nextX));
    nextY = Math.max(minY + r.h / 2, Math.min(maxY - r.h / 2, nextY));

    // Optional Grid Snap on tick (smooth snapping)
    if (config.gridSnap && !config.running) {
      nextX = Math.round(nextX / config.gridSize) * config.gridSize;
      nextY = Math.round(nextY / config.gridSize) * config.gridSize;
    }

    r.x = Number(nextX.toFixed(3));
    r.y = Number(nextY.toFixed(3));
  }

  return updated;
}

/**
 * Snaps all room dimensions and coordinates to grid
 */
export function snapAllToGrid(rooms: Room[], gridSize: number): Room[] {
  return rooms.map((r) => {
    const snappedW = Math.round(r.w / gridSize) * gridSize;
    const snappedH = Math.round(r.h / gridSize) * gridSize;
    const snappedX = Math.round(r.x / gridSize) * gridSize;
    const snappedY = Math.round(r.y / gridSize) * gridSize;

    // Also adjust furniture offsets to snap
    const furniture = r.furniture.map((f) => ({
      ...f,
      x: Number((Math.round(f.x / gridSize) * gridSize).toFixed(2)),
      y: Number((Math.round(f.y / gridSize) * gridSize).toFixed(2)),
    }));

    return {
      ...r,
      w: Math.max(gridSize, snappedW),
      h: Math.max(gridSize, snappedH),
      x: snappedX,
      y: snappedY,
      furniture,
    };
  });
}
