import type { ExportableListQuery } from "./listing";
import type { AssetAssignmentType } from "./assets";
import type { SpatialNodeType } from "./spatial";

export const EQUIPMENT_MOVEMENT_TYPES = [
  "INITIAL_STATE",
  "LOCATION_CHANGED",
  "ASSIGNMENT_ADDED",
  "ASSIGNMENT_REMOVED",
  "ASSIGNMENT_CHANGED"
] as const;

export type EquipmentMovementType = (typeof EQUIPMENT_MOVEMENT_TYPES)[number];

export const EQUIPMENT_MOVEMENT_TRIGGER_TYPES = [
  "EQUIPMENT_CREATED",
  "EQUIPMENT_UPDATED",
  "ASSIGNMENTS_REPLACED",
  "IMPORT_EXECUTED",
  "SYSTEM_BACKFILL"
] as const;

export type EquipmentMovementTriggerType = (typeof EQUIPMENT_MOVEMENT_TRIGGER_TYPES)[number];

export const EQUIPMENT_MOVEMENT_SOURCES = ["USER", "IMPORT", "SYSTEM"] as const;

export type EquipmentMovementSource = (typeof EQUIPMENT_MOVEMENT_SOURCES)[number];

export interface EquipmentMovementSpatialSnapshot {
  id: string;
  type: SpatialNodeType;
  code: string;
  label: string;
  path: string;
}

export interface EquipmentMovementAssignmentSnapshot {
  assignmentType: Exclude<AssetAssignmentType, "LOCATION">;
  targetUserId: string | null;
  targetUserName: string | null;
  targetUserEmail: string | null;
  targetPersonName: string | null;
  targetEquipmentId: string | null;
  targetEquipmentInternalCode: string | null;
  targetEquipmentTypeLabel: string | null;
  targetEquipmentModelLabel: string | null;
}

export interface EquipmentMovementSummary {
  id: string;
  organizationId: string;
  equipmentId: string;
  equipmentInternalCode: string;
  movementType: EquipmentMovementType;
  triggerType: EquipmentMovementTriggerType;
  source: EquipmentMovementSource;
  fromSpatialNodeId: string | null;
  toSpatialNodeId: string | null;
  fromSpatialSnapshot: EquipmentMovementSpatialSnapshot | null;
  toSpatialSnapshot: EquipmentMovementSpatialSnapshot | null;
  fromAssignmentSnapshot: EquipmentMovementAssignmentSnapshot | null;
  toAssignmentSnapshot: EquipmentMovementAssignmentSnapshot | null;
  reason: string | null;
  createdById: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
  createdAt: string;
}

export interface EquipmentMovementDetail extends EquipmentMovementSummary {}

export interface EquipmentMovementListQuery extends ExportableListQuery {
  sort?: "createdAt" | "movementType" | "source" | "equipmentInternalCode";
  equipmentId?: string;
  movementType?: EquipmentMovementType;
  source?: EquipmentMovementSource;
}
