export const INVENTORY_ANOMALY_TYPES = ["WRONG_LOCATION", "UNKNOWN_CODE", "MISSING", "DUPLICATE", "OUT_OF_SCOPE"] as const;
export type InventoryAnomalyType = (typeof INVENTORY_ANOMALY_TYPES)[number];

export const INVENTORY_ANOMALY_STATUSES = ["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"] as const;
export type InventoryAnomalyStatus = (typeof INVENTORY_ANOMALY_STATUSES)[number];

export const INVENTORY_CORRECTION_TYPES = [
  "LOCATION_CHANGE",
  "STATUS_CHANGE",
  "RELABEL_REQUEST",
  "MANUAL_IMMOBILIZATION_LINK"
] as const;
export type InventoryCorrectionType = (typeof INVENTORY_CORRECTION_TYPES)[number];

export const INVENTORY_CORRECTION_STATUSES = ["PROPOSED", "APPROVED", "REJECTED", "APPLIED", "FAILED"] as const;
export type InventoryCorrectionStatus = (typeof INVENTORY_CORRECTION_STATUSES)[number];

export interface InventoryAnomalySummary {
  id: string;
  campaignId: string;
  campaignName: string;
  type: InventoryAnomalyType;
  status: InventoryAnomalyStatus;
  equipmentId: string | null;
  equipmentInternalCode: string | null;
  scannedCode: string | null;
  expectedSpatialPath: string | null;
  observedSpatialPath: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryAnomalyDetail extends InventoryAnomalySummary {
  expectedSnapshot: unknown;
  observedSnapshot: unknown;
  corrections: InventoryCorrectionSummary[];
}

export interface InventoryAnomalyListQuery {
  page?: number;
  pageSize?: number;
  q?: string;
  campaignId?: string;
  type?: InventoryAnomalyType;
  status?: InventoryAnomalyStatus;
  sort?: "createdAt" | "updatedAt" | "type" | "status";
  direction?: "asc" | "desc";
}

export interface InventoryCorrectionSummary {
  id: string;
  anomalyId: string | null;
  equipmentId: string | null;
  correctionType: InventoryCorrectionType;
  status: InventoryCorrectionStatus;
  targetSpatialNodeId: string | null;
  targetEquipmentStatusId: string | null;
  targetImmobilizationId: string | null;
  notes: string | null;
  proposedAt: string;
  approvedAt: string | null;
  appliedAt: string | null;
  failureReason: string | null;
}

export interface CreateInventoryCorrectionInput {
  anomalyId?: string | null;
  equipmentId?: string | null;
  correctionType: InventoryCorrectionType;
  targetSpatialNodeId?: string | null;
  targetEquipmentStatusId?: string | null;
  targetImmobilizationId?: string | null;
  notes?: string | null;
}

export interface UpdateInventoryAnomalyInput {
  status?: InventoryAnomalyStatus;
  notes?: string | null;
}
