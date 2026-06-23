import type { SpatialNodeType } from "./spatial";

export const BIM3D_MAP_STATUSES = ["BUILDING", "READY", "FAILED", "ARCHIVED"] as const;
export type Bim3dMapStatus = (typeof BIM3D_MAP_STATUSES)[number];

export const BIM3D_AGE_BUCKETS = [
  "FRESH",
  "RECENT",
  "WARNING",
  "STALE",
  "CRITICAL",
  "UNKNOWN"
] as const;
export type Bim3dAgeBucket = (typeof BIM3D_AGE_BUCKETS)[number];

export interface Bim3dVector3 {
  x: number;
  y: number;
  z: number;
}

export interface Bim3dBoundingBox {
  min: Bim3dVector3;
  max: Bim3dVector3;
}

export type Bim3dGeometrySource =
  | "ifcopenshell-bounding-boxes"
  | "ifc-persisted-geometry"
  | "ifc-bounding-boxes"
  | "mixed-ifc-fallback"
  | "spatial-fallback"
  | "spatial-demo";

export interface Bim3dFloorGuide {
  id: string;
  label: string;
  spatialNodeId: string | null;
  elevation: number;
  bbox: Bim3dBoundingBox;
  sourceGlobalId: string | null;
}

export interface Bim3dAgeSummary {
  fresh: number;
  recent: number;
  warning: number;
  stale: number;
  critical: number;
  unknown: number;
}

export interface Bim3dSceneNode {
  id: string;
  type: SpatialNodeType;
  code: string;
  label: string;
  path: string;
  parentId: string | null;
  sourceGlobalId: string | null;
  bbox: Bim3dBoundingBox;
  equipmentsCount: number;
  ageSummary: Bim3dAgeSummary;
  geometrySource?: Bim3dGeometrySource;
  ifcEntityId?: number | null;
  localBbox?: Bim3dBoundingBox | null;
  worldBbox?: Bim3dBoundingBox | null;
  floorGuideId?: string | null;
  fallbackReason?: string | null;
  geometryMetadata?: Record<string, unknown> | null;
}

export interface Bim3dSceneEquipment {
  id: string;
  internalCode: string;
  label: string;
  spatialNodeId: string | null;
  spatialPath: string | null;
  sourceGlobalId: string | null;
  position: Bim3dVector3;
  size: Bim3dVector3;
  lastInventoryAt: string | null;
  ageBucket: Bim3dAgeBucket;
  statusLabel: string;
  familyLabel: string;
  typeLabel: string;
  geometrySource?: Bim3dGeometrySource;
  ifcEntityId?: number | null;
  localBbox?: Bim3dBoundingBox | null;
  worldBbox?: Bim3dBoundingBox | null;
  floorGuideId?: string | null;
  fallbackReason?: string | null;
  geometryMetadata?: Record<string, unknown> | null;
}

export interface Bim3dSceneMaterials {
  node: Record<SpatialNodeType, string>;
  equipment: string;
  selected: string;
  heatmap: Record<Bim3dAgeBucket, string>;
}

export interface Bim3dSceneLimits {
  desktopMaxNodes: number;
  desktopMaxEquipments: number;
  mobileMaxNodes: number;
  mobileMaxEquipments: number;
  mode: "ifc-simplified" | "spatial-fallback" | Bim3dGeometrySource;
}

export interface Bim3dSceneMetadata {
  mapId: string;
  organizationId: string;
  name: string;
  generatedAt: string;
  importJobId: string | null;
  sourceFilename: string | null;
  nodesCount: number;
  equipmentsCount: number;
  geometrySource?: Bim3dGeometrySource;
  extractionEngine?: "ifcopenshell-python" | "spatial-layout";
  globalBbox?: Bim3dBoundingBox | null;
  sceneOrigin?: Bim3dVector3 | null;
  unitScale?: number | null;
  geometryStats?: Record<string, number | string | boolean | null>;
  fallbackCount?: number;
}

export interface Bim3dScene {
  version: "1.0";
  metadata: Bim3dSceneMetadata;
  nodes: Bim3dSceneNode[];
  equipments: Bim3dSceneEquipment[];
  floorGuides?: Bim3dFloorGuide[];
  materials: Bim3dSceneMaterials;
  limits: Bim3dSceneLimits;
}

export interface Bim3dMapSummary {
  id: string;
  name: string;
  status: Bim3dMapStatus;
  mode: string;
  importJobId: string | null;
  sourceFilename: string | null;
  sceneFileRef: string | null;
  nodesCount: number;
  equipmentsCount: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface Bim3dMapBuildSummary {
  id: string;
  mapId: string;
  status: Bim3dMapStatus;
  mode: string;
  sceneFileRef: string | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  nodesCount: number;
  equipmentsCount: number;
}

export interface Bim3dBuildMapInput {
  name: string;
  importJobId?: string | null;
  mode?: "simplified";
  maxNodeDepth?: number | null;
  includeEquipments?: boolean;
}
