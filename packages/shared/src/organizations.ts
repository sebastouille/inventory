import type { SpatialNodeType } from "./spatial";

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
}

export const SPATIAL_NODE_ICON_KEYS = [
  "globe",
  "building",
  "layers",
  "map",
  "door",
  "pin"
] as const;

export const SPATIAL_NODE_ICON_LABELS: Record<SpatialNodeIconKey, string> = {
  globe: "Globe",
  building: "Batiment",
  layers: "Etages",
  map: "Zone",
  door: "Porte",
  pin: "Repere"
};

export type SpatialNodeIconKey = (typeof SPATIAL_NODE_ICON_KEYS)[number];

export interface SpatialNodeAppearance {
  icon: SpatialNodeIconKey;
  color: string;
}

export type SpatialNodeAppearanceMap = Record<SpatialNodeType, SpatialNodeAppearance>;

export interface OrganizationSpatialDisplaySettings {
  nodeTypes: SpatialNodeAppearanceMap;
}

export const ORGANIZATION_SPATIAL_SCOPE_POLICIES = [
  "SCOPED",
  "ORGANIZATION_WIDE"
] as const;

export type OrganizationSpatialScopePolicy = (typeof ORGANIZATION_SPATIAL_SCOPE_POLICIES)[number];

export interface OrganizationIamSettings {
  spatialScopePolicy: OrganizationSpatialScopePolicy;
}

export interface OrganizationSettings {
  iam: OrganizationIamSettings;
  spatialDisplay: OrganizationSpatialDisplaySettings;
}

export interface OrganizationCurrentResponse extends OrganizationSummary {
  settings: OrganizationSettings;
}

export interface UpdateOrganizationSpatialDisplayInput {
  spatialDisplay: OrganizationSpatialDisplaySettings;
}

export interface UpdateOrganizationSettingsInput {
  iam: OrganizationIamSettings;
  spatialDisplay: OrganizationSpatialDisplaySettings;
}

export const DEFAULT_SPATIAL_NODE_APPEARANCE: SpatialNodeAppearanceMap = {
  SITE: { icon: "globe", color: "#0F766E" },
  BUILDING: { icon: "building", color: "#1D4ED8" },
  FLOOR: { icon: "layers", color: "#7C3AED" },
  ZONE: { icon: "map", color: "#D97706" },
  ROOM: { icon: "door", color: "#DC2626" },
  LOCATION: { icon: "pin", color: "#475569" }
};

export function buildDefaultOrganizationSettings(): OrganizationSettings {
  return {
    iam: {
      spatialScopePolicy: "SCOPED"
    },
    spatialDisplay: {
      nodeTypes: DEFAULT_SPATIAL_NODE_APPEARANCE
    }
  };
}
