import type { SpatialNodeType } from "./spatial";

export const INVENTORY_CAMPAIGN_STATUSES = ["DRAFT", "READY", "OPEN", "REVIEW", "CLOSED", "ARCHIVED"] as const;
export type InventoryCampaignStatus = (typeof INVENTORY_CAMPAIGN_STATUSES)[number];

export const INVENTORY_OBSERVATION_RESULTS = [
  "MATCH",
  "WRONG_LOCATION",
  "UNKNOWN_CODE",
  "DUPLICATE",
  "OUT_OF_SCOPE"
] as const;
export type InventoryObservationResult = (typeof INVENTORY_OBSERVATION_RESULTS)[number];

export const SCAN_PAYLOAD_KINDS = ["NODE", "EQUIPMENT", "INVALID"] as const;
export type ScanPayloadKind = (typeof SCAN_PAYLOAD_KINDS)[number];

export const SCAN_SOURCES = ["CAMERA", "HID", "MANUAL"] as const;
export type ScanSource = (typeof SCAN_SOURCES)[number];

export interface ParsedScanPayload {
  kind: ScanPayloadKind;
  rawPayload: string;
  value: string | null;
}

export function parseScanPayload(payload: string): ParsedScanPayload {
  const rawPayload = payload.trim();
  if (rawPayload.startsWith("NODE:")) {
    const value = rawPayload.slice(5).trim();
    return {
      kind: value ? "NODE" : "INVALID",
      rawPayload,
      value: value || null
    };
  }
  if (rawPayload.startsWith("EQ:")) {
    const value = rawPayload.slice(3).trim();
    return {
      kind: value ? "EQUIPMENT" : "INVALID",
      rawPayload,
      value: value || null
    };
  }
  return {
    kind: "INVALID",
    rawPayload,
    value: rawPayload || null
  };
}

export interface InventoryCampaignScopeInput {
  spatialNodeId: string;
  includeChildren?: boolean;
}

export interface InventoryCampaignFamilyFilterInput {
  categoryId?: string | null;
  familyId?: string | null;
  subfamilyId?: string | null;
  typeId?: string | null;
}

export interface CreateInventoryCampaignInput {
  name: string;
  description?: string | null;
  plannedStartAt?: string | null;
  plannedEndAt?: string | null;
  responsibleUserId?: string | null;
  scopes: InventoryCampaignScopeInput[];
  familyFilters?: InventoryCampaignFamilyFilterInput[];
}

export interface UpdateInventoryCampaignInput extends Partial<CreateInventoryCampaignInput> {}

export interface InventoryCampaignSummary {
  id: string;
  name: string;
  description: string | null;
  status: InventoryCampaignStatus;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  openedAt: string | null;
  reviewStartedAt: string | null;
  closedAt: string | null;
  archivedAt: string | null;
  expectedItemsCount: number;
  observationsCount: number;
  anomaliesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryExpectedItemSummary {
  id: string;
  equipmentId: string;
  internalCode: string;
  numPiece: string | null;
  label: string;
  familyLabel: string | null;
  typeLabel: string | null;
  brandLabel: string | null;
  modelLabel: string | null;
  statusLabel: string | null;
  ownerLabel: string | null;
  immobilizationCode: string | null;
  expectedSpatialNodeId: string | null;
  expectedSpatialLabel: string | null;
  expectedSpatialType: SpatialNodeType | null;
  expectedSpatialPath: string | null;
  isSeen: boolean;
  seenAt: string | null;
}

export interface InventoryObservationSummary {
  id: string;
  campaignId: string;
  clientObservationId: string;
  scannedPayload: string;
  scannedCode: string | null;
  scanSource: ScanSource | null;
  deviceHint: string | null;
  result: InventoryObservationResult;
  equipmentId: string | null;
  equipmentInternalCode: string | null;
  expectedSpatialNodeId: string | null;
  expectedSpatialPath: string | null;
  observedSpatialNodeId: string | null;
  observedSpatialPath: string | null;
  correctionProposed: boolean;
  comment: string | null;
  clientObservedAt: string | null;
  observedAt: string;
  createdByName: string | null;
}

export interface InventoryCampaignDetail extends InventoryCampaignSummary {
  scopes: Array<{
    id: string;
    spatialNodeId: string;
    spatialPath: string;
    spatialLabel: string;
    spatialType: SpatialNodeType;
    includeChildren: boolean;
  }>;
  familyFilters: InventoryCampaignFamilyFilterInput[];
  expectedItems: InventoryExpectedItemSummary[];
  observations: InventoryObservationSummary[];
}

export interface InventoryCampaignListQuery {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: InventoryCampaignStatus;
  sort?: "name" | "createdAt" | "updatedAt" | "status";
  direction?: "asc" | "desc";
}

export interface InventoryCampaignExpectedPreviewResponse {
  total: number;
  items: InventoryExpectedItemSummary[];
}

export interface InventoryObservationInput {
  clientObservationId: string;
  scannedPayload: string;
  activeSpatialNodeId?: string | null;
  scanSource?: ScanSource | null;
  deviceHint?: string | null;
  clientObservedAt?: string | null;
  observedAt?: string | null;
  comment?: string | null;
}

export interface InventoryCampaignSyncInput {
  clientBatchId: string;
  activeSpatialNodeId?: string | null;
  observations: InventoryObservationInput[];
}

export interface InventoryCampaignSyncResponse {
  batchId: string;
  accepted: number;
  duplicates: number;
  observations: InventoryObservationSummary[];
}

export interface CompleteInventoryNodeInput {
  spatialNodeId: string;
}

export interface CompleteInventoryNodeResult {
  campaignId: string;
  spatialNodeId: string;
  missingCreated: number;
  missingAlreadyExisting: number;
}
