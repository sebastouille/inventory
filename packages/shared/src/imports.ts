import type { ListQuery } from "./listing";

export const IMPORT_TARGET_DOMAINS = ["ifc4-analysis", "spatial-nodes", "equipments", "immobilizations"] as const;
export type ImportTargetDomain = (typeof IMPORT_TARGET_DOMAINS)[number];

export const IMPORT_SOURCE_KINDS = ["CSV", "XLSX"] as const;
export type ImportSourceKind = (typeof IMPORT_SOURCE_KINDS)[number];

export const IMPORT_JOB_STATUSES = [
  "DRAFT",
  "UPLOADED",
  "MAPPED",
  "VALIDATED",
  "READY",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED"
] as const;
export type ImportJobStatus = (typeof IMPORT_JOB_STATUSES)[number];

export const IMPORT_JOB_WRITE_OPERATIONS = ["CREATED", "UPDATED"] as const;
export type ImportJobWriteOperation = (typeof IMPORT_JOB_WRITE_OPERATIONS)[number];

export const IMPORT_JOB_LOG_LEVELS = ["DEBUG", "INFO", "WARNING", "ERROR"] as const;
export type ImportJobLogLevel = (typeof IMPORT_JOB_LOG_LEVELS)[number];

export const IMPORT_TRANSFORM_TYPES = [
  "IDENTITY",
  "TRIM",
  "UPPERCASE",
  "LOWERCASE",
  "NUMBER",
  "DATE",
  "BOOLEAN",
  "CONSTANT",
  "LOOKUP_BY_CODE",
  "LOOKUP_BY_EXTERNAL_REF"
] as const;
export type ImportTransformType = (typeof IMPORT_TRANSFORM_TYPES)[number];

export const IMPORT_MATCH_POLICIES = ["CREATE_OR_UPDATE", "CREATE_ONLY", "UPDATE_ONLY"] as const;
export type ImportMatchPolicy = (typeof IMPORT_MATCH_POLICIES)[number];

export const IMPORT_REPORT_MODES = ["PREVIEW", "VALIDATE", "EXECUTE", "EXECUTE_NOOP"] as const;
export type ImportReportMode = (typeof IMPORT_REPORT_MODES)[number];

export const IMPORT_ROW_STATUSES = [
  "VALID",
  "WARNING",
  "REJECTED",
  "SIMULATED",
  "CREATED",
  "UPDATED",
  "NO_OP",
  "SKIPPED"
] as const;
export type ImportRowStatus = (typeof IMPORT_ROW_STATUSES)[number];

export interface ImportTargetFieldDefinition {
  key: string;
  label: string;
  required: boolean;
  description: string | null;
}

export interface ImportMappingInput {
  sourceColumn: string;
  targetField: string;
  transformType: ImportTransformType;
  transformConfig?: Record<string, unknown> | null;
  isRequired?: boolean;
  matchPolicy?: ImportMatchPolicy | null;
}

export interface ImportProfileSummary {
  id: string;
  organizationId: string;
  targetDomain: ImportTargetDomain;
  name: string;
  sourceKind: ImportSourceKind;
  sheetName: string | null;
  headerRowIndex: number;
  mappingsCount: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ImportProfileDetail extends ImportProfileSummary {
  options: Record<string, unknown> | null;
  mappings: ImportMappingInput[];
}

export interface ImportRowPreview {
  rowIndex: number;
  values: Record<string, string | null>;
}

export interface ImportSourceSnapshot {
  sheetNames: string[];
  selectedSheetName: string;
  headerRowIndex: number;
  headers: string[];
  rowCount: number;
  previewRows: ImportRowPreview[];
  rawRowsRef: string;
}

export interface ImportJobSummaryResponse {
  rowsRead: number;
  rowsValid: number;
  rowsRejected: number;
  rowsWithWarnings: number;
  simulatedWrites: number;
  appliedWrites: number;
  executionMode: ImportReportMode;
  targetDomain: ImportTargetDomain;
}

export interface ImportJobWriteSummary {
  createdCount: number;
  updatedCount: number;
}

export interface ImportJobPurgeBlockedItem {
  entityType?: "spatial_node" | "equipment" | "immobilization" | string;
  entityId?: string;
  targetKey?: string;
  nodeId?: string;
  path: string;
  reason:
    | "HAS_FOREIGN_DESCENDANTS"
    | "HAS_SCOPE_ASSIGNMENTS"
    | "HAS_LINKED_EQUIPMENTS"
    | "HAS_EXTERNAL_ASSIGNMENTS";
}

export interface ImportJobPurgeCreatedDataResult {
  status: "PURGED" | "BLOCKED" | "NO_OP";
  summary: {
    trackedCreated: number;
    trackedUpdated: number;
    alreadyMissing: number;
    purgedNodes: number;
    purgedScopes: number;
    purgedEquipments?: number;
    purgedImmobilizations?: number;
    purgedMovements?: number;
    purgedAssignments?: number;
    blockedNodes: number;
  };
  blocked: ImportJobPurgeBlockedItem[];
}

export interface ImportRowReport {
  rowIndex: number;
  status: ImportRowStatus;
  resolvedTargetKey: string | null;
  normalizedValues: Record<string, string | number | boolean | null>;
  messages: string[];
}

export interface ImportJobReport {
  mode: ImportReportMode;
  targetDomain: ImportTargetDomain;
  headers: string[];
  mappings: ImportMappingInput[];
  summary: ImportJobSummaryResponse;
  rows: ImportRowReport[];
}

export interface ImportJobSummary {
  id: string;
  organizationId: string;
  profileId: string | null;
  targetDomain: ImportTargetDomain;
  sourceKind: ImportSourceKind | null;
  status: ImportJobStatus;
  originalFilename: string | null;
  sheetName: string | null;
  createdAt: string;
  updatedAt: string;
  summary: ImportJobSummaryResponse | null;
  writeSummary: ImportJobWriteSummary | null;
}

export interface ImportJobDetail extends ImportJobSummary {
  sourceSnapshot: ImportSourceSnapshot | null;
  report: ImportJobReport | null;
  mappings: ImportMappingInput[];
  options: Record<string, unknown> | null;
}

export interface ImportJobLogEntry {
  id: string;
  organizationId: string;
  jobId: string;
  level: ImportJobLogLevel;
  step: string | null;
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ImportProfilesListQuery extends ListQuery {
  targetDomain?: ImportTargetDomain;
  isArchived?: "true" | "false";
  sort?: "name" | "targetDomain" | "createdAt" | "updatedAt";
}

export interface ImportJobsListQuery extends ListQuery {
  targetDomain?: ImportTargetDomain;
  status?: ImportJobStatus;
  profileId?: string;
  sort?: "createdAt" | "updatedAt" | "status" | "targetDomain";
}

export interface CreateImportProfileInput {
  targetDomain: ImportTargetDomain;
  name: string;
  sourceKind: ImportSourceKind;
  sheetName?: string | null;
  headerRowIndex?: number;
  mappings: ImportMappingInput[];
  options?: Record<string, unknown> | null;
}

export interface UpdateImportProfileInput extends CreateImportProfileInput {}

export interface CreateImportJobInput {
  targetDomain?: ImportTargetDomain;
  profileId?: string | null;
}

export interface UploadImportJobInput {
  sourceKind?: ImportSourceKind | null;
  sheetName?: string | null;
  headerRowIndex?: number | null;
}

export interface RunImportJobInput {
  profileId?: string | null;
  overrideMappings?: ImportMappingInput[] | null;
  options?: Record<string, unknown> | null;
}

export interface Ifc4ClassSummary {
  sourceClass: string;
  count: number;
  selectedByDefault: boolean;
}

export interface Ifc4SpatialPreviewNode {
  type: "SITE" | "BUILDING" | "FLOOR" | "ZONE" | "ROOM" | "LOCATION" | string;
  code: string;
  label: string;
  path: string;
  parentPath: string | null;
  externalRef: string | null;
  sourceClass: string | null;
  childrenCount: number;
  geometry?: Ifc4GeometryPreview | null;
}

export interface Ifc4GeometryPreview {
  geometryStatus: "READY" | "MISSING" | "ERROR";
  geometryMessage: string | null;
  worldCenter: { x: number; y: number; z: number } | null;
  worldSize: { x: number; y: number; z: number } | null;
  worldBbox: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  } | null;
  geometrySource: string | null;
  geometryMetadata: Record<string, unknown> | null;
}

export interface Ifc4AssetReferenceCandidate {
  resource: "categories" | "families" | "subfamilies" | "types" | "brands" | "models" | "statuses" | "owners";
  code: string;
  label: string;
  parentCode: string | null;
  sourceClass: string | null;
  count: number;
  exists: boolean;
}

export interface Ifc4EquipmentPreviewRow {
  rowIndex: number;
  sourceClass: string;
  internalCode: string;
  numPiece: string | null;
  externalRef: string | null;
  equipmentTypeCode: string | null;
  equipmentModelCode: string | null;
  equipmentStatusCode: string;
  ownerEntityCode: string;
  currentSpatialPath: string | null;
  currentSpatialExternalRef: string | null;
  sourceGlobalId: string | null;
  label: string | null;
  properties: Record<string, string>;
  geometry?: Ifc4GeometryPreview | null;
}

export interface Ifc4PropertyCandidate {
  name: string;
  sampleValue: string | null;
  count: number;
}

export interface Ifc4EquipmentPropertyMappings {
  internalCode?: string | null;
  numPiece?: string | null;
  externalRef?: string | null;
  category?: string | null;
  family?: string | null;
  subfamily?: string | null;
  type?: string | null;
  brand?: string | null;
  model?: string | null;
  status?: string | null;
  owner?: string | null;
}

export const IFC4_GEOMETRY_LEVELS = ["NONE", "MINIMUM", "INTERMEDIATE"] as const;
export type Ifc4GeometryLevel = (typeof IFC4_GEOMETRY_LEVELS)[number];
export const IFC4_IMPORT_POLICIES = ["STRICT_ALL_READY", "IMPORT_READY_ONLY"] as const;
export type Ifc4ImportPolicy = (typeof IFC4_IMPORT_POLICIES)[number];
export const IFC4_GEOMETRY_FILTERS = ["all", "ready", "to_fix"] as const;
export type Ifc4GeometryFilter = (typeof IFC4_GEOMETRY_FILTERS)[number];

export interface Ifc4AnalysisProfile {
  maxProducts: number;
  selectedClasses: string[];
  selectedProperties: string[];
  geometryLevel: Ifc4GeometryLevel;
  maxShapeParts: number;
  importPolicy?: Ifc4ImportPolicy;
}

export interface Ifc4ClassSelectionItem extends Ifc4ClassSummary {
  selectedByDefault: boolean;
}

export interface Ifc4SpatialOverride {
  path: string;
  type: "SITE" | "BUILDING" | "FLOOR" | "ZONE" | "ROOM" | "LOCATION" | string;
}

export interface Ifc4AssetReferenceOverride {
  resource: Ifc4AssetReferenceCandidate["resource"];
  code: string;
  nextResource: Ifc4AssetReferenceCandidate["resource"];
}

export interface Ifc4EquipmentOptions {
  selectedClasses?: string[];
  defaultStatusCode?: string;
  defaultOwnerEntityCode?: string;
  propertyMappings?: Ifc4EquipmentPropertyMappings | null;
}

export interface Ifc4GeometryDiagnosticItem {
  domain: "spatial" | "equipment";
  status: "READY" | "MISSING" | "ERROR" | "PARENT_INVALID" | "SPATIAL_TARGET_INVALID";
  importable: boolean;
  reasonCode: string | null;
  label: string;
  path: string | null;
  parentPath: string | null;
  sourceClass: string | null;
  globalId: string | null;
  ifcEntityId: string | number | null;
  geometryStatus: Ifc4GeometryPreview["geometryStatus"] | null;
  geometryMessage: string | null;
  worldSize: Ifc4GeometryPreview["worldSize"];
  worldBbox: Ifc4GeometryPreview["worldBbox"];
  messages: string[];
}

export interface Ifc4GeometryDiagnosticsResponse {
  summary: {
    total: number;
    ready: number;
    missing: number;
    errors: number;
    blockedByParent: number;
    blockedBySpatialTarget: number;
    importable: number;
    excluded: number;
  };
  items: Ifc4GeometryDiagnosticItem[];
}

export interface Ifc4AssistantProfileSummary {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  geometryLevel: Ifc4GeometryLevel;
  maxProducts: number;
  maxShapeParts: number;
  importPolicy: Ifc4ImportPolicy;
  selectedClassesCount: number;
  selectedPropertiesCount: number;
  isDefault: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Ifc4AssistantProfileDetail extends Ifc4AssistantProfileSummary {
  selectedClasses: string[];
  selectedProperties: string[];
  spatialMappings: Record<string, unknown> | null;
  equipmentMappings: Ifc4EquipmentPropertyMappings | null;
  assetReferenceOverrides: Ifc4AssetReferenceOverride[];
  spatialTypeOverrides: Ifc4SpatialOverride[];
}

export interface CreateIfc4AssistantProfileInput {
  name: string;
  description?: string | null;
  selectedClasses: string[];
  selectedProperties: string[];
  spatialMappings?: Record<string, unknown> | null;
  equipmentMappings?: Ifc4EquipmentPropertyMappings | null;
  assetReferenceOverrides?: Ifc4AssetReferenceOverride[];
  spatialTypeOverrides?: Ifc4SpatialOverride[];
  geometryLevel: Ifc4GeometryLevel;
  maxProducts: number;
  maxShapeParts: number;
  importPolicy: Ifc4ImportPolicy;
  isDefault?: boolean;
}

export interface UpdateIfc4AssistantProfileInput extends CreateIfc4AssistantProfileInput {}

export interface Ifc4AnalysisResponse {
  filename: string;
  schema: string | null;
  totalEntities: number;
  profile?: Ifc4AnalysisProfile;
  classSummary: Ifc4ClassSummary[];
  propertyCandidates: Ifc4PropertyCandidate[];
  spatialNodes: Ifc4SpatialPreviewNode[];
  assetReferences: Ifc4AssetReferenceCandidate[];
  equipmentRows: Ifc4EquipmentPreviewRow[];
  metadataSummary?: {
    spatialCount: number;
    candidateProducts: number;
    selectedClasses: string[];
  };
  geometrySummary?: {
    engine: "ifcopenshell-python";
    level?: Ifc4GeometryLevel;
    ready: number;
    missing: number;
    errors: number;
  };
  artifactRefs?: {
    metadataNdjson?: string;
    geometryNdjson?: string;
    extractionJson?: string;
  };
  processingMode?: "BATCH_PROFILED";
  warnings: string[];
}

export interface Ifc4AnalyzeJobResponse {
  job: ImportJobDetail;
}

export interface Ifc4QuickParseResponse {
  job: ImportJobDetail;
  filename: string;
  schema: string | null;
  classSummary: Ifc4ClassSelectionItem[];
  propertyCandidates: Ifc4PropertyCandidate[];
  profileDefaults: Ifc4AnalysisProfile;
  metadataSummary: {
    totalEntities: number;
    spatialCount: number;
    candidateProducts: number;
  };
  artifactRefs?: {
    classSummaryJson?: string;
    metadataNdjson?: string;
    summaryJson?: string;
  };
}

export interface Ifc4StartAnalysisInput {
  selectedClasses?: string[];
  selectedProperties?: string[];
  maxProducts?: number;
  geometryLevel?: Ifc4GeometryLevel;
  maxShapeParts?: number;
  importPolicy?: Ifc4ImportPolicy;
}

export interface Ifc4CancelJobResponse {
  job: ImportJobDetail;
  killedProcess: boolean;
}

export interface Ifc4AnalysisJobStatusResponse {
  job: ImportJobDetail;
  logs: ImportJobLogEntry[];
  result: Ifc4AnalysisResponse | null;
}

export interface Ifc4CreateJobResponse {
  job: ImportJobDetail;
  rowsPrepared: number;
  warnings: string[];
}

export interface Ifc4AssetReferencesApplyResult {
  created: Ifc4AssetReferenceCandidate[];
  existing: Ifc4AssetReferenceCandidate[];
  skipped: Ifc4AssetReferenceCandidate[];
  warnings: string[];
}

export type Ifc4WorkflowChildDomain = "spatial" | "equipments";
export type Ifc4WorkflowAction = "preview" | "validate" | "execute" | "cancel";

export interface Ifc4WorkflowChildState {
  job: ImportJobDetail | null;
  logs: ImportJobLogEntry[];
  report: ImportJobReport | null;
}

export interface Ifc4WorkflowAssetReferencesState {
  candidates: Ifc4AssetReferenceCandidate[];
  missingCount: number;
  existingCount: number;
  lastApplyResult: Ifc4AssetReferencesApplyResult | null;
}

export interface Ifc4WorkflowResponse {
  analysisJob: ImportJobDetail;
  analysisLogs: ImportJobLogEntry[];
  quickParse: Ifc4QuickParseResponse | null;
  analysis: Ifc4AnalysisResponse | null;
  spatial: Ifc4WorkflowChildState;
  assetReferences: Ifc4WorkflowAssetReferencesState;
  equipments: Ifc4WorkflowChildState;
}

export interface Ifc4WorkflowActionResponse {
  workflow: Ifc4WorkflowResponse;
  action: Ifc4WorkflowAction;
  domain: Ifc4WorkflowChildDomain;
  job: ImportJobDetail | null;
  report: ImportJobReport | null;
  logs: ImportJobLogEntry[];
}
