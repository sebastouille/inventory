import type { ListQuery } from "./listing";

export const SPATIAL_NODE_TYPES = ["SITE", "BUILDING", "FLOOR", "ZONE", "ROOM", "LOCATION"] as const;
export type SpatialNodeType = (typeof SPATIAL_NODE_TYPES)[number];

export const SPATIAL_SOURCE_KINDS = ["LEGACY", "CSV", "XLSX", "IFC4"] as const;
export type SpatialSourceKind = (typeof SPATIAL_SOURCE_KINDS)[number];

export const SPATIAL_NODE_LIST_MAX_PAGE_SIZE = 200;

export interface SpatialNodeListItem {
  id: string;
  organizationId: string;
  type: SpatialNodeType;
  code: string;
  label: string;
  description: string | null;
  path: string;
  depth: number;
  sortOrder: number;
  parentId: string | null;
  parentPath: string | null;
  parentLabel: string | null;
  legacyLocationId: string | null;
  externalSource: SpatialSourceKind | null;
  externalRef: string | null;
  sourceClass: string | null;
  sourceMetadata: Record<string, unknown> | null;
  importProfileId: string | null;
  lastImportJobId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  childrenCount: number;
  equipmentCount: number;
}

export interface SpatialNodeDetail extends SpatialNodeListItem {
  children: SpatialNodeListItem[];
}

export interface SpatialNodeTreeItem {
  id: string;
  type: SpatialNodeType;
  code: string;
  label: string;
  path: string;
  depth: number;
  isActive: boolean;
  externalSource: SpatialSourceKind | null;
  externalRef: string | null;
  sourceClass: string | null;
  children: SpatialNodeTreeItem[];
}

export interface SpatialNodeListQuery extends ListQuery {
  type?: SpatialNodeType;
  parentId?: string;
  ancestorId?: string;
  isActive?: "true" | "false";
  sort?: "path" | "code" | "label" | "type" | "createdAt" | "updatedAt";
}

export interface SpatialNodeFormInput {
  type: SpatialNodeType;
  code: string;
  label: string;
  description?: string | null;
  parentId?: string | null;
  externalRef?: string | null;
  sourceClass?: string | null;
  sourceMetadata?: Record<string, unknown> | null;
  isActive?: boolean;
}
