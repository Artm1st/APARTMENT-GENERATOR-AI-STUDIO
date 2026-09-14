export type SpaceType =
  | "living"
  | "bedroom"
  | "bathroom"
  | "kitchen"
  | "dining"
  | "corridor"
  | "garage"
  | "laundry"
  | "terrace"
  | "patio"
  | "studio"
  | "other";

export type PrivacyLevel = "public" | "semi_private" | "private" | "service";

export type SpatialRelationKind =
  | "must_touch"
  | "prefer_touch"
  | "must_not_touch"
  | "direct_access"
  | "near";

export interface ProgramSpace {
  id: string;
  type: SpaceType;
  label: string;
  targetArea?: number;
  minArea?: number;
  minWidth?: number;
  privacy: PrivacyLevel;
  requiresExteriorOpening?: boolean;
  wetArea?: boolean;
  floor?: number;
}

export interface SpatialRelation {
  id: string;
  a: string;
  b: string;
  kind: SpatialRelationKind;
  weight: number;
}

export interface DesignPreference {
  id: string;
  key:
    | "compactness"
    | "daylight"
    | "cross_ventilation"
    | "privacy"
    | "short_circulation"
    | "wet_core_grouping"
    | "regular_structure";
  weight: number;
}

export interface ArchitecturalProgram {
  projectType: "single_family_house" | "apartment_unit";
  spaces: ProgramSpace[];
  relations: SpatialRelation[];
  preferences: DesignPreference[];
}

export interface SiteConstraints {
  width: number;
  length: number;
  setbackFront: number;
  setbackBack: number;
  setbackLeft: number;
  setbackRight: number;
  source?: string;
}

export interface LayoutSpace {
  id: string;
  programSpaceId: string;
  type: SpaceType;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  floor: number;
}

export type WallSide = "top" | "bottom" | "left" | "right";
export type SegmentOrientation = "horizontal" | "vertical";

export interface SharedBoundary {
  id: string;
  spaceAId: string;
  spaceBId: string;
  orientation: SegmentOrientation;
  coordinate: number;
  start: number;
  end: number;
  length: number;
  sideOfA: WallSide;
  sideOfB: WallSide;
}

export interface ExteriorBoundary {
  id: string;
  spaceId: string;
  side: WallSide;
  orientation: SegmentOrientation;
  coordinate: number;
  start: number;
  end: number;
  length: number;
}

export interface TopologyOpening {
  id: string;
  type: "door" | "window";
  hostBoundaryId: string;
  spaceAId: string;
  spaceBId?: string;
  center: number;
  width: number;
}

export interface FloorTopology {
  sharedBoundaries: SharedBoundary[];
  exteriorBoundaries: ExteriorBoundary[];
  openings: TopologyOpening[];
}

export interface GeometryIssue {
  code:
    | "SPACE_OVERLAP"
    | "OUTSIDE_BUILDABLE_AREA"
    | "MISSING_REQUIRED_TOUCH"
    | "FORBIDDEN_TOUCH"
    | "BROKEN_DIRECT_ACCESS"
    | "MISSING_EXTERIOR_OPENING"
    | "DISCONNECTED_CIRCULATION";
  severity: "error" | "warning";
  message: string;
  spaceIds: string[];
}

export interface CandidateScore {
  total: number;
  hardConstraintPass: boolean;
  adjacency: number;
  circulation: number;
  compactness: number;
  daylight: number;
  privacy: number;
  areaEfficiency: number;
  structuralRegularity: number;
  zoning: number;
  issues: GeometryIssue[];
}

export interface LayoutCandidate {
  id: string;
  spaces: LayoutSpace[];
  topology: FloorTopology;
  score?: CandidateScore;
  seed?: number;
}
