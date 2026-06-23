export const LABEL_EXPORT_FORMATS = ["xlsx", "ods", "pdf-a4"] as const;
export type LabelExportFormat = (typeof LABEL_EXPORT_FORMATS)[number];

export interface LabelExportEquipmentQuery {
  selectedSpatialNodeIds?: string[];
  includeChildren?: boolean;
  categoryIds?: string[];
  familyIds?: string[];
  subfamilyIds?: string[];
  typeIds?: string[];
  statusIds?: string[];
  ownerEntityIds?: string[];
  hasImmobilization?: boolean | null;
  q?: string | null;
  manualEquipmentIds?: string[];
  format?: LabelExportFormat;
}

export interface LabelExportSpatialNodeQuery {
  selectedSpatialNodeIds?: string[];
  includeChildren?: boolean;
  nodeTypes?: string[];
  format?: LabelExportFormat;
}

export interface EquipmentLabelPreviewItem {
  id: string;
  family: string;
  internalCode: string;
  barcodePayload: string;
  category: string | null;
  subfamily: string | null;
  type: string | null;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  numPiece: string | null;
  externalRef: string | null;
  currentSpatialNodeLabel: string | null;
  currentSpatialPath: string | null;
  ownerEntity: string | null;
  status: string | null;
  immobilizationCode: string | null;
}

export interface SpatialNodeLabelPreviewItem {
  id: string;
  nodeType: string;
  nodeCode: string;
  nodeLabel: string;
  spatialPath: string;
  barcodePayload: string;
}

export interface LabelExportPreviewResponse<TItem> {
  total: number;
  items: TItem[];
}
