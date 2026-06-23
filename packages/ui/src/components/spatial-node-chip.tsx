"use client";

import type { OrganizationSettings, SpatialNodeIconKey, SpatialNodeType } from "@inventory/shared";
import { buildDefaultOrganizationSettings } from "@inventory/shared";
import {
  Building2Icon,
  DoorOpenIcon,
  Globe2Icon,
  Layers3Icon,
  MapIcon,
  MapPinIcon
} from "lucide-react";
import { cn } from "../lib/utils";

const ICONS: Record<SpatialNodeIconKey, typeof Globe2Icon> = {
  globe: Globe2Icon,
  building: Building2Icon,
  layers: Layers3Icon,
  map: MapIcon,
  door: DoorOpenIcon,
  pin: MapPinIcon
};

interface SpatialNodeChipProps {
  type: SpatialNodeType;
  label: string;
  settings?: OrganizationSettings | null;
  className?: string;
}

interface SpatialNodeTitleProps {
  type: SpatialNodeType;
  label: string;
  path?: string | null;
  settings?: OrganizationSettings | null;
  className?: string;
  pathClassName?: string;
}

function getAppearance(type: SpatialNodeType, settings?: OrganizationSettings | null) {
  return settings?.spatialDisplay.nodeTypes[type] ?? buildDefaultOrganizationSettings().spatialDisplay.nodeTypes[type];
}

export function SpatialNodeChip({ type, label, settings, className }: SpatialNodeChipProps) {
  const appearance = getAppearance(type, settings);
  const Icon = ICONS[appearance.icon];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold",
        className
      )}
      style={{
        borderColor: `${appearance.color}40`,
        color: appearance.color,
        backgroundColor: `${appearance.color}14`
      }}
    >
      <Icon className="size-3.5" />
      <span>{label}</span>
    </span>
  );
}

export function SpatialNodeTitle({
  type,
  label,
  path,
  settings,
  className,
  pathClassName
}: SpatialNodeTitleProps) {
  const appearance = getAppearance(type, settings);
  const Icon = ICONS[appearance.icon];

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <span
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border"
        style={{
          borderColor: `${appearance.color}40`,
          color: appearance.color,
          backgroundColor: `${appearance.color}14`
        }}
      >
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 truncate font-medium text-foreground">{label}</span>
      {path ? (
        <span className={cn("min-w-0 truncate font-mono text-xs text-muted-foreground", pathClassName)}>
          {path}
        </span>
      ) : null}
    </div>
  );
}
