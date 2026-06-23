import {
  buildDefaultOrganizationSettings,
  ORGANIZATION_SPATIAL_SCOPE_POLICIES,
  SPATIAL_NODE_ICON_KEYS,
  SPATIAL_NODE_TYPES,
  type OrganizationSettings,
  type OrganizationSpatialDisplaySettings,
  type OrganizationSpatialScopePolicy,
  type SpatialNodeAppearanceMap,
  type SpatialNodeIconKey
} from "@inventory/shared";
import { BadRequestException } from "@nestjs/common";

const DEFAULTS = buildDefaultOrganizationSettings();

export function resolveSpatialScopePolicy(
  raw: unknown
): OrganizationSpatialScopePolicy {
  const candidate =
    raw && typeof raw === "object" && "spatialScopePolicy" in raw
      ? (raw as Record<string, unknown>).spatialScopePolicy
      : DEFAULTS.iam.spatialScopePolicy;

  if (
    typeof candidate === "string" &&
    ORGANIZATION_SPATIAL_SCOPE_POLICIES.includes(candidate as OrganizationSpatialScopePolicy)
  ) {
    return candidate as OrganizationSpatialScopePolicy;
  }

  return DEFAULTS.iam.spatialScopePolicy;
}

export function normalizeOrganizationSettings(raw: unknown): OrganizationSettings {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    iam: {
      spatialScopePolicy: resolveSpatialScopePolicy(source.iam)
    },
    spatialDisplay: validateSpatialDisplay(source.spatialDisplay)
  };
}

export function validateOrganizationSettings(raw: unknown): OrganizationSettings {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    iam: {
      spatialScopePolicy: validateSpatialScopePolicy(
        source.iam && typeof source.iam === "object" ? (source.iam as Record<string, unknown>).spatialScopePolicy : undefined
      )
    },
    spatialDisplay: validateSpatialDisplay(source.spatialDisplay)
  };
}

export function validateSpatialDisplay(raw: unknown): OrganizationSpatialDisplaySettings {
  const nodeTypes = raw && typeof raw === "object" && "nodeTypes" in raw ? raw.nodeTypes : undefined;
  if (!nodeTypes || typeof nodeTypes !== "object") {
    return DEFAULTS.spatialDisplay;
  }

  const result = {} as SpatialNodeAppearanceMap;

  for (const type of SPATIAL_NODE_TYPES) {
    const candidate = (nodeTypes as Record<string, unknown>)[type];
    if (!candidate || typeof candidate !== "object") {
      result[type] = DEFAULTS.spatialDisplay.nodeTypes[type];
      continue;
    }

    const icon = validateIcon((candidate as Record<string, unknown>).icon, type);
    const color = validateColor((candidate as Record<string, unknown>).color, type);
    result[type] = { icon, color };
  }

  return { nodeTypes: result };
}

function validateSpatialScopePolicy(raw: unknown): OrganizationSpatialScopePolicy {
  if (
    typeof raw !== "string" ||
    !ORGANIZATION_SPATIAL_SCOPE_POLICIES.includes(raw as OrganizationSpatialScopePolicy)
  ) {
    throw new BadRequestException("Politique IAM spatiale invalide");
  }

  return raw as OrganizationSpatialScopePolicy;
}

function validateIcon(raw: unknown, type: string): SpatialNodeIconKey {
  if (typeof raw !== "string" || !SPATIAL_NODE_ICON_KEYS.includes(raw as SpatialNodeIconKey)) {
    throw new BadRequestException(`Icone invalide pour ${type}`);
  }
  return raw as SpatialNodeIconKey;
}

function validateColor(raw: unknown, type: string) {
  if (typeof raw !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(raw)) {
    throw new BadRequestException(`Couleur invalide pour ${type}`);
  }
  return raw.toUpperCase();
}
