import {
  ExteriorBoundary,
  FloorTopology,
  LayoutSpace,
  SharedBoundary,
  WallSide,
} from "./types";

export interface RectBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export const DEFAULT_GEOMETRY_TOLERANCE = 0.02;
export const DEFAULT_MIN_SHARED_LENGTH = 0.30;

export function getSpaceBounds(space: LayoutSpace): RectBounds {
  return {
    minX: space.x - space.w / 2,
    maxX: space.x + space.w / 2,
    minY: space.y - space.h / 2,
    maxY: space.y + space.h / 2,
  };
}

export function spacesOverlap(
  a: LayoutSpace,
  b: LayoutSpace,
  tolerance = DEFAULT_GEOMETRY_TOLERANCE
): boolean {
  if (a.floor !== b.floor) return false;

  const A = getSpaceBounds(a);
  const B = getSpaceBounds(b);
  const overlapX = Math.min(A.maxX, B.maxX) - Math.max(A.minX, B.minX);
  const overlapY = Math.min(A.maxY, B.maxY) - Math.max(A.minY, B.minY);

  return overlapX > tolerance && overlapY > tolerance;
}

const stableBoundaryId = (aId: string, bId: string, axis: "h" | "v", coordinate: number, start: number, end: number) => {
  const [left, right] = [aId, bId].sort();
  const clean = (value: number) => value.toFixed(3).replace(/\./g, "_").replace(/-/g, "m");
  return `shared_${left}_${right}_${axis}_${clean(coordinate)}_${clean(start)}_${clean(end)}`;
};

export function findSharedBoundary(
  a: LayoutSpace,
  b: LayoutSpace,
  tolerance = DEFAULT_GEOMETRY_TOLERANCE,
  minSharedLength = DEFAULT_MIN_SHARED_LENGTH
): SharedBoundary | null {
  if (a.floor !== b.floor || spacesOverlap(a, b, tolerance)) return null;

  const A = getSpaceBounds(a);
  const B = getSpaceBounds(b);

  const verticalStart = Math.max(A.minY, B.minY);
  const verticalEnd = Math.min(A.maxY, B.maxY);
  const verticalLength = verticalEnd - verticalStart;

  if (verticalLength >= minSharedLength) {
    if (Math.abs(A.maxX - B.minX) <= tolerance) {
      const coordinate = (A.maxX + B.minX) / 2;
      return {
        id: stableBoundaryId(a.id, b.id, "v", coordinate, verticalStart, verticalEnd),
        spaceAId: a.id,
        spaceBId: b.id,
        orientation: "vertical",
        coordinate,
        start: verticalStart,
        end: verticalEnd,
        length: verticalLength,
        sideOfA: "right",
        sideOfB: "left",
      };
    }

    if (Math.abs(A.minX - B.maxX) <= tolerance) {
      const coordinate = (A.minX + B.maxX) / 2;
      return {
        id: stableBoundaryId(a.id, b.id, "v", coordinate, verticalStart, verticalEnd),
        spaceAId: a.id,
        spaceBId: b.id,
        orientation: "vertical",
        coordinate,
        start: verticalStart,
        end: verticalEnd,
        length: verticalLength,
        sideOfA: "left",
        sideOfB: "right",
      };
    }
  }

  const horizontalStart = Math.max(A.minX, B.minX);
  const horizontalEnd = Math.min(A.maxX, B.maxX);
  const horizontalLength = horizontalEnd - horizontalStart;

  if (horizontalLength >= minSharedLength) {
    if (Math.abs(A.maxY - B.minY) <= tolerance) {
      const coordinate = (A.maxY + B.minY) / 2;
      return {
        id: stableBoundaryId(a.id, b.id, "h", coordinate, horizontalStart, horizontalEnd),
        spaceAId: a.id,
        spaceBId: b.id,
        orientation: "horizontal",
        coordinate,
        start: horizontalStart,
        end: horizontalEnd,
        length: horizontalLength,
        sideOfA: "top",
        sideOfB: "bottom",
      };
    }

    if (Math.abs(A.minY - B.maxY) <= tolerance) {
      const coordinate = (A.minY + B.maxY) / 2;
      return {
        id: stableBoundaryId(a.id, b.id, "h", coordinate, horizontalStart, horizontalEnd),
        spaceAId: a.id,
        spaceBId: b.id,
        orientation: "horizontal",
        coordinate,
        start: horizontalStart,
        end: horizontalEnd,
        length: horizontalLength,
        sideOfA: "bottom",
        sideOfB: "top",
      };
    }
  }

  return null;
}

export function deriveSharedBoundaries(
  spaces: LayoutSpace[],
  tolerance = DEFAULT_GEOMETRY_TOLERANCE,
  minSharedLength = DEFAULT_MIN_SHARED_LENGTH
): SharedBoundary[] {
  const boundaries: SharedBoundary[] = [];

  for (let i = 0; i < spaces.length; i++) {
    for (let j = i + 1; j < spaces.length; j++) {
      const boundary = findSharedBoundary(spaces[i], spaces[j], tolerance, minSharedLength);
      if (boundary) boundaries.push(boundary);
    }
  }

  return boundaries;
}

type Interval = { start: number; end: number };

function mergeIntervals(intervals: Interval[], tolerance: number): Interval[] {
  if (intervals.length === 0) return [];

  const sorted = [...intervals]
    .filter((interval) => interval.end - interval.start > tolerance)
    .sort((a, b) => a.start - b.start);

  if (sorted.length === 0) return [];

  const merged: Interval[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const previous = merged[merged.length - 1];

    if (current.start <= previous.end + tolerance) {
      previous.end = Math.max(previous.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

function subtractIntervals(base: Interval, occupied: Interval[], tolerance: number): Interval[] {
  const clipped = occupied
    .map((interval) => ({
      start: Math.max(base.start, interval.start),
      end: Math.min(base.end, interval.end),
    }))
    .filter((interval) => interval.end - interval.start > tolerance);

  const merged = mergeIntervals(clipped, tolerance);
  const remaining: Interval[] = [];
  let cursor = base.start;

  for (const interval of merged) {
    if (interval.start - cursor > tolerance) {
      remaining.push({ start: cursor, end: interval.start });
    }
    cursor = Math.max(cursor, interval.end);
  }

  if (base.end - cursor > tolerance) {
    remaining.push({ start: cursor, end: base.end });
  }

  return remaining;
}

function sideOf(boundary: SharedBoundary, spaceId: string): WallSide | null {
  if (boundary.spaceAId === spaceId) return boundary.sideOfA;
  if (boundary.spaceBId === spaceId) return boundary.sideOfB;
  return null;
}

function exteriorId(spaceId: string, side: WallSide, coordinate: number, start: number, end: number) {
  const clean = (value: number) => value.toFixed(3).replace(/\./g, "_").replace(/-/g, "m");
  return `ext_${spaceId}_${side}_${clean(coordinate)}_${clean(start)}_${clean(end)}`;
}

export function deriveExteriorBoundaries(
  spaces: LayoutSpace[],
  sharedBoundaries: SharedBoundary[],
  tolerance = DEFAULT_GEOMETRY_TOLERANCE
): ExteriorBoundary[] {
  const result: ExteriorBoundary[] = [];

  for (const space of spaces) {
    const bounds = getSpaceBounds(space);
    const definitions: Array<{
      side: WallSide;
      orientation: "horizontal" | "vertical";
      coordinate: number;
      base: Interval;
    }> = [
      { side: "bottom", orientation: "horizontal", coordinate: bounds.minY, base: { start: bounds.minX, end: bounds.maxX } },
      { side: "top", orientation: "horizontal", coordinate: bounds.maxY, base: { start: bounds.minX, end: bounds.maxX } },
      { side: "left", orientation: "vertical", coordinate: bounds.minX, base: { start: bounds.minY, end: bounds.maxY } },
      { side: "right", orientation: "vertical", coordinate: bounds.maxX, base: { start: bounds.minY, end: bounds.maxY } },
    ];

    for (const definition of definitions) {
      const occupied = sharedBoundaries
        .filter((boundary) => sideOf(boundary, space.id) === definition.side)
        .map((boundary) => ({ start: boundary.start, end: boundary.end }));

      const exposed = subtractIntervals(definition.base, occupied, tolerance);
      for (const interval of exposed) {
        result.push({
          id: exteriorId(space.id, definition.side, definition.coordinate, interval.start, interval.end),
          spaceId: space.id,
          side: definition.side,
          orientation: definition.orientation,
          coordinate: definition.coordinate,
          start: interval.start,
          end: interval.end,
          length: interval.end - interval.start,
        });
      }
    }
  }

  return result;
}

export function deriveFloorTopology(
  spaces: LayoutSpace[],
  tolerance = DEFAULT_GEOMETRY_TOLERANCE,
  minSharedLength = DEFAULT_MIN_SHARED_LENGTH
): FloorTopology {
  const sharedBoundaries = deriveSharedBoundaries(spaces, tolerance, minSharedLength);
  const exteriorBoundaries = deriveExteriorBoundaries(spaces, sharedBoundaries, tolerance);

  return {
    sharedBoundaries,
    exteriorBoundaries,
    openings: [],
  };
}

export function boundaryBetween(
  topology: FloorTopology,
  aId: string,
  bId: string
): SharedBoundary | undefined {
  return topology.sharedBoundaries.find(
    (boundary) =>
      (boundary.spaceAId === aId && boundary.spaceBId === bId) ||
      (boundary.spaceAId === bId && boundary.spaceBId === aId)
  );
}

export function exteriorBoundariesForSpace(
  topology: FloorTopology,
  spaceId: string
): ExteriorBoundary[] {
  return topology.exteriorBoundaries.filter((boundary) => boundary.spaceId === spaceId);
}
