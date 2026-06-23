import type { ExportableListQuery } from "./listing";
import type { ImmobilizationSummary } from "./immobilizations";
import type { SpatialNodeType } from "./spatial";

export const ASSET_ASSIGNMENT_TYPES = ["PERSON", "LOCATION", "ASSET"] as const;
export type AssetAssignmentType = (typeof ASSET_ASSIGNMENT_TYPES)[number];

export const EQUIPMENT_REFERENCE_RESOURCES = [
  "categories",
  "families",
  "subfamilies",
  "types",
  "brands",
  "models",
  "statuses",
  "owners",
  "attachment-rules"
] as const;

export type EquipmentReferenceResource = (typeof EQUIPMENT_REFERENCE_RESOURCES)[number];

export interface EquipmentReferenceItem {
  id: string;
  code: string;
  label: string;
  description: string | null;
  isActive: boolean;
  parentId: string | null;
  parentLabel: string | null;
  isGeneric: boolean;
}

export interface AttachmentRuleItem {
  id: string;
  sourceFamilyId: string;
  sourceFamilyLabel: string;
  targetFamilyId: string;
  targetFamilyLabel: string;
  isActive: boolean;
}

export interface AssetAssignableUser {
  id: string;
  email: string;
  name: string | null;
}

export interface AssetAssignmentInput {
  assignmentType: AssetAssignmentType;
  targetUserId?: string | null;
  targetPersonName?: string | null;
  targetLocationId?: string | null;
  targetEquipmentId?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  notes?: string | null;
}

export interface AssetAssignmentSummary {
  id: string;
  assignmentType: AssetAssignmentType;
  targetUserId: string | null;
  targetUserName: string | null;
  targetUserEmail: string | null;
  targetPersonName: string | null;
  targetLocationId: string | null;
  targetLocationLabel: string | null;
  targetEquipmentId: string | null;
  targetEquipmentInternalCode: string | null;
  targetEquipmentLabel: string | null;
  startsAt: string;
  endsAt: string | null;
  notes: string | null;
  isActive: boolean;
}

export interface AssetTypeSummary {
  id: string;
  code: string;
  label: string;
  familyId: string;
  familyLabel: string;
  subfamilyId: string;
  subfamilyLabel: string;
}

export interface AssetModelSummary {
  id: string;
  code: string;
  label: string;
  brandId: string;
  brandLabel: string;
  isGeneric: boolean;
}

export interface AssetStatusSummary {
  id: string;
  code: string;
  label: string;
}

export interface OwnerEntitySummary {
  id: string;
  code: string;
  label: string;
}

export interface AssetListItem {
  id: string;
  internalCode: string;
  numPiece: string | null;
  externalRef: string | null;
  serialNumber: string | null;
  isDeleted: boolean;
  currentSpatialNodeId: string | null;
  currentSpatialPath: string | null;
  currentSpatialLabel: string | null;
  currentSpatialType: SpatialNodeType | null;
  immobilizationId: string | null;
  immobilizationCode: string | null;
  immobilizationLabel: string | null;
  createdAt: string;
  updatedAt: string;
  equipmentType: AssetTypeSummary;
  equipmentModel: AssetModelSummary | null;
  equipmentStatus: AssetStatusSummary;
  ownerEntity: OwnerEntitySummary;
  immobilization: ImmobilizationSummary | null;
  activeAssignments: AssetAssignmentSummary[];
}

export interface AssetDetail extends AssetListItem {
  technicalCharacteristics: string | null;
  notes: string | null;
  receivedAt: string | null;
  commissionedAt: string | null;
  lastInventoryAt: string | null;
  initializedByImportJobId: string | null;
  deletedAt: string | null;
  assignments: AssetAssignmentSummary[];
}

export interface AssetHistoryEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
  metadata: unknown;
}

export interface AssetListQuery extends ExportableListQuery {
  sort?:
    | "internalCode"
    | "serialNumber"
    | "createdAt"
    | "updatedAt"
    | "statusLabel"
    | "ownerLabel"
    | "immobilizationCode";
  familyId?: string;
  subfamilyId?: string;
  typeId?: string;
  statusId?: string;
  ownerEntityId?: string;
  immobilizationId?: string;
  locationId?: string;
  isArchived?: "true" | "false";
}

export interface CreateAssetInput {
  internalCode: string;
  numPiece?: string | null;
  externalRef?: string | null;
  serialNumber?: string | null;
  equipmentTypeId: string;
  equipmentModelId?: string | null;
  equipmentStatusId: string;
  ownerEntityId: string;
  currentSpatialNodeId?: string | null;
  immobilizationId?: string | null;
  technicalCharacteristics?: string | null;
  notes?: string | null;
  receivedAt?: string | null;
  commissionedAt?: string | null;
  lastInventoryAt?: string | null;
  assignments?: AssetAssignmentInput[];
}

export interface UpdateAssetInput extends CreateAssetInput {}

export interface CreateEquipmentReferenceInput {
  code: string;
  label: string;
  description?: string | null;
  parentId?: string | null;
  isGeneric?: boolean;
}

export interface UpdateEquipmentReferenceInput extends CreateEquipmentReferenceInput {}

export interface CreateAttachmentRuleInput {
  sourceFamilyId: string;
  targetFamilyId: string;
}

export interface UpdateAttachmentRuleInput extends CreateAttachmentRuleInput {}
