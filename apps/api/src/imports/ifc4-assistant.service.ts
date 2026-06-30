import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit, UnprocessableEntityException } from "@nestjs/common";
import { Prisma, type ImportTargetDomain as PrismaImportTargetDomain } from "@prisma/client";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type {
  Ifc4AnalyzeJobResponse,
  Ifc4AnalysisProfile,
  Ifc4AnalysisResponse,
  Ifc4AssetReferenceOverride,
  Ifc4AssetReferenceCandidate,
  Ifc4AssetReferencesApplyResult,
  Ifc4AssistantProfileDetail,
  Ifc4AssistantProfileSummary,
  Ifc4ClassSummary,
  Ifc4CancelJobResponse,
  Ifc4GeometryDiagnosticItem,
  Ifc4GeometryDiagnosticsResponse,
  Ifc4GeometryPreview,
  Ifc4CreateJobResponse,
  Ifc4EquipmentPropertyMappings,
  Ifc4EquipmentPreviewRow,
  Ifc4GeometryLevel,
  Ifc4ImportPolicy,
  Ifc4PropertyCandidate,
  Ifc4QuickParseResponse,
  Ifc4SpatialOverride,
  Ifc4SpatialPreviewNode,
  Ifc4WorkflowAction,
  Ifc4WorkflowActionResponse,
  Ifc4WorkflowChildDomain,
  Ifc4WorkflowResponse,
  ImportJobDetail,
  ImportJobReport,
  ImportMappingInput,
  ImportRowPreview,
  ImportTargetDomain,
  RunImportJobInput
} from "@inventory/shared";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { IfcGeometryWorker, type IfcExtractObject, type IfcGeometryExtraction } from "../bim-3d/ifc-geometry-worker";
import { PrismaService } from "../prisma.service";
import {
  persistImportArtifact,
  persistImportSourcePath,
  readImportArtifact,
  resolveImportArtifact
} from "./imports-storage";
import { ImportsService } from "./imports.service";
import type { RunImportJobDto } from "./dto/run-import-job.dto";

type IfcEntity = {
  id: string;
  type: string;
  args: string[];
};

type IfcProduct = {
  id: string;
  sourceClass: string;
  globalId: string | null;
  name: string | null;
  description: string | null;
  objectType: string | null;
  properties: Record<string, string>;
};

type PreparedIfc = {
  schema: string | null;
  totalEntities: number;
  classSummary: Ifc4ClassSummary[];
  propertyCandidates: Ifc4PropertyCandidate[];
  spatialRows: ImportRowPreview[];
  spatialNodes: Ifc4SpatialPreviewNode[];
  assetReferenceCandidates: Ifc4AssetReferenceCandidate[];
  equipmentRows: Ifc4EquipmentPreviewRow[];
  equipmentRawRows: ImportRowPreview[];
  geometrySummary: Ifc4AnalysisResponse["geometrySummary"];
  warnings: string[];
  profile: Ifc4AnalysisProfile;
  artifactRefs: Ifc4AnalysisResponse["artifactRefs"];
};

type Ifc4AnalysisArtifact = {
  analysis: Ifc4AnalysisResponse;
  spatialRows: ImportRowPreview[];
  equipmentRawRows: ImportRowPreview[];
  warnings: string[];
};

type Ifc4QuickParseArtifact = Omit<Ifc4QuickParseResponse, "job">;

type UploadedIfcFile = {
  originalname: string;
  mimetype?: string;
  buffer?: Buffer;
  path?: string;
  size?: number;
};

type AssistantOptions = {
  selectedClasses?: string[];
  selectedProperties: string[];
  defaultStatusCode?: string;
  defaultOwnerEntityCode?: string;
  maxProducts: number;
  geometryLevel: Ifc4GeometryLevel;
  maxShapeParts: number;
  importPolicy: Ifc4ImportPolicy;
  propertyMappings: Ifc4EquipmentPropertyMappings;
};

type AssistantOptionsInput = {
  selectedClasses?: unknown;
  defaultStatusCode?: unknown;
  defaultOwnerEntityCode?: unknown;
  selectedProperties?: unknown;
  maxProducts?: unknown;
  geometryLevel?: unknown;
  maxShapeParts?: unknown;
  importPolicy?: unknown;
  spatialOverrides?: unknown;
  assetReferenceOverrides?: unknown;
  equipmentOptions?: unknown;
};

const DEFAULT_STATUS_CODE = "EN_SERVICE";
const DEFAULT_OWNER_CODE = "CPRP";
const DEFAULT_MAX_PRODUCTS = 5000;
const DEFAULT_MAX_SHAPE_PARTS = 12;
const DEFAULT_SELECTED_CLASSES = ["IFCFURNITURE"];
const STOREY_DERIVED_GEOMETRY_SOURCE = "ifc-storey-derived";
const STOREY_DERIVED_FROM_BUILDING_GEOMETRY_SOURCE = "ifc-storey-derived-from-building";
const STOREY_DERIVED_THICKNESS_METERS = 0.08;
const STOREY_DERIVED_MARGIN_METERS = 0.5;
const EQUIPMENT_CLASSES = new Set([
  "IFCFURNITURE",
  "IFCFURNISHINGELEMENT",
  "IFCFLOWTERMINAL",
  "IFCBUILDINGELEMENTPROXY",
  "IFCDISTRIBUTIONELEMENT",
  "IFCDISTRIBUTIONFLOWELEMENT",
  "IFCELEMENTASSEMBLY"
]);
const SPATIAL_HEADERS = [
  "type",
  "code",
  "label",
  "description",
  "path",
  "parentPath",
  "externalRef",
  "sourceClass",
  "sourceMetadata",
  "geometrySource",
  "geometryMetadata",
  "worldCenterX",
  "worldCenterY",
  "worldCenterZ",
  "worldSizeX",
  "worldSizeY",
  "worldSizeZ",
  "isActive"
];
const EQUIPMENT_HEADERS = [
  "internalCode",
  "numPiece",
  "externalRef",
  "serialNumber",
  "equipmentTypeCode",
  "equipmentModelCode",
  "equipmentStatusCode",
  "ownerEntityCode",
  "currentSpatialPath",
  "currentSpatialExternalRef",
  "technicalCharacteristics",
  "geometrySource",
  "geometryMetadata",
  "worldCenterX",
  "worldCenterY",
  "worldCenterZ",
  "worldSizeX",
  "worldSizeY",
  "worldSizeZ",
  "notes"
];
const IFC4_CHILD_DB_TARGET_BY_DOMAIN: Record<Ifc4WorkflowChildDomain, PrismaImportTargetDomain> = {
  spatial: "SPATIAL_NODES",
  equipments: "EQUIPMENTS"
};

function normalizeAscii(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
}

function normalizeCode(value: string | null | undefined, fallback: string) {
  const normalized = normalizeAscii(value ?? "");
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeLabel(value: string | null | undefined, fallback: string) {
  const normalized = (value ?? "").trim();
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeFreeText(value: unknown) {
  if (value == null) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function pathDepth(path: string) {
  return Math.max(0, path.split("/").filter(Boolean).length - 1);
}

function decodeIfcEscapes(value: string) {
  return value
    .replace(/\\X2\\([0-9A-Fa-f]+)\\X0\\/g, (_, hex: string) => {
      const chars: string[] = [];
      for (let index = 0; index < hex.length; index += 4) {
        const code = Number.parseInt(hex.slice(index, index + 4), 16);
        if (Number.isFinite(code)) {
          chars.push(String.fromCharCode(code));
        }
      }
      return chars.join("");
    })
    .replace(/\\X\\([0-9A-Fa-f]{2})/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/''/g, "'");
}

function splitArgs(input: string) {
  const args: string[] = [];
  let current = "";
  let depth = 0;
  let inString = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === "'" && inString && next === "'") {
      current += "''";
      index += 1;
      continue;
    }
    if (char === "'") {
      inString = !inString;
      current += char;
      continue;
    }
    if (!inString && char === "(") {
      depth += 1;
      current += char;
      continue;
    }
    if (!inString && char === ")") {
      depth -= 1;
      current += char;
      continue;
    }
    if (!inString && depth === 0 && char === ",") {
      args.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  if (current.trim().length > 0 || input.endsWith(",")) {
    args.push(current.trim());
  }
  return args;
}

function readString(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized || normalized === "$" || normalized === "*") {
    return null;
  }
  if (normalized.startsWith("'") && normalized.endsWith("'")) {
    return decodeIfcEscapes(normalized.slice(1, -1));
  }
  return null;
}

function readIfcValue(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized || normalized === "$" || normalized === "*") {
    return null;
  }
  const directString = readString(normalized);
  if (directString != null) {
    return directString;
  }
  const wrapper = normalized.match(/^[A-Z0-9_]+\(([\s\S]*)\)$/i);
  if (wrapper) {
    const inner = wrapper[1].trim();
    const innerString = readString(inner);
    if (innerString != null) {
      return innerString;
    }
    return inner.replace(/^\.+|\.+$/g, "");
  }
  return normalized.replace(/^\.+|\.+$/g, "");
}

function readIfcNumber(value: string | undefined) {
  const rawValue = readIfcValue(value);
  if (rawValue == null) {
    return null;
  }
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : null;
}

function readRef(value: string | undefined) {
  const match = value?.trim().match(/^#(\d+)$/);
  return match ? match[1] : null;
}

function readRefs(value: string | undefined) {
  return [...(value ?? "").matchAll(/#(\d+)/g)].map((match) => match[1]);
}

function pushCount(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function addCandidate(
  map: Map<string, Ifc4AssetReferenceCandidate>,
  input: Omit<Ifc4AssetReferenceCandidate, "count" | "exists">
) {
  const key = `${input.resource}:${input.code}:${input.parentCode ?? ""}`;
  const existing = map.get(key);
  if (existing) {
    existing.count += 1;
    return;
  }
  map.set(key, {
    ...input,
    count: 1,
    exists: false
  });
}

function parseSelectedClasses(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim().toUpperCase()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim().toUpperCase()).filter(Boolean);
      }
    } catch {
      return value.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean);
    }
  }
  return DEFAULT_SELECTED_CLASSES;
}

function parseStringList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function parsePositiveInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function parseGeometryLevel(value: unknown): Ifc4GeometryLevel {
  const normalized = String(value ?? "MINIMUM").trim().toUpperCase();
  if (normalized === "NONE" || normalized === "MINIMUM" || normalized === "INTERMEDIATE") {
    return normalized;
  }
  return "MINIMUM";
}

function parseImportPolicy(value: unknown): Ifc4ImportPolicy {
  const normalized = String(value ?? "STRICT_ALL_READY").trim().toUpperCase();
  return normalized === "IMPORT_READY_ONLY" ? "IMPORT_READY_ONLY" : "STRICT_ALL_READY";
}

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    return {};
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function normalizePropertyName(value: unknown) {
  const normalized = normalizeFreeText(value);
  return normalized && normalized !== "__none__" ? normalized : null;
}

function normalizePropertyMappings(value: unknown): Ifc4EquipmentPropertyMappings {
  const parsed = parseJsonObject(value);
  return {
    internalCode: normalizePropertyName(parsed.internalCode),
    numPiece: normalizePropertyName(parsed.numPiece),
    externalRef: normalizePropertyName(parsed.externalRef),
    category: normalizePropertyName(parsed.category),
    family: normalizePropertyName(parsed.family),
    subfamily: normalizePropertyName(parsed.subfamily),
    type: normalizePropertyName(parsed.type),
    brand: normalizePropertyName(parsed.brand),
    model: normalizePropertyName(parsed.model),
    status: normalizePropertyName(parsed.status),
    owner: normalizePropertyName(parsed.owner)
  };
}

function buildMappings(targetDomain: ImportTargetDomain, headers: string[]) {
  return headers.map((header) => ({
    sourceColumn: header,
    targetField: header,
    transformType: "TRIM",
    isRequired:
      targetDomain === "spatial-nodes"
        ? ["type", "code", "label"].includes(header)
        : ["internalCode", "equipmentTypeCode", "equipmentStatusCode", "ownerEntityCode"].includes(header)
  })) satisfies ImportMappingInput[];
}

function buildRow(rowIndex: number, values: Record<string, string | null>): ImportRowPreview {
  return {
    rowIndex,
    values
  };
}

function geometryRowValues(geometry: Ifc4GeometryPreview | null | undefined) {
  return {
    geometrySource: geometry?.geometrySource ?? null,
    geometryMetadata: geometry?.geometryMetadata ? JSON.stringify(geometry.geometryMetadata) : null,
    worldCenterX: geometry?.worldCenter ? String(geometry.worldCenter.x) : null,
    worldCenterY: geometry?.worldCenter ? String(geometry.worldCenter.y) : null,
    worldCenterZ: geometry?.worldCenter ? String(geometry.worldCenter.z) : null,
    worldSizeX: geometry?.worldSize ? String(geometry.worldSize.x) : null,
    worldSizeY: geometry?.worldSize ? String(geometry.worldSize.y) : null,
    worldSizeZ: geometry?.worldSize ? String(geometry.worldSize.z) : null
  };
}

function geometryMetadataValue(geometry: Ifc4GeometryPreview | null | undefined, key: string) {
  const value = geometry?.geometryMetadata?.[key];
  return value == null ? null : value;
}

function formatBbox(value: Ifc4GeometryPreview["worldBbox"]) {
  if (!value) {
    return "";
  }
  return [
    value.min.x,
    value.min.y,
    value.min.z,
    value.max.x,
    value.max.y,
    value.max.z
  ].map((item) => String(item)).join(";");
}

function formatWorldSize(value: Ifc4GeometryPreview["worldSize"]) {
  if (!value) {
    return "";
  }
  return [value.x, value.y, value.z].map((item) => String(item)).join("x");
}

function analysisEquipmentRowsBySelection(rows: Ifc4EquipmentPreviewRow[], selectedClasses: Set<string>) {
  return rows.filter((row) => selectedClasses.has(row.sourceClass.toUpperCase()));
}

function mergeGeometryPreview(left: Ifc4GeometryPreview | null | undefined, right: Ifc4GeometryPreview | null | undefined) {
  if (!left || left.geometryStatus !== "READY") return right ?? null;
  if (!right || right.geometryStatus !== "READY") return left;
  if (!left.worldBbox || !right.worldBbox) return left;
  const bbox = {
    min: {
      x: Math.min(left.worldBbox.min.x, right.worldBbox.min.x),
      y: Math.min(left.worldBbox.min.y, right.worldBbox.min.y),
      z: Math.min(left.worldBbox.min.z, right.worldBbox.min.z)
    },
    max: {
      x: Math.max(left.worldBbox.max.x, right.worldBbox.max.x),
      y: Math.max(left.worldBbox.max.y, right.worldBbox.max.y),
      z: Math.max(left.worldBbox.max.z, right.worldBbox.max.z)
    }
  };
  return {
    geometryStatus: "READY",
    geometryMessage: null,
    worldCenter: {
      x: (bbox.min.x + bbox.max.x) / 2,
      y: (bbox.min.y + bbox.max.y) / 2,
      z: (bbox.min.z + bbox.max.z) / 2
    },
    worldSize: {
      x: bbox.max.x - bbox.min.x,
      y: bbox.max.y - bbox.min.y,
      z: bbox.max.z - bbox.min.z
    },
    worldBbox: bbox,
    geometrySource: "ifcopenshell-python-aggregate",
    geometryMetadata: {
      bbox,
      extractionEngine: "ifcopenshell-python",
      aggregate: true
    }
  } satisfies Ifc4GeometryPreview;
}

function isStoreyNode(node: Pick<Ifc4SpatialPreviewNode, "sourceClass" | "type">) {
  return node.sourceClass?.toUpperCase() === "IFCBUILDINGSTOREY" || node.type === "FLOOR";
}

function isDerivedStoreyGeometry(geometry: Ifc4GeometryPreview | null | undefined) {
  return geometry?.geometrySource === STOREY_DERIVED_GEOMETRY_SOURCE
    || geometry?.geometrySource === STOREY_DERIVED_FROM_BUILDING_GEOMETRY_SOURCE;
}

function withDerivedStoreyFailure(geometry: Ifc4GeometryPreview | null | undefined): Ifc4GeometryPreview {
  return {
    geometryStatus: geometry?.geometryStatus === "ERROR" ? "ERROR" : "MISSING",
    geometryMessage: geometry?.geometryMessage ?? "Emprise d etage impossible a calculer depuis les enfants",
    worldCenter: geometry?.worldCenter ?? null,
    worldSize: geometry?.worldSize ?? null,
    worldBbox: geometry?.worldBbox ?? null,
    geometrySource: geometry?.geometrySource ?? null,
    geometryMetadata: {
      ...(geometry?.geometryMetadata ?? {}),
      reasonCode: "STOREY_DERIVATION_FAILED",
      requiresOwnGeometry: false
    }
  };
}

function deriveStoreyGeometry(input: {
  storey: Ifc4SpatialPreviewNode;
  sourceGlobalId: string | null;
  sourceMetadata: Record<string, unknown>;
  parentGeometry: Ifc4GeometryPreview | null;
  childGeometries: Ifc4GeometryPreview[];
}): Ifc4GeometryPreview | null {
  const parentBbox = input.parentGeometry?.geometryStatus === "READY" ? input.parentGeometry.worldBbox : null;
  const childBboxes = input.childGeometries
    .filter((geometry) => geometry.geometryStatus === "READY" && geometry.worldBbox)
    .map((geometry) => geometry.worldBbox!);
  if (!parentBbox && childBboxes.length === 0) {
    return null;
  }

  const sourceBbox = parentBbox ?? {
    min: {
      x: Math.min(...childBboxes.map((bbox) => bbox.min.x)) - STOREY_DERIVED_MARGIN_METERS,
      y: Math.min(...childBboxes.map((bbox) => bbox.min.y)),
      z: Math.min(...childBboxes.map((bbox) => bbox.min.z)) - STOREY_DERIVED_MARGIN_METERS
    },
    max: {
      x: Math.max(...childBboxes.map((bbox) => bbox.max.x)) + STOREY_DERIVED_MARGIN_METERS,
      y: Math.max(...childBboxes.map((bbox) => bbox.max.y)),
      z: Math.max(...childBboxes.map((bbox) => bbox.max.z)) + STOREY_DERIVED_MARGIN_METERS
    }
  };
  const properties = typeof input.sourceMetadata.properties === "object" && input.sourceMetadata.properties != null
    ? input.sourceMetadata.properties as Record<string, unknown>
    : {};
  const elevationValue = normalizeFreeText(input.sourceMetadata.elevationMeters ?? properties.Elevation ?? properties.elevation ?? properties.StoreyElevation);
  const elevation = elevationValue != null && Number.isFinite(Number(elevationValue))
    ? Number(elevationValue)
    : sourceBbox.min.y;
  const derivation = parentBbox ? "STOREY_EXTENT_FROM_PARENT_BUILDING" : "STOREY_EXTENT_FROM_CHILDREN";
  const geometrySource = parentBbox ? STOREY_DERIVED_FROM_BUILDING_GEOMETRY_SOURCE : STOREY_DERIVED_GEOMETRY_SOURCE;
  const message = parentBbox
    ? "Geometrie d etage derivee depuis l emprise du batiment parent"
    : "Geometrie d etage derivee depuis les enfants";
  const bbox = {
    min: { x: sourceBbox.min.x, y: elevation, z: sourceBbox.min.z },
    max: { x: sourceBbox.max.x, y: elevation + STOREY_DERIVED_THICKNESS_METERS, z: sourceBbox.max.z }
  };

  return {
    geometryStatus: "READY",
    geometryMessage: message,
    worldCenter: {
      x: (bbox.min.x + bbox.max.x) / 2,
      y: (bbox.min.y + bbox.max.y) / 2,
      z: (bbox.min.z + bbox.max.z) / 2
    },
    worldSize: {
      x: bbox.max.x - bbox.min.x,
      y: bbox.max.y - bbox.min.y,
      z: bbox.max.z - bbox.min.z
    },
    worldBbox: bbox,
    geometrySource,
    geometryMetadata: {
      bbox,
      derivation,
      thicknessMeters: STOREY_DERIVED_THICKNESS_METERS,
      marginMeters: parentBbox ? 0 : STOREY_DERIVED_MARGIN_METERS,
      sourceGlobalId: input.sourceGlobalId,
      parentGeometrySource: input.parentGeometry?.geometrySource ?? null,
      derivedFromChildrenCount: childBboxes.length,
      requiresOwnGeometry: false,
      extractionEngine: "ifcopenshell-python"
    }
  };
}

@Injectable()
export class Ifc4AssistantService implements OnModuleInit {
  private readonly logger = new Logger(Ifc4AssistantService.name);
  private readonly analysisQueue: string[] = [];
  private activeAnalysisJobs = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly importsService: ImportsService,
    private readonly auditService: AuditService,
    private readonly ifcGeometryWorker: IfcGeometryWorker
  ) {}

  onModuleInit() {
    void this.resumeRunningAnalysisJobs();
  }

  async createAnalysisJob(
    auth: AuthenticatedUser,
    file: UploadedIfcFile | undefined,
    optionsInput?: AssistantOptionsInput
  ): Promise<Ifc4AnalyzeJobResponse> {
    if (!file) {
      throw new BadRequestException("Fichier IFC4 requis");
    }
    if (!file.originalname.toLowerCase().endsWith(".ifc")) {
      throw new BadRequestException("Le fichier doit utiliser l extension .ifc");
    }

    const created = await this.prisma.importJob.create({
      data: {
        organizationId: auth.organizationId,
        targetDomain: "IFC4_ANALYSIS",
        status: "RUNNING",
        originalFilename: file.originalname,
        storedMimeType: file.mimetype ?? "application/octet-stream",
        options: {
          sourceAssistant: "IFC4_ANALYSIS",
          assistantOptions: this.normalizeOptions(optionsInput)
        } as unknown as Prisma.InputJsonValue,
        startedAt: new Date(),
        createdById: auth.sub
      }
    });

    const storedFile = file.path
      ? await persistImportSourcePath(auth.organizationId, created.id, file.originalname, file.path)
      : await this.persistBufferedIfc(auth.organizationId, created.id, file);

    await this.prisma.importJob.update({
      where: { id: created.id },
      data: {
        storedFileRef: storedFile.relativePath
      }
    });

    await this.appendJobLog(auth.organizationId, created.id, "INFO", "queued", "Analyse IFC4 planifiee", {
      filename: file.originalname,
      size: file.size ?? file.buffer?.length ?? null
    });

    await this.auditService.log({
      organizationId: auth.organizationId,
      userId: auth.sub,
      action: "imports.ifc4.analysis.created",
      entityType: "import_job",
      entityId: created.id,
      metadata: {
        filename: file.originalname
      }
    });

    this.enqueueAnalysisJob(created.id);

    if (file.path) {
      await rm(file.path, { force: true });
    }

    return {
      job: await this.importsService.getJob(auth.organizationId, created.id)
    };
  }

  async quickParseAnalysisJob(
    auth: AuthenticatedUser,
    file: UploadedIfcFile | undefined,
    optionsInput?: AssistantOptionsInput
  ): Promise<Ifc4QuickParseResponse> {
    if (!file) {
      throw new BadRequestException("Fichier IFC4 requis");
    }
    if (!file.originalname.toLowerCase().endsWith(".ifc")) {
      throw new BadRequestException("Le fichier doit utiliser l extension .ifc");
    }

    const options = this.normalizeOptions(optionsInput);
    const created = await this.prisma.importJob.create({
      data: {
        organizationId: auth.organizationId,
        targetDomain: "IFC4_ANALYSIS",
        status: "RUNNING",
        originalFilename: file.originalname,
        storedMimeType: file.mimetype ?? "application/octet-stream",
        options: {
          sourceAssistant: "IFC4_ANALYSIS",
          assistantOptions: options
        } as unknown as Prisma.InputJsonValue,
        startedAt: new Date(),
        createdById: auth.sub
      }
    });

    const storedFile = file.path
      ? await persistImportSourcePath(auth.organizationId, created.id, file.originalname, file.path)
      : await this.persistBufferedIfc(auth.organizationId, created.id, file);
    await this.prisma.importJob.update({
      where: { id: created.id },
      data: { storedFileRef: storedFile.relativePath }
    });

    if (file.path) {
      await rm(file.path, { force: true });
    }

    try {
      await this.appendJobLog(auth.organizationId, created.id, "INFO", "quick_parse_started", "Parse rapide IFC4 demarre", {
        filename: file.originalname,
        size: file.size ?? file.buffer?.length ?? null
      });
      const quickResult = await this.buildQuickParseResult(
        auth.organizationId,
        created.id,
        file.originalname,
        storedFile.absolutePath,
        options
      );
      const storedQuickResult = await persistImportArtifact(auth.organizationId, created.id, "ifc4-quick-result.json", quickResult);
      await this.prisma.importJob.update({
        where: { id: created.id },
        data: {
          status: "READY",
          report: {
            kind: "IFC4_QUICK_PARSE",
            quickResultRef: storedQuickResult.relativePath,
            filename: file.originalname,
            schema: quickResult.schema,
            classCount: quickResult.classSummary.length,
            artifactRefs: quickResult.artifactRefs
          } as unknown as Prisma.InputJsonValue,
          summary: {
            rowsRead: quickResult.metadataSummary.totalEntities,
            rowsValid: quickResult.metadataSummary.candidateProducts,
            rowsRejected: 0,
            rowsWithWarnings: 0,
            simulatedWrites: 0,
            appliedWrites: 0,
            executionMode: "PREVIEW",
            targetDomain: "ifc4-analysis"
          } as unknown as Prisma.InputJsonValue,
          completedAt: null
        }
      });
      await this.appendJobLog(auth.organizationId, created.id, "INFO", "quick_parse_completed", "Parse rapide IFC4 termine", {
        classes: quickResult.classSummary.length,
        candidateProducts: quickResult.metadataSummary.candidateProducts
      });
      await this.auditService.log({
        organizationId: auth.organizationId,
        userId: auth.sub,
        action: "imports.ifc4.quick_parse.created",
        entityType: "import_job",
        entityId: created.id,
        metadata: { filename: file.originalname }
      });
      return {
        job: await this.importsService.getJob(auth.organizationId, created.id),
        ...quickResult
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur parse rapide IFC4";
      await this.failAnalysisJob(created, message, { code: "IFC_QUICK_PARSE_FAILED" });
      throw error;
    }
  }

  async getQuickParseResult(organizationId: string, jobId: string): Promise<Ifc4QuickParseResponse> {
    const job = await this.getAnalysisJobAnyStatusOrThrow(organizationId, jobId);
    const report = this.readRecord(job.report);
    const quickResultRef = typeof report.quickResultRef === "string" ? report.quickResultRef : null;
    if (quickResultRef) {
      const quickResult = await readImportArtifact<Ifc4QuickParseArtifact>(quickResultRef);
      return {
        job: await this.importsService.getJob(organizationId, job.id),
        ...quickResult
      };
    }
    if (job.status === "COMPLETED") {
      const artifact = await this.readAnalysisArtifact(organizationId, jobId);
      return {
        job: await this.importsService.getJob(organizationId, job.id),
        filename: artifact.analysis.filename,
        schema: artifact.analysis.schema,
        classSummary: artifact.analysis.classSummary,
        propertyCandidates: artifact.analysis.propertyCandidates,
        profileDefaults: artifact.analysis.profile ?? this.buildProfile(this.readAssistantOptions(job.options)),
        metadataSummary: {
          totalEntities: artifact.analysis.totalEntities,
          spatialCount: artifact.analysis.spatialNodes.length,
          candidateProducts: artifact.analysis.equipmentRows.length
        },
        artifactRefs: {
          summaryJson: "ifc4-analysis-result.json"
        }
      };
    }
    throw new NotFoundException("Resultat de parse rapide IFC4 introuvable");
  }

  async startAnalysisJob(
    auth: AuthenticatedUser,
    jobId: string,
    optionsInput?: AssistantOptionsInput
  ): Promise<Ifc4AnalyzeJobResponse> {
    const job = await this.getAnalysisJobAnyStatusOrThrow(auth.organizationId, jobId);
    if (!job.storedFileRef) {
      throw new NotFoundException("Fichier source IFC introuvable");
    }
    if (!["READY", "FAILED", "COMPLETED", "CANCELLED"].includes(job.status)) {
      throw new BadRequestException("Le job IFC4 ne peut pas etre demarre depuis cet etat");
    }
    const options = this.normalizeOptions(optionsInput);
    await this.prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: "RUNNING",
        options: {
          sourceAssistant: "IFC4_ANALYSIS",
          assistantOptions: options
        } as unknown as Prisma.InputJsonValue,
        startedAt: new Date(),
        completedAt: null
      }
    });
    await this.appendJobLog(auth.organizationId, job.id, "INFO", "queued", "Previsualisation IFC4 planifiee", {
      profile: this.buildProfile(options)
    });
    this.enqueueAnalysisJob(job.id);
    return {
      job: await this.importsService.getJob(auth.organizationId, job.id)
    };
  }

  async cancelAnalysisJob(auth: AuthenticatedUser, jobId: string): Promise<Ifc4CancelJobResponse> {
    const job = await this.getAnalysisJobAnyStatusOrThrow(auth.organizationId, jobId);
    if (["COMPLETED", "FAILED", "CANCELLED"].includes(job.status)) {
      throw new BadRequestException("Ce job IFC4 ne peut plus etre annule");
    }
    const queuedIndex = this.analysisQueue.indexOf(job.id);
    if (queuedIndex >= 0) {
      this.analysisQueue.splice(queuedIndex, 1);
    }
    await this.appendJobLog(auth.organizationId, job.id, "WARNING", "cancel_requested", "Annulation IFC4 demandee par l utilisateur", {
      status: job.status
    });
    const killedProcess = this.ifcGeometryWorker.cancel(job.id);
    await this.prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: "CANCELLED",
        completedAt: new Date()
      }
    });
    await this.appendJobLog(auth.organizationId, job.id, "WARNING", "cancelled", "Analyse IFC4 annulee", {
      killedProcess
    });
    await this.auditService.log({
      organizationId: auth.organizationId,
      userId: auth.sub,
      action: "imports.ifc4.analysis.cancelled",
      entityType: "import_job",
      entityId: job.id,
      metadata: { killedProcess }
    });
    return {
      job: await this.importsService.getJob(auth.organizationId, job.id),
      killedProcess
    };
  }

  async getAnalysisResult(organizationId: string, jobId: string): Promise<Ifc4AnalysisResponse> {
    const artifact = await this.readAnalysisArtifact(organizationId, jobId);
    return artifact.analysis;
  }

  async getGeometryDiagnostics(organizationId: string, jobId: string): Promise<Ifc4GeometryDiagnosticsResponse> {
    const artifact = await this.readAnalysisArtifact(organizationId, jobId);
    return this.buildGeometryDiagnostics(organizationId, artifact.analysis);
  }

  async exportGeometryDiagnosticsCsv(organizationId: string, jobId: string) {
    const diagnostics = await this.getGeometryDiagnostics(organizationId, jobId);
    const headers = [
      "domain",
      "status",
      "importable",
      "reasonCode",
      "label",
      "path",
      "parentPath",
      "sourceClass",
      "globalId",
      "ifcEntityId",
      "geometryStatus",
      "geometryMessage",
      "worldSize",
      "worldBbox",
      "messages"
    ];
    const escape = (value: unknown) => {
      const text = String(value ?? "");
      return /[",\r\n;]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
    };
    const lines = diagnostics.items
      .filter((item) => !item.importable)
      .map((item) => [
        item.domain,
        item.status,
        item.importable,
        item.reasonCode,
        item.label,
        item.path,
        item.parentPath,
        item.sourceClass,
        item.globalId,
        item.ifcEntityId,
        item.geometryStatus,
        item.geometryMessage,
        formatWorldSize(item.worldSize),
        formatBbox(item.worldBbox),
        item.messages.join(" | ")
      ].map(escape).join(";"));
    return [headers.join(";"), ...lines].join("\r\n");
  }

  async listAssistantProfiles(organizationId: string): Promise<Ifc4AssistantProfileSummary[]> {
    const profiles = await this.prisma.ifc4AssistantProfile.findMany({
      where: { organizationId, isArchived: false },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }]
    });
    return profiles.map((profile) => this.mapAssistantProfileSummary(profile));
  }

  async getAssistantProfile(organizationId: string, profileId: string): Promise<Ifc4AssistantProfileDetail> {
    const profile = await this.getAssistantProfileOrThrow(organizationId, profileId);
    return this.mapAssistantProfileDetail(profile);
  }

  async createAssistantProfile(auth: AuthenticatedUser, input: {
    name: string;
    description?: string | null;
    selectedClasses: string[];
    selectedProperties: string[];
    spatialMappings?: Record<string, unknown> | null;
    equipmentMappings?: Record<string, unknown> | null;
    assetReferenceOverrides?: unknown[];
    spatialTypeOverrides?: unknown[];
    geometryLevel: Ifc4GeometryLevel;
    maxProducts: number;
    maxShapeParts: number;
    importPolicy: Ifc4ImportPolicy;
    isDefault?: boolean;
  }) {
    const created = await this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.ifc4AssistantProfile.updateMany({
          where: { organizationId: auth.organizationId, isDefault: true },
          data: { isDefault: false }
        });
      }
      return tx.ifc4AssistantProfile.create({
        data: {
          organizationId: auth.organizationId,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          selectedClasses: parseSelectedClasses(input.selectedClasses) as unknown as Prisma.InputJsonValue,
          selectedProperties: parseStringList(input.selectedProperties) as unknown as Prisma.InputJsonValue,
          spatialMappings: input.spatialMappings ? input.spatialMappings as Prisma.InputJsonValue : Prisma.JsonNull,
          equipmentMappings: input.equipmentMappings ? normalizePropertyMappings(input.equipmentMappings) as unknown as Prisma.InputJsonValue : Prisma.JsonNull,
          assetReferenceOverrides: this.normalizeAssetReferenceOverrides(input.assetReferenceOverrides) as unknown as Prisma.InputJsonValue,
          spatialTypeOverrides: this.normalizeSpatialOverrides(input.spatialTypeOverrides) as unknown as Prisma.InputJsonValue,
          geometryLevel: parseGeometryLevel(input.geometryLevel),
          maxProducts: parsePositiveInteger(input.maxProducts, DEFAULT_MAX_PRODUCTS, 1, 200000),
          maxShapeParts: parsePositiveInteger(input.maxShapeParts, DEFAULT_MAX_SHAPE_PARTS, 1, 64),
          importOnlyGeometryReady: parseImportPolicy(input.importPolicy) === "IMPORT_READY_ONLY",
          isDefault: Boolean(input.isDefault),
          createdById: auth.sub
        }
      });
    });

    await this.auditService.log({
      organizationId: auth.organizationId,
      userId: auth.sub,
      action: "imports.ifc4.profile.created",
      entityType: "ifc4_assistant_profile",
      entityId: created.id,
      metadata: { name: created.name }
    });

    return this.mapAssistantProfileDetail(created);
  }

  async updateAssistantProfile(auth: AuthenticatedUser, profileId: string, input: Parameters<Ifc4AssistantService["createAssistantProfile"]>[1]) {
    const existing = await this.getAssistantProfileOrThrow(auth.organizationId, profileId);
    const updated = await this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.ifc4AssistantProfile.updateMany({
          where: { organizationId: auth.organizationId, isDefault: true, id: { not: existing.id } },
          data: { isDefault: false }
        });
      }
      return tx.ifc4AssistantProfile.update({
        where: { id: existing.id },
        data: {
          name: input.name.trim(),
          description: input.description?.trim() || null,
          selectedClasses: parseSelectedClasses(input.selectedClasses) as unknown as Prisma.InputJsonValue,
          selectedProperties: parseStringList(input.selectedProperties) as unknown as Prisma.InputJsonValue,
          spatialMappings: input.spatialMappings ? input.spatialMappings as Prisma.InputJsonValue : Prisma.JsonNull,
          equipmentMappings: input.equipmentMappings ? normalizePropertyMappings(input.equipmentMappings) as unknown as Prisma.InputJsonValue : Prisma.JsonNull,
          assetReferenceOverrides: this.normalizeAssetReferenceOverrides(input.assetReferenceOverrides) as unknown as Prisma.InputJsonValue,
          spatialTypeOverrides: this.normalizeSpatialOverrides(input.spatialTypeOverrides) as unknown as Prisma.InputJsonValue,
          geometryLevel: parseGeometryLevel(input.geometryLevel),
          maxProducts: parsePositiveInteger(input.maxProducts, DEFAULT_MAX_PRODUCTS, 1, 200000),
          maxShapeParts: parsePositiveInteger(input.maxShapeParts, DEFAULT_MAX_SHAPE_PARTS, 1, 64),
          importOnlyGeometryReady: parseImportPolicy(input.importPolicy) === "IMPORT_READY_ONLY",
          isDefault: Boolean(input.isDefault)
        }
      });
    });

    await this.auditService.log({
      organizationId: auth.organizationId,
      userId: auth.sub,
      action: "imports.ifc4.profile.updated",
      entityType: "ifc4_assistant_profile",
      entityId: existing.id,
      metadata: { name: updated.name }
    });

    return this.mapAssistantProfileDetail(updated);
  }

  async archiveAssistantProfile(auth: AuthenticatedUser, profileId: string) {
    const profile = await this.getAssistantProfileOrThrow(auth.organizationId, profileId);
    const archived = await this.prisma.ifc4AssistantProfile.update({
      where: { id: profile.id },
      data: { isArchived: true, isDefault: false }
    });
    await this.auditService.log({
      organizationId: auth.organizationId,
      userId: auth.sub,
      action: "imports.ifc4.profile.archived",
      entityType: "ifc4_assistant_profile",
      entityId: profile.id,
      metadata: { name: profile.name }
    });
    return this.mapAssistantProfileDetail(archived);
  }

  async createSpatialJobFromAnalysis(
    auth: AuthenticatedUser,
    jobId: string,
    optionsInput?: AssistantOptionsInput
  ): Promise<Ifc4CreateJobResponse> {
    const job = await this.getAnalysisJobOrThrow(auth.organizationId, jobId);
    const artifact = await this.readAnalysisArtifact(auth.organizationId, jobId);
    const options = this.normalizeOptions(optionsInput);
    const diagnostics = await this.buildGeometryDiagnostics(auth.organizationId, artifact.analysis);
    if (artifact.analysis.profile?.geometryLevel !== "NONE" && options.importPolicy === "STRICT_ALL_READY") {
      this.assertGeometryReady(
        artifact.analysis.spatialNodes.map((node) => ({
          label: node.path,
          geometry: node.geometry ?? null
        }))
      );
    }
    const importablePaths = new Set(
      diagnostics.items
        .filter((item) => item.domain === "spatial" && item.importable)
        .map((item) => item.path)
        .filter((path): path is string => Boolean(path))
    );
    const excludedDiagnostics = diagnostics.items.filter((item) =>
      item.domain === "spatial" && (!item.importable || (options.importPolicy === "IMPORT_READY_ONLY" && item.path && !importablePaths.has(item.path)))
    );
    const rawSpatialRows = options.importPolicy === "IMPORT_READY_ONLY"
      ? artifact.spatialRows.filter((row) => typeof row.values.path === "string" && importablePaths.has(row.values.path))
      : artifact.spatialRows;
    const spatialRows = this.applySpatialOverrides(rawSpatialRows, this.parseSpatialOverrides(optionsInput));
    const sourcePath = this.sourcePathFromJob(job);
    const preparedJob = await this.importsService.createPreparedJob(auth, {
      targetDomain: "spatial-nodes",
      originalFilename: job.originalFilename ?? "source.ifc",
      storedMimeType: job.storedMimeType ?? "application/octet-stream",
      sourceFilePath: sourcePath,
      headers: SPATIAL_HEADERS,
      rawRows: spatialRows,
      mappings: buildMappings("spatial-nodes", SPATIAL_HEADERS),
      options: {
        sourceAssistant: "IFC4",
        sourceAnalysisJobId: job.id,
        importPolicy: options.importPolicy,
        ifcGeometryExcludedDiagnostics: excludedDiagnostics
      },
      selectedSheetName: "IFC4 spatial"
    });
    if (options.importPolicy === "IMPORT_READY_ONLY") {
      await this.appendJobLog(auth.organizationId, preparedJob.id, "WARNING", "geometry_exclusions", "Lignes spatial exclues du job IFC4", {
        excluded: excludedDiagnostics.length,
        imported: spatialRows.length
      });
    }
    return {
      job: preparedJob,
      rowsPrepared: spatialRows.length,
      warnings: artifact.warnings
    };
  }

  async createEquipmentsJobFromAnalysis(
    auth: AuthenticatedUser,
    jobId: string,
    optionsInput?: AssistantOptionsInput
  ): Promise<Ifc4CreateJobResponse> {
    const job = await this.getAnalysisJobOrThrow(auth.organizationId, jobId);
    const artifact = await this.readAnalysisArtifact(auth.organizationId, jobId);
    const options = this.normalizeOptions(optionsInput);
    const selectedClasses = new Set(options.selectedClasses ?? DEFAULT_SELECTED_CLASSES);
    const diagnostics = await this.buildGeometryDiagnostics(auth.organizationId, artifact.analysis);
    if (artifact.analysis.profile?.geometryLevel !== "NONE" && options.importPolicy === "STRICT_ALL_READY") {
      this.assertGeometryReady(
        artifact.analysis.equipmentRows
          .filter((row) => selectedClasses.has(row.sourceClass.toUpperCase()))
          .map((row) => ({
            label: row.internalCode,
            geometry: row.geometry ?? null
          }))
      );
    }
    const importableInternalCodes = new Set(
      analysisEquipmentRowsBySelection(artifact.analysis.equipmentRows, selectedClasses)
        .filter((row) => diagnostics.items.some((item) =>
          item.domain === "equipment"
          && item.importable
          && (item.globalId === row.sourceGlobalId || item.label === (row.label ?? row.internalCode))
        ))
        .map((row) => row.internalCode)
    );
    const excludedDiagnostics = diagnostics.items.filter((item) =>
      item.domain === "equipment"
      && selectedClasses.has(String(item.sourceClass ?? "").toUpperCase())
      && !item.importable
    );
    const rawRows = artifact.equipmentRawRows.filter((row) => {
      const internalCode = String(row.values.internalCode ?? "");
      const preview = artifact.analysis.equipmentRows.find((item) => item.internalCode === internalCode);
      if (preview && !selectedClasses.has(preview.sourceClass.toUpperCase())) return false;
      if (options.importPolicy !== "IMPORT_READY_ONLY") {
        return true;
      }
      return importableInternalCodes.has(internalCode);
    }).map((row, index) => buildRow(index + 2, Object.fromEntries(
      EQUIPMENT_HEADERS.map((header) => [header, row.values[header] ?? null])
    )));
    const sourcePath = this.sourcePathFromJob(job);
    const preparedJob = await this.importsService.createPreparedJob(auth, {
      targetDomain: "equipments",
      originalFilename: job.originalFilename ?? "source.ifc",
      storedMimeType: job.storedMimeType ?? "application/octet-stream",
      sourceFilePath: sourcePath,
      headers: EQUIPMENT_HEADERS,
      rawRows,
      mappings: buildMappings("equipments", EQUIPMENT_HEADERS),
      options: {
        sourceAssistant: "IFC4",
        sourceAnalysisJobId: job.id,
        selectedClasses: [...selectedClasses],
        importPolicy: options.importPolicy,
        ifcGeometryExcludedDiagnostics: excludedDiagnostics
      },
      selectedSheetName: "IFC4 equipments"
    });
    if (options.importPolicy === "IMPORT_READY_ONLY") {
      await this.appendJobLog(auth.organizationId, preparedJob.id, "WARNING", "geometry_exclusions", "Lignes equipements exclues du job IFC4", {
        excluded: excludedDiagnostics.length,
        imported: rawRows.length
      });
    }
    return {
      job: preparedJob,
      rowsPrepared: rawRows.length,
      warnings: artifact.warnings
    };
  }

  async applyAssetReferencesFromAnalysis(
    auth: AuthenticatedUser,
    jobId: string,
    optionsInput?: AssistantOptionsInput
  ): Promise<Ifc4AssetReferencesApplyResult> {
    const artifact = await this.readAnalysisArtifact(auth.organizationId, jobId);
    const result = await this.applyAssetReferenceCandidates(
      auth,
      artifact.analysis.assetReferences,
      this.parseAssetReferenceOverrides(optionsInput),
      artifact.analysis.filename
    );
    await this.persistAssetReferencesApplyResult(auth.organizationId, jobId, result);
    return result;
  }

  async getWorkflow(auth: AuthenticatedUser, jobId: string): Promise<Ifc4WorkflowResponse> {
    const analysisJob = await this.importsService.getJob(auth.organizationId, jobId);
    if (analysisJob.targetDomain !== "ifc4-analysis") {
      throw new NotFoundException("Job d analyse IFC4 introuvable");
    }

    const analysisLogs = await this.importsService.listJobLogs(auth.organizationId, jobId);
    const quickParse = await this.tryGetQuickParseResult(auth.organizationId, jobId);
    const analysis = await this.tryGetAnalysisResult(auth.organizationId, jobId);
    const spatial = await this.buildWorkflowChildState(auth.organizationId, jobId, "spatial");
    const equipments = await this.buildWorkflowChildState(auth.organizationId, jobId, "equipments");
    const candidates = analysis
      ? await this.refreshAssetReferenceCandidates(auth.organizationId, analysis.assetReferences)
      : [];
    const lastApplyResult = await this.readLastAssetReferencesApplyResult(auth.organizationId, jobId);

    return {
      analysisJob,
      analysisLogs,
      quickParse,
      analysis,
      spatial,
      assetReferences: {
        candidates,
        missingCount: candidates.filter((candidate) => !candidate.exists).length,
        existingCount: candidates.filter((candidate) => candidate.exists).length,
        lastApplyResult
      },
      equipments
    };
  }

  async runWorkflowChildAction(
    auth: AuthenticatedUser,
    jobId: string,
    domain: Ifc4WorkflowChildDomain,
    action: Ifc4WorkflowAction,
    input?: RunImportJobInput | AssistantOptionsInput
  ): Promise<Ifc4WorkflowActionResponse> {
    if (action === "cancel") {
      const child = await this.findWorkflowChildJob(auth.organizationId, jobId, domain);
      if (!child) {
        return {
          workflow: await this.getWorkflow(auth, jobId),
          action,
          domain,
          job: null,
          report: null,
          logs: []
        };
      }
      await this.appendJobLog(auth.organizationId, child.id, "WARNING", "cancel_requested", "Annulation demandee depuis l assistant IFC4", {
        domain
      });
      const cancelled = await this.importsService.cancelJob(auth, child.id);
      await this.appendJobLog(auth.organizationId, child.id, "WARNING", "cancelled", "Job enfant IFC4 annule", {
        domain
      });
      const logs = await this.importsService.listJobLogs(auth.organizationId, child.id);
      return {
        workflow: await this.getWorkflow(auth, jobId),
        action,
        domain,
        job: cancelled,
        report: cancelled.report,
        logs
      };
    }

    if (domain === "equipments" && action === "execute") {
      await this.assertEquipmentWorkflowPrerequisites(auth.organizationId, jobId);
    }

    const childJob = action === "preview"
      ? await this.createWorkflowChildJob(auth, jobId, domain, input as AssistantOptionsInput | undefined)
      : await this.ensureWorkflowChildJob(auth, jobId, domain, input as AssistantOptionsInput | undefined);
    await this.appendJobLog(auth.organizationId, childJob.id, "INFO", action, `Action ${action} lancee depuis l assistant IFC4`, {
      domain,
      analysisJobId: jobId
    });
    const runInput = this.toRunImportInput(input);
    const updated =
      action === "preview"
        ? await this.importsService.previewJob(auth, childJob.id, runInput)
        : action === "validate"
          ? await this.importsService.validateJob(auth, childJob.id, runInput)
          : await this.importsService.executeJob(auth, childJob.id, runInput);
    const updatedWithDiagnostics = await this.augmentJobReportWithGeometryExclusions(auth.organizationId, updated);
    await this.appendJobLog(auth.organizationId, childJob.id, "INFO", `${action}_completed`, `Action ${action} terminee`, {
      domain,
      rowsRead: updatedWithDiagnostics.report?.summary.rowsRead ?? null,
      rowsRejected: updatedWithDiagnostics.report?.summary.rowsRejected ?? null,
      appliedWrites: updatedWithDiagnostics.report?.summary.appliedWrites ?? null
    });
    const logs = await this.importsService.listJobLogs(auth.organizationId, childJob.id);
    return {
      workflow: await this.getWorkflow(auth, jobId),
      action,
      domain,
      job: updatedWithDiagnostics,
      report: updatedWithDiagnostics.report,
      logs
    };
  }

  private toRunImportInput(input?: RunImportJobInput | AssistantOptionsInput): RunImportJobDto | undefined {
    if (!input || typeof input !== "object") {
      return undefined;
    }
    const candidate = input as RunImportJobInput;
    if (candidate.profileId || candidate.overrideMappings || candidate.options) {
      return {
        profileId: candidate.profileId ?? undefined,
        overrideMappings: candidate.overrideMappings?.map((mapping) => ({
          ...mapping,
          transformConfig: mapping.transformConfig ?? undefined,
          matchPolicy: mapping.matchPolicy ?? undefined
        })),
        options: candidate.options ?? undefined
      };
    }
    return undefined;
  }

  private async tryGetQuickParseResult(organizationId: string, jobId: string) {
    try {
      return await this.getQuickParseResult(organizationId, jobId);
    } catch {
      return null;
    }
  }

  private async tryGetAnalysisResult(organizationId: string, jobId: string) {
    try {
      return await this.getAnalysisResult(organizationId, jobId);
    } catch {
      return null;
    }
  }

  private async buildWorkflowChildState(
    organizationId: string,
    analysisJobId: string,
    domain: Ifc4WorkflowChildDomain
  ) {
    const child = await this.findWorkflowChildJob(organizationId, analysisJobId, domain);
    if (!child) {
      return {
        job: null,
        logs: [],
        report: null
      };
    }
    const job = await this.importsService.getJob(organizationId, child.id);
    const logs = await this.importsService.listJobLogs(organizationId, child.id);
    return {
      job,
      logs,
      report: job.report
    };
  }

  private async augmentJobReportWithGeometryExclusions(organizationId: string, job: ImportJobDetail) {
    const options = this.readRecord(job.options);
    const excluded = parseJsonArray<Ifc4GeometryDiagnosticItem>(options.ifcGeometryExcludedDiagnostics);
    if (!job.report || excluded.length === 0) {
      return job;
    }
    const existingRejected = new Set(job.report.rows.filter((row) =>
      row.messages.some((message) => message.startsWith("IFC_GEOMETRY_EXCLUDED:"))
    ).map((row) => row.resolvedTargetKey ?? String(row.rowIndex)));
    const syntheticRows = excluded
      .filter((item) => !existingRejected.has(item.path ?? item.globalId ?? item.label))
      .map((item, index) => ({
        rowIndex: 900000 + index,
        status: "REJECTED" as const,
        resolvedTargetKey: item.path ?? item.globalId ?? item.label,
        normalizedValues: {
          domain: item.domain,
          label: item.label,
          path: item.path,
          parentPath: item.parentPath,
          sourceClass: item.sourceClass,
          globalId: item.globalId,
          geometryStatus: item.geometryStatus,
          geometryMessage: item.geometryMessage,
          reasonCode: item.reasonCode
        },
        messages: [
          `IFC_GEOMETRY_EXCLUDED:${item.reasonCode ?? "GEOMETRY_NOT_READY"}`,
          ...item.messages
        ]
      }));
    if (syntheticRows.length === 0) {
      return job;
    }
    const report: ImportJobReport = {
      ...job.report,
      summary: {
        ...job.report.summary,
        rowsRead: job.report.summary.rowsRead + syntheticRows.length,
        rowsRejected: job.report.summary.rowsRejected + syntheticRows.length
      },
      rows: [...job.report.rows, ...syntheticRows]
    };
    await this.prisma.importJob.update({
      where: { id: job.id },
      data: {
        summary: report.summary as unknown as Prisma.InputJsonValue,
        report: report as unknown as Prisma.InputJsonValue
      }
    });
    return this.importsService.getJob(organizationId, job.id);
  }

  private async findWorkflowChildJob(
    organizationId: string,
    analysisJobId: string,
    domain: Ifc4WorkflowChildDomain
  ) {
    const candidates = await this.prisma.importJob.findMany({
      where: {
        organizationId,
        targetDomain: IFC4_CHILD_DB_TARGET_BY_DOMAIN[domain]
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 50
    });
    return candidates.find((job) => {
      const options = this.readRecord(job.options);
      return options.sourceAssistant === "IFC4" && options.sourceAnalysisJobId === analysisJobId;
    }) ?? null;
  }

  private async ensureWorkflowChildJob(
    auth: AuthenticatedUser,
    analysisJobId: string,
    domain: Ifc4WorkflowChildDomain,
    input?: AssistantOptionsInput
  ): Promise<ImportJobDetail> {
    const existing = await this.findWorkflowChildJob(auth.organizationId, analysisJobId, domain);
    if (existing) {
      return this.importsService.getJob(auth.organizationId, existing.id);
    }
    return this.createWorkflowChildJob(auth, analysisJobId, domain, input);
  }

  private async createWorkflowChildJob(
    auth: AuthenticatedUser,
    analysisJobId: string,
    domain: Ifc4WorkflowChildDomain,
    input?: AssistantOptionsInput
  ): Promise<ImportJobDetail> {
    return domain === "spatial"
      ? (await this.createSpatialJobFromAnalysis(auth, analysisJobId, input)).job
      : (await this.createEquipmentsJobFromAnalysis(auth, analysisJobId, input)).job;
  }

  private async assertEquipmentWorkflowPrerequisites(organizationId: string, analysisJobId: string) {
    const spatial = await this.buildWorkflowChildState(organizationId, analysisJobId, "spatial");
    if (!spatial.job || spatial.job.status !== "COMPLETED") {
      throw new BadRequestException("Execute d abord l etape des noeuds spatiaux IFC4");
    }
    const spatialOptions = this.readRecord(spatial.job.options);
    const spatialPolicy = parseImportPolicy(spatialOptions.importPolicy);
    if ((spatial.report?.summary.rowsRejected ?? 0) > 0 && spatialPolicy !== "IMPORT_READY_ONLY") {
      throw new BadRequestException("Corrige les rejets spatial avant d importer les equipements");
    }
    const analysis = await this.tryGetAnalysisResult(organizationId, analysisJobId);
    if (!analysis) {
      throw new BadRequestException("L analyse IFC4 n est pas disponible");
    }
    const candidates = await this.refreshAssetReferenceCandidates(organizationId, analysis.assetReferences);
    if (candidates.some((candidate) => !candidate.exists)) {
      throw new BadRequestException("Cree d abord les referentiels assets manquants");
    }
  }

  private async refreshAssetReferenceCandidates(
    organizationId: string,
    candidates: Ifc4AssetReferenceCandidate[]
  ): Promise<Ifc4AssetReferenceCandidate[]> {
    const refreshed: Ifc4AssetReferenceCandidate[] = [];
    for (const candidate of candidates) {
      const existing = await this.findExistingReference(this.prisma, organizationId, candidate.resource, candidate.code);
      refreshed.push({
        ...candidate,
        exists: Boolean(existing)
      });
    }
    return refreshed;
  }

  private async persistAssetReferencesApplyResult(
    organizationId: string,
    analysisJobId: string,
    result: Ifc4AssetReferencesApplyResult
  ) {
    const job = await this.getAnalysisJobAnyStatusOrThrow(organizationId, analysisJobId);
    const currentOptions = this.readRecord(job.options);
    await this.prisma.importJob.update({
      where: { id: job.id },
      data: {
        options: {
          ...currentOptions,
          lastAssetReferencesApplyResult: result
        } as unknown as Prisma.InputJsonValue
      }
    });
  }

  private async readLastAssetReferencesApplyResult(
    organizationId: string,
    analysisJobId: string
  ): Promise<Ifc4AssetReferencesApplyResult | null> {
    const job = await this.getAnalysisJobAnyStatusOrThrow(organizationId, analysisJobId);
    const options = this.readRecord(job.options);
    const candidate = options.lastAssetReferencesApplyResult;
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return null;
    }
    const value = candidate as Partial<Ifc4AssetReferencesApplyResult>;
    return {
      created: Array.isArray(value.created) ? value.created as Ifc4AssetReferenceCandidate[] : [],
      existing: Array.isArray(value.existing) ? value.existing as Ifc4AssetReferenceCandidate[] : [],
      skipped: Array.isArray(value.skipped) ? value.skipped as Ifc4AssetReferenceCandidate[] : [],
      warnings: Array.isArray(value.warnings) ? value.warnings.map((item) => String(item)) : []
    };
  }

  private async getAssistantProfileOrThrow(organizationId: string, profileId: string) {
    const profile = await this.prisma.ifc4AssistantProfile.findFirst({
      where: { id: profileId, organizationId }
    });
    if (!profile) {
      throw new NotFoundException("IFC4 assistant profile not found");
    }
    return profile;
  }

  private mapAssistantProfileSummary(profile: {
    id: string;
    organizationId: string;
    name: string;
    description: string | null;
    selectedClasses: Prisma.JsonValue;
    selectedProperties: Prisma.JsonValue;
    geometryLevel: string;
    maxProducts: number;
    maxShapeParts: number;
    importOnlyGeometryReady: boolean;
    isDefault: boolean;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Ifc4AssistantProfileSummary {
    return {
      id: profile.id,
      organizationId: profile.organizationId,
      name: profile.name,
      description: profile.description,
      geometryLevel: parseGeometryLevel(profile.geometryLevel),
      maxProducts: profile.maxProducts,
      maxShapeParts: profile.maxShapeParts,
      importPolicy: profile.importOnlyGeometryReady ? "IMPORT_READY_ONLY" : "STRICT_ALL_READY",
      selectedClassesCount: parseSelectedClasses(profile.selectedClasses).length,
      selectedPropertiesCount: parseStringList(profile.selectedProperties).length,
      isDefault: profile.isDefault,
      isArchived: profile.isArchived,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString()
    };
  }

  private mapAssistantProfileDetail(profile: Parameters<Ifc4AssistantService["mapAssistantProfileSummary"]>[0] & {
    spatialMappings: Prisma.JsonValue | null;
    equipmentMappings: Prisma.JsonValue | null;
    assetReferenceOverrides: Prisma.JsonValue | null;
    spatialTypeOverrides: Prisma.JsonValue | null;
  }): Ifc4AssistantProfileDetail {
    return {
      ...this.mapAssistantProfileSummary(profile),
      selectedClasses: parseSelectedClasses(profile.selectedClasses),
      selectedProperties: parseStringList(profile.selectedProperties),
      spatialMappings: this.readRecord(profile.spatialMappings),
      equipmentMappings: normalizePropertyMappings(profile.equipmentMappings),
      assetReferenceOverrides: this.normalizeAssetReferenceOverrides(profile.assetReferenceOverrides),
      spatialTypeOverrides: this.normalizeSpatialOverrides(profile.spatialTypeOverrides)
    };
  }

  private normalizeSpatialOverrides(value: unknown): Ifc4SpatialOverride[] {
    return parseJsonArray<Ifc4SpatialOverride>(value)
      .filter((override) => typeof override.path === "string" && typeof override.type === "string")
      .map((override) => ({ path: override.path, type: normalizeCode(override.type, override.type) }));
  }

  private normalizeAssetReferenceOverrides(value: unknown): Ifc4AssetReferenceOverride[] {
    return parseJsonArray<Ifc4AssetReferenceOverride>(value)
      .filter((override) =>
        typeof override.resource === "string"
        && typeof override.code === "string"
        && typeof override.nextResource === "string"
      );
  }

  private async buildGeometryDiagnostics(
    organizationId: string,
    analysis: Ifc4AnalysisResponse
  ): Promise<Ifc4GeometryDiagnosticsResponse> {
    const existingSpatial = await this.prisma.spatialNode.findMany({
      where: {
        organizationId,
        path: {
          in: analysis.spatialNodes.map((node) => node.path)
        }
      },
      select: { path: true }
    });
    const existingPaths = new Set(existingSpatial.map((node) => node.path));
    const spatialByPath = new Map(analysis.spatialNodes.map((node) => [node.path, node]));
    const invalidSpatial = new Set<string>();
    const items: Ifc4GeometryDiagnosticItem[] = [];

    const isSpatialReady = (node: Ifc4SpatialPreviewNode) => {
      if (node.geometry?.geometryStatus !== "READY") {
        return false;
      }
      if (!node.parentPath || existingPaths.has(node.parentPath)) {
        return true;
      }
      const parent = spatialByPath.get(node.parentPath);
      return Boolean(parent && !invalidSpatial.has(parent.path) && parent.geometry?.geometryStatus === "READY");
    };

    for (const node of [...analysis.spatialNodes].sort((left, right) => pathDepth(left.path) - pathDepth(right.path))) {
      const messages: string[] = [];
      let status: Ifc4GeometryDiagnosticItem["status"] = isDerivedStoreyGeometry(node.geometry)
        ? "DERIVED"
        : node.geometry?.geometryStatus ?? "MISSING";
      let reasonCode: string | null = null;
      let importable = isSpatialReady(node);
      if (isDerivedStoreyGeometry(node.geometry)) {
        reasonCode = "STOREY_GEOMETRY_DERIVED";
        messages.push(node.geometry?.geometryMessage ?? "Geometrie d etage derivee depuis les enfants");
      } else if (isStoreyNode(node) && node.geometry?.geometryMetadata?.reasonCode === "STOREY_DERIVATION_FAILED") {
        reasonCode = "STOREY_DERIVATION_FAILED";
        messages.push(node.geometry?.geometryMessage ?? "Emprise d etage impossible a calculer depuis les enfants");
      } else if (node.geometry?.geometryStatus !== "READY") {
        reasonCode = node.geometry?.geometryStatus === "ERROR" ? "GEOMETRY_ERROR" : "GEOMETRY_MISSING";
        messages.push(node.geometry?.geometryMessage ?? "Geometrie IFC obligatoire absente");
      } else if (node.parentPath && !existingPaths.has(node.parentPath) && invalidSpatial.has(node.parentPath)) {
        status = "PARENT_INVALID";
        reasonCode = "PARENT_GEOMETRY_INVALID";
        importable = false;
        messages.push("Parent spatial invalide ou non importable");
      }
      if (!importable) {
        invalidSpatial.add(node.path);
      }
      items.push(this.buildGeometryDiagnosticItem({
        domain: "spatial",
        label: node.label,
        path: node.path,
        parentPath: node.parentPath,
        sourceClass: node.sourceClass,
        globalId: node.externalRef,
        geometry: node.geometry ?? null,
        status,
        importable,
        reasonCode,
        messages
      }));
    }

    for (const row of analysis.equipmentRows) {
      const messages: string[] = [];
      let status: Ifc4GeometryDiagnosticItem["status"] = row.geometry?.geometryStatus ?? "MISSING";
      let reasonCode: string | null = null;
      let importable = row.geometry?.geometryStatus === "READY";
      if (row.geometry?.geometryStatus !== "READY") {
        reasonCode = row.geometry?.geometryStatus === "ERROR" ? "GEOMETRY_ERROR" : "GEOMETRY_MISSING";
        messages.push(row.geometry?.geometryMessage ?? "Geometrie IFC obligatoire absente");
      }
      if (row.currentSpatialPath && invalidSpatial.has(row.currentSpatialPath)) {
        status = "SPATIAL_TARGET_INVALID";
        reasonCode = "SPATIAL_TARGET_INVALID";
        importable = false;
        messages.push("Noeud spatial cible invalide ou non importable");
      }
      if (!row.currentSpatialPath) {
        status = "SPATIAL_TARGET_INVALID";
        reasonCode = "SPATIAL_TARGET_MISSING";
        importable = false;
        messages.push("Noeud spatial cible absent");
      }
      items.push(this.buildGeometryDiagnosticItem({
        domain: "equipment",
        label: row.label ?? row.internalCode,
        path: row.currentSpatialPath,
        parentPath: null,
        sourceClass: row.sourceClass,
        globalId: row.sourceGlobalId,
        geometry: row.geometry ?? null,
        status,
        importable,
        reasonCode,
        messages
      }));
    }

    return {
      summary: {
        total: items.length,
        ready: items.filter((item) => item.geometryStatus === "READY").length,
        missing: items.filter((item) => item.geometryStatus === "MISSING").length,
        errors: items.filter((item) => item.geometryStatus === "ERROR").length,
        derivedStoreys: items.filter((item) => item.status === "DERIVED").length,
        blockedByParent: items.filter((item) => item.status === "PARENT_INVALID").length,
        blockedBySpatialTarget: items.filter((item) => item.status === "SPATIAL_TARGET_INVALID").length,
        importable: items.filter((item) => item.importable).length,
        excluded: items.filter((item) => !item.importable).length
      },
      items
    };
  }

  private buildGeometryDiagnosticItem(input: {
    domain: "spatial" | "equipment";
    label: string;
    path: string | null;
    parentPath: string | null;
    sourceClass: string | null;
    globalId: string | null;
    geometry: Ifc4GeometryPreview | null;
    status: Ifc4GeometryDiagnosticItem["status"];
    importable: boolean;
    reasonCode: string | null;
    messages: string[];
  }): Ifc4GeometryDiagnosticItem {
    return {
      domain: input.domain,
      status: input.status,
      importable: input.importable,
      reasonCode: input.reasonCode,
      label: input.label,
      path: input.path,
      parentPath: input.parentPath,
      sourceClass: input.sourceClass,
      globalId: input.globalId ?? (String(geometryMetadataValue(input.geometry, "globalId") ?? "") || null),
      ifcEntityId: geometryMetadataValue(input.geometry, "ifcEntityId") as string | number | null,
      geometryStatus: input.geometry?.geometryStatus ?? null,
      geometryMessage: input.geometry?.geometryMessage ?? null,
      worldSize: input.geometry?.worldSize ?? null,
      worldBbox: input.geometry?.worldBbox ?? null,
      messages: input.messages.length > 0 ? input.messages : input.importable ? ["Importable"] : ["Non importable"]
    };
  }

  private async persistBufferedIfc(
    organizationId: string,
    jobId: string,
    file: UploadedIfcFile
  ) {
    const directory = await mkdtemp(join(tmpdir(), "inventory-ifc-upload-"));
    const inputPath = join(directory, file.originalname.replace(/[^a-zA-Z0-9._-]+/g, "-") || "source.ifc");
    try {
      await writeFile(inputPath, file.buffer ?? Buffer.from(""));
      return persistImportSourcePath(organizationId, jobId, file.originalname, inputPath);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  private async buildQuickParseResult(
    organizationId: string,
    jobId: string,
    originalFilename: string,
    sourcePath: string,
    options: AssistantOptions
  ): Promise<Ifc4QuickParseArtifact> {
    const artifactDirectory = join(sourcePath, "..");
    const text = await readFile(sourcePath, "utf8");
    const parsed = this.parseIfc(text);
    const classSummary = this.buildClassSummary(parsed.entities);
    const productProperties = this.buildProperties(parsed.entities);
    const products = this.buildProducts(parsed.entities, productProperties, options.selectedProperties);
    const propertyCandidates = this.buildPropertyCandidates(products, options);
    const selectedClasses = new Set(options.selectedClasses ?? DEFAULT_SELECTED_CLASSES);
    const candidateProducts = classSummary
      .filter((item) => selectedClasses.has(item.sourceClass))
      .reduce((sum, item) => sum + item.count, 0);
    const spatialCount = classSummary
      .filter((item) => ["IFCSITE", "IFCBUILDING", "IFCBUILDINGSTOREY", "IFCSPACE"].includes(item.sourceClass))
      .reduce((sum, item) => sum + item.count, 0);
    const metadataLines = [...parsed.entities.values()]
      .filter((entity) => entity.type.startsWith("IFC"))
      .map((entity) => JSON.stringify({
        id: entity.id,
        sourceClass: entity.type,
        globalId: readString(entity.args[0]),
        name: readString(entity.args[2])
      }));
    await writeFile(join(artifactDirectory, "ifc4-metadata.ndjson"), metadataLines.join("\n"), "utf8");
    const classSummaryArtifact = await persistImportArtifact(organizationId, jobId, "ifc4-class-summary.json", classSummary);
    const summaryArtifact = await persistImportArtifact(organizationId, jobId, "ifc4-analysis-summary.json", {
      filename: originalFilename,
      schema: parsed.schema,
      totalEntities: parsed.entities.size,
      spatialCount,
      candidateProducts
    });
    await this.appendJobLog(organizationId, jobId, "INFO", "class_summary", "Classes IFC detectees", {
      classes: classSummary.length,
      candidateProducts
    });
    return {
      filename: originalFilename,
      schema: parsed.schema,
      classSummary,
      propertyCandidates,
      profileDefaults: this.buildProfile(options),
      metadataSummary: {
        totalEntities: parsed.entities.size,
        spatialCount,
        candidateProducts
      },
      artifactRefs: {
        classSummaryJson: classSummaryArtifact.relativePath,
        metadataNdjson: "ifc4-metadata.ndjson",
        summaryJson: summaryArtifact.relativePath
      }
    };
  }

  private async resumeRunningAnalysisJobs() {
    const jobs = await this.prisma.importJob.findMany({
      where: {
        targetDomain: "IFC4_ANALYSIS",
        status: "RUNNING"
      },
      select: {
        id: true
      }
    });
    for (const job of jobs) {
      await this.appendJobLogByJobId(job.id, "WARNING", "resume", "Reprise du job IFC4 apres redemarrage API");
      this.enqueueAnalysisJob(job.id);
    }
  }

  private analysisConcurrency() {
    return parsePositiveInteger(process.env.IFC_JOB_CONCURRENCY, 1, 1, 8);
  }

  private enqueueAnalysisJob(jobId: string) {
    if (!this.analysisQueue.includes(jobId)) {
      this.analysisQueue.push(jobId);
    }
    void this.processAnalysisQueue();
  }

  private async processAnalysisQueue() {
    while (this.activeAnalysisJobs < this.analysisConcurrency() && this.analysisQueue.length > 0) {
      const jobId = this.analysisQueue.shift();
      if (!jobId) {
        return;
      }
      this.activeAnalysisJobs += 1;
      void this.runAnalysisJob(jobId)
        .catch((error) => this.logger.error(`IFC analysis queue job failed jobId=${jobId} error=${error instanceof Error ? error.message : String(error)}`))
        .finally(() => {
          this.activeAnalysisJobs -= 1;
          void this.processAnalysisQueue();
        });
    }
  }

  private async runAnalysisJob(jobId: string) {
    const job = await this.prisma.importJob.findUnique({
      where: { id: jobId }
    });
    if (!job || job.targetDomain !== "IFC4_ANALYSIS") {
      return;
    }
    if (job.status === "CANCELLED") {
      return;
    }
    if (job.status !== "RUNNING") {
      return;
    }
    if (!job.storedFileRef) {
      await this.failAnalysisJob(job, "Fichier source IFC introuvable", { code: "IFC_SOURCE_MISSING" });
      return;
    }

    const options = this.readAssistantOptions(job.options);
    const sourcePath = resolveImportArtifact(job.storedFileRef);
    const artifactDirectory = join(resolveImportArtifact(job.storedFileRef), "..");
    const outputPath = join(artifactDirectory, "ifcopenshell-extract.v1.json");
    const metadataOutputPath = join(artifactDirectory, "ifc4-metadata.ndjson");
    const geometryOutputPath = join(artifactDirectory, "ifc4-geometry.ndjson");

    try {
      await this.prisma.importJob.update({
        where: { id: job.id },
        data: {
          status: "RUNNING",
          startedAt: job.startedAt ?? new Date(),
          completedAt: null
        }
      });
      await this.appendJobLog(job.organizationId, job.id, "INFO", "started", "Demarrage de l analyse IFC4", {
        filename: job.originalFilename,
        profile: this.buildProfile(options)
      });

      const prepared = await this.prepareFromFilePath(
        job.organizationId,
        job.originalFilename ?? "source.ifc",
        sourcePath,
        outputPath,
        metadataOutputPath,
        geometryOutputPath,
        options,
        job.id,
        (entry) => this.appendJobLog(job.organizationId, job.id, entry.level, entry.step, entry.message, entry.metadata ?? null)
      );
      if (await this.isAnalysisJobCancelled(job.id)) {
        return;
      }
      const analysis = this.buildAnalysisResponse(job.originalFilename ?? "source.ifc", prepared);
      const artifact: Ifc4AnalysisArtifact = {
        analysis,
        spatialRows: prepared.spatialRows,
        equipmentRawRows: prepared.equipmentRawRows,
        warnings: prepared.warnings
      };
      const storedArtifact = await persistImportArtifact(job.organizationId, job.id, "ifc4-analysis-result.json", artifact);
      await this.prisma.importJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          summary: {
            rowsRead: prepared.totalEntities,
            rowsValid: (prepared.geometrySummary?.ready ?? 0),
            rowsRejected: (prepared.geometrySummary?.missing ?? 0) + (prepared.geometrySummary?.errors ?? 0),
            rowsWithWarnings: prepared.warnings.length,
            simulatedWrites: 0,
            appliedWrites: 0,
            executionMode: "PREVIEW",
            targetDomain: "ifc4-analysis"
          } as unknown as Prisma.InputJsonValue,
          report: {
            kind: "IFC4_ANALYSIS",
            resultRef: storedArtifact.relativePath,
            filename: job.originalFilename,
            schema: prepared.schema,
            spatialNodes: prepared.spatialNodes.length,
            equipmentRows: prepared.equipmentRows.length,
            artifactRefs: prepared.artifactRefs
          } as unknown as Prisma.InputJsonValue,
          completedAt: new Date()
        }
      });
      await this.appendJobLog(job.organizationId, job.id, "INFO", "completed", "Analyse IFC4 terminee", {
        spatialNodes: prepared.spatialNodes.length,
        equipmentRows: prepared.equipmentRows.length
      });
    } catch (error) {
      if (await this.isAnalysisJobCancelled(job.id)) {
        return;
      }
      const message = error instanceof Error ? error.message : "Erreur analyse IFC4";
      if (message.toLowerCase().includes("cancelled")) {
        await this.markAnalysisJobCancelled(job.id, job.organizationId, false);
        return;
      }
      await this.failAnalysisJob(job, message, {
        code: this.resolveGeometryErrorCode(message)
      });
    }
  }

  private async isAnalysisJobCancelled(jobId: string) {
    const job = await this.prisma.importJob.findUnique({
      where: { id: jobId },
      select: { status: true }
    });
    return job?.status === "CANCELLED";
  }

  private async markAnalysisJobCancelled(jobId: string, organizationId: string, killedProcess: boolean) {
    await this.prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: "CANCELLED",
        completedAt: new Date()
      }
    });
    await this.appendJobLog(organizationId, jobId, "WARNING", "cancelled", "Analyse IFC4 annulee", {
      killedProcess
    });
  }

  private async failAnalysisJob(
    job: { id: string; organizationId: string },
    message: string,
    metadata: Record<string, unknown>
  ) {
    if (await this.isAnalysisJobCancelled(job.id)) {
      return;
    }
    await this.appendJobLog(job.organizationId, job.id, "ERROR", "failed", message, metadata);
    await this.prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        summary: {
          rowsRead: 0,
          rowsValid: 0,
          rowsRejected: 1,
          rowsWithWarnings: 0,
          simulatedWrites: 0,
          appliedWrites: 0,
          executionMode: "PREVIEW",
          targetDomain: "ifc4-analysis"
        } as unknown as Prisma.InputJsonValue,
        report: {
          kind: "IFC4_ANALYSIS",
          error: message,
          ...metadata
        } as unknown as Prisma.InputJsonValue,
        completedAt: new Date()
      }
    });
  }

  private async appendJobLogByJobId(
    jobId: string,
    level: "DEBUG" | "INFO" | "WARNING" | "ERROR",
    step: string | null,
    message: string,
    metadata?: Record<string, unknown> | null
  ) {
    const job = await this.prisma.importJob.findUnique({
      where: { id: jobId },
      select: { organizationId: true }
    });
    if (!job) {
      return;
    }
    await this.appendJobLog(job.organizationId, jobId, level, step, message, metadata);
  }

  private async appendJobLog(
    organizationId: string,
    jobId: string,
    level: "DEBUG" | "INFO" | "WARNING" | "ERROR",
    step: string | null,
    message: string,
    metadata?: Record<string, unknown> | null
  ) {
    await this.prisma.importJobLog.create({
      data: {
        organizationId,
        jobId,
        level,
        step,
        message,
        metadata: metadata ? metadata as Prisma.InputJsonValue : Prisma.JsonNull
      }
    });
  }

  private async getAnalysisJobOrThrow(organizationId: string, jobId: string) {
    const job = await this.prisma.importJob.findFirst({
      where: {
        id: jobId,
        organizationId,
        targetDomain: "IFC4_ANALYSIS"
      }
    });
    if (!job) {
      throw new NotFoundException("Job d analyse IFC4 introuvable");
    }
    if (job.status !== "COMPLETED") {
      throw new BadRequestException("Le job d analyse IFC4 n est pas termine");
    }
    return job;
  }

  private async getAnalysisJobAnyStatusOrThrow(organizationId: string, jobId: string) {
    const job = await this.prisma.importJob.findFirst({
      where: {
        id: jobId,
        organizationId,
        targetDomain: "IFC4_ANALYSIS"
      }
    });
    if (!job) {
      throw new NotFoundException("Job d analyse IFC4 introuvable");
    }
    return job;
  }

  private async readAnalysisArtifact(organizationId: string, jobId: string) {
    const job = await this.getAnalysisJobOrThrow(organizationId, jobId);
    const report = this.readRecord(job.report);
    const resultRef = typeof report.resultRef === "string" ? report.resultRef : null;
    if (!resultRef) {
      throw new NotFoundException("Resultat d analyse IFC4 introuvable");
    }
    return readImportArtifact<Ifc4AnalysisArtifact>(resultRef);
  }

  private sourcePathFromJob(job: { storedFileRef: string | null }) {
    if (!job.storedFileRef) {
      throw new NotFoundException("Fichier source IFC introuvable");
    }
    return resolveImportArtifact(job.storedFileRef);
  }

  private readRecord(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  }

  private readAssistantOptions(value: unknown): AssistantOptions {
    const options = this.readRecord(value);
    const stored = this.readRecord(options.assistantOptions);
    if ("propertyMappings" in stored) {
      return {
        selectedClasses: Array.isArray(stored.selectedClasses)
          ? stored.selectedClasses.map((item) => String(item)).filter(Boolean)
          : DEFAULT_SELECTED_CLASSES,
        selectedProperties: parseStringList(stored.selectedProperties),
        defaultStatusCode: normalizeCode(normalizeFreeText(stored.defaultStatusCode), DEFAULT_STATUS_CODE),
        defaultOwnerEntityCode: normalizeCode(normalizeFreeText(stored.defaultOwnerEntityCode), DEFAULT_OWNER_CODE),
        maxProducts: parsePositiveInteger(stored.maxProducts, DEFAULT_MAX_PRODUCTS, 1, 200000),
        geometryLevel: parseGeometryLevel(stored.geometryLevel),
        maxShapeParts: parsePositiveInteger(stored.maxShapeParts, DEFAULT_MAX_SHAPE_PARTS, 1, 64),
        importPolicy: parseImportPolicy(stored.importPolicy),
        propertyMappings: normalizePropertyMappings(stored.propertyMappings)
      };
    }
    return this.normalizeOptions(stored);
  }

  private buildProfile(options: AssistantOptions): Ifc4AnalysisProfile {
    return {
      maxProducts: options.maxProducts,
      selectedClasses: options.selectedClasses ?? DEFAULT_SELECTED_CLASSES,
      selectedProperties: options.selectedProperties,
      geometryLevel: options.geometryLevel,
      maxShapeParts: options.maxShapeParts,
      importPolicy: options.importPolicy
    };
  }

  private resolveGeometryErrorCode(message: string) {
    const lowerMessage = message.toLowerCase();
    return lowerMessage.includes("no module named") || lowerMessage.includes("modulenotfounderror")
      ? "IFC_GEOMETRY_ENGINE_UNAVAILABLE"
      : "IFC_GEOMETRY_EXTRACTION_FAILED";
  }

  async analyze(
    auth: AuthenticatedUser,
    file: { originalname: string; buffer: Buffer } | undefined,
    optionsInput?: AssistantOptionsInput
  ): Promise<Ifc4AnalysisResponse> {
    const prepared = await this.prepare(auth.organizationId, file, this.normalizeOptions(optionsInput));
    return this.buildAnalysisResponse(file?.originalname ?? "source.ifc", prepared);
  }

  async createSpatialJob(
    auth: AuthenticatedUser,
    file: { originalname: string; mimetype: string; buffer: Buffer } | undefined,
    optionsInput?: AssistantOptionsInput
  ): Promise<Ifc4CreateJobResponse> {
    const options = this.normalizeOptions(optionsInput);
    const prepared = await this.prepare(auth.organizationId, file, options);
    const analysis = this.buildAnalysisResponse(file?.originalname ?? "source.ifc", prepared);
    const diagnostics = await this.buildGeometryDiagnostics(auth.organizationId, analysis);
    if (options.importPolicy === "STRICT_ALL_READY") {
      this.assertGeometryReady(
        prepared.spatialNodes.map((node) => ({
          label: node.path,
          geometry: node.geometry ?? null
        }))
      );
    }
    const importablePaths = new Set(diagnostics.items.filter((item) => item.domain === "spatial" && item.importable).map((item) => item.path));
    const rawRows = options.importPolicy === "IMPORT_READY_ONLY"
      ? prepared.spatialRows.filter((row) => typeof row.values.path === "string" && importablePaths.has(row.values.path))
      : prepared.spatialRows;
    const spatialRows = this.applySpatialOverrides(rawRows, this.parseSpatialOverrides(optionsInput));
    const job = await this.importsService.createPreparedJob(auth, {
      targetDomain: "spatial-nodes",
      originalFilename: file?.originalname ?? "source.ifc",
      storedMimeType: file?.mimetype ?? "application/octet-stream",
      sourceBuffer: file?.buffer ?? Buffer.from(""),
      headers: SPATIAL_HEADERS,
      rawRows: spatialRows,
      mappings: buildMappings("spatial-nodes", SPATIAL_HEADERS),
      options: {
        sourceAssistant: "IFC4",
        importPolicy: options.importPolicy,
        ifcGeometryExcludedDiagnostics: diagnostics.items.filter((item) => item.domain === "spatial" && !item.importable)
      },
      selectedSheetName: "IFC4 spatial"
    });
    return {
      job,
      rowsPrepared: spatialRows.length,
      warnings: prepared.warnings
    };
  }

  async createEquipmentsJob(
    auth: AuthenticatedUser,
    file: { originalname: string; mimetype: string; buffer: Buffer } | undefined,
    optionsInput?: AssistantOptionsInput
  ): Promise<Ifc4CreateJobResponse> {
    const options = this.normalizeOptions(optionsInput);
    const prepared = await this.prepare(auth.organizationId, file, options);
    const analysis = this.buildAnalysisResponse(file?.originalname ?? "source.ifc", prepared);
    const diagnostics = await this.buildGeometryDiagnostics(auth.organizationId, analysis);
    const selectedClasses = new Set(options.selectedClasses ?? DEFAULT_SELECTED_CLASSES);
    if (options.importPolicy === "STRICT_ALL_READY") {
      this.assertGeometryReady(
        prepared.equipmentRows
          .filter((row) => selectedClasses.has(row.sourceClass.toUpperCase()))
          .map((row) => ({
            label: row.internalCode,
            geometry: row.geometry ?? null
          }))
      );
    }
    const importableInternalCodes = new Set(
      prepared.equipmentRows
        .filter((row) => selectedClasses.has(row.sourceClass.toUpperCase()))
        .filter((row) => diagnostics.items.some((item) =>
          item.domain === "equipment"
          && item.importable
          && (item.globalId === row.sourceGlobalId || item.label === (row.label ?? row.internalCode))
        ))
        .map((row) => row.internalCode)
    );
    const rawRows = prepared.equipmentRawRows.filter((row) => {
      const internalCode = String(row.values.internalCode ?? "");
      const preview = prepared.equipmentRows.find((item) => item.internalCode === internalCode);
      if (preview && !selectedClasses.has(preview.sourceClass.toUpperCase())) return false;
      return options.importPolicy === "IMPORT_READY_ONLY" ? importableInternalCodes.has(internalCode) : true;
    }).map((row, index) => buildRow(index + 2, Object.fromEntries(
      EQUIPMENT_HEADERS.map((header) => [header, row.values[header] ?? null])
    )));
    const job = await this.importsService.createPreparedJob(auth, {
      targetDomain: "equipments",
      originalFilename: file?.originalname ?? "source.ifc",
      storedMimeType: file?.mimetype ?? "application/octet-stream",
      sourceBuffer: file?.buffer ?? Buffer.from(""),
      headers: EQUIPMENT_HEADERS,
      rawRows,
      mappings: buildMappings("equipments", EQUIPMENT_HEADERS),
      options: {
        sourceAssistant: "IFC4",
        selectedClasses: [...selectedClasses],
        importPolicy: options.importPolicy,
        ifcGeometryExcludedDiagnostics: diagnostics.items.filter((item) =>
          item.domain === "equipment"
          && selectedClasses.has(String(item.sourceClass ?? "").toUpperCase())
          && !item.importable
        )
      },
      selectedSheetName: "IFC4 equipments"
    });
    return {
      job,
      rowsPrepared: rawRows.length,
      warnings: prepared.warnings
    };
  }

  async previewAssetReferences(
    auth: AuthenticatedUser,
    file: { originalname: string; buffer: Buffer } | undefined,
    optionsInput?: AssistantOptionsInput
  ) {
    const prepared = await this.prepare(auth.organizationId, file, this.normalizeOptions(optionsInput));
    return {
      references: prepared.assetReferenceCandidates,
      warnings: prepared.warnings
    };
  }

  async applyAssetReferences(
    auth: AuthenticatedUser,
    file: { originalname: string; buffer: Buffer } | undefined,
    optionsInput?: AssistantOptionsInput
  ): Promise<Ifc4AssetReferencesApplyResult> {
    const prepared = await this.prepare(auth.organizationId, file, this.normalizeOptions(optionsInput));
    const candidates = this.applyAssetReferenceOverrides(
      prepared.assetReferenceCandidates,
      this.parseAssetReferenceOverrides(optionsInput)
    );
    const created: Ifc4AssetReferenceCandidate[] = [];
    const existing: Ifc4AssetReferenceCandidate[] = [];
    const skipped: Ifc4AssetReferenceCandidate[] = [];

    await this.prisma.$transaction(async (tx) => {
      const category = await this.ensureCategory(tx, auth.organizationId, candidates, created, existing);
      const family = await this.ensureFamily(tx, auth.organizationId, category.id, candidates, created, existing);
      const subfamily = await this.ensureSubfamily(tx, auth.organizationId, family.id, candidates, created, existing);
      const brandByCode = new Map<string, string>();

      for (const candidate of candidates) {
        const existingRecord = await this.findExistingReference(tx, auth.organizationId, candidate.resource, candidate.code);
        if (existingRecord) {
          existing.push({
            ...candidate,
            exists: true
          });
          if (candidate.resource === "brands") {
            brandByCode.set(candidate.code, existingRecord.id);
          }
          continue;
        }

        if (candidate.resource === "types") {
          const targetSubfamily = candidate.parentCode
            ? await tx.equipmentSubfamily.findFirst({
                where: { organizationId: auth.organizationId, code: candidate.parentCode },
                select: { id: true }
              })
            : null;
          await tx.equipmentType.create({
            data: {
              organizationId: auth.organizationId,
              subfamilyId: targetSubfamily?.id ?? subfamily.id,
              code: candidate.code,
              label: candidate.label,
              description: "Cree depuis assistant IFC4"
            }
          });
          created.push(candidate);
          continue;
        }

        if (candidate.resource === "categories") {
          await tx.equipmentCategory.create({
            data: {
              organizationId: auth.organizationId,
              code: candidate.code,
              label: candidate.label,
              description: "Cree depuis assistant IFC4"
            }
          });
          created.push(candidate);
          continue;
        }

        if (candidate.resource === "families") {
          const targetCategory = candidate.parentCode
            ? await tx.equipmentCategory.findFirst({
                where: { organizationId: auth.organizationId, code: candidate.parentCode },
                select: { id: true }
              })
            : null;
          await tx.equipmentFamily.create({
            data: {
              organizationId: auth.organizationId,
              categoryId: targetCategory?.id ?? category.id,
              code: candidate.code,
              label: candidate.label,
              description: "Cree depuis assistant IFC4"
            }
          });
          created.push(candidate);
          continue;
        }

        if (candidate.resource === "subfamilies") {
          const targetFamily = candidate.parentCode
            ? await tx.equipmentFamily.findFirst({
                where: { organizationId: auth.organizationId, code: candidate.parentCode },
                select: { id: true }
              })
            : null;
          await tx.equipmentSubfamily.create({
            data: {
              organizationId: auth.organizationId,
              familyId: targetFamily?.id ?? family.id,
              code: candidate.code,
              label: candidate.label,
              description: "Cree depuis assistant IFC4"
            }
          });
          created.push(candidate);
          continue;
        }

        if (candidate.resource === "brands") {
          const brand = await tx.equipmentBrand.create({
            data: {
              organizationId: auth.organizationId,
              code: candidate.code,
              label: candidate.label,
              description: "Cree depuis assistant IFC4"
            },
            select: { id: true }
          });
          brandByCode.set(candidate.code, brand.id);
          created.push(candidate);
          continue;
        }

        if (candidate.resource === "models") {
          const brandId = candidate.parentCode ? brandByCode.get(candidate.parentCode) : null;
          if (!brandId) {
            skipped.push(candidate);
            continue;
          }
          await tx.equipmentModel.create({
            data: {
              organizationId: auth.organizationId,
              brandId,
              code: candidate.code,
              label: candidate.label,
              description: "Cree depuis assistant IFC4"
            }
          });
          created.push(candidate);
          continue;
        }

        if (candidate.resource === "statuses") {
          await tx.equipmentStatus.create({
            data: {
              organizationId: auth.organizationId,
              code: candidate.code,
              label: candidate.label,
              description: "Cree depuis assistant IFC4"
            }
          });
          created.push(candidate);
          continue;
        }

        if (candidate.resource === "owners") {
          await tx.ownerEntity.create({
            data: {
              organizationId: auth.organizationId,
              code: candidate.code,
              label: candidate.label,
              description: "Cree depuis assistant IFC4"
            }
          });
          created.push(candidate);
        }
      }
    });

    await this.auditService.log({
      organizationId: auth.organizationId,
      userId: auth.sub,
      action: "imports.ifc4.asset-references.applied",
      entityType: "asset_reference",
      metadata: {
        created: created.length,
        skipped: skipped.length,
        filename: file?.originalname ?? null
      }
    });

    return {
      created,
      existing,
      skipped,
      warnings: prepared.warnings
    };
  }

  private async applyAssetReferenceCandidates(
    auth: AuthenticatedUser,
    sourceCandidates: Ifc4AssetReferenceCandidate[],
    overrides: Ifc4AssetReferenceOverride[],
    filename: string | null
  ): Promise<Ifc4AssetReferencesApplyResult> {
    const candidates = this.applyAssetReferenceOverrides(sourceCandidates, overrides);
    const created: Ifc4AssetReferenceCandidate[] = [];
    const existing: Ifc4AssetReferenceCandidate[] = [];
    const skipped: Ifc4AssetReferenceCandidate[] = [];

    await this.prisma.$transaction(async (tx) => {
      const category = await this.ensureCategory(tx, auth.organizationId, candidates, created, existing);
      const family = await this.ensureFamily(tx, auth.organizationId, category.id, candidates, created, existing);
      const subfamily = await this.ensureSubfamily(tx, auth.organizationId, family.id, candidates, created, existing);
      const brandByCode = new Map<string, string>();

      for (const candidate of candidates) {
        const existingRecord = await this.findExistingReference(tx, auth.organizationId, candidate.resource, candidate.code);
        if (existingRecord) {
          existing.push({
            ...candidate,
            exists: true
          });
          if (candidate.resource === "brands") {
            brandByCode.set(candidate.code, existingRecord.id);
          }
          continue;
        }

        if (candidate.resource === "types") {
          const targetSubfamily = candidate.parentCode
            ? await tx.equipmentSubfamily.findFirst({
                where: { organizationId: auth.organizationId, code: candidate.parentCode },
                select: { id: true }
              })
            : null;
          await tx.equipmentType.create({
            data: {
              organizationId: auth.organizationId,
              subfamilyId: targetSubfamily?.id ?? subfamily.id,
              code: candidate.code,
              label: candidate.label,
              description: "Cree depuis assistant IFC4"
            }
          });
          created.push(candidate);
          continue;
        }

        if (candidate.resource === "categories") {
          await tx.equipmentCategory.create({
            data: {
              organizationId: auth.organizationId,
              code: candidate.code,
              label: candidate.label,
              description: "Cree depuis assistant IFC4"
            }
          });
          created.push(candidate);
          continue;
        }

        if (candidate.resource === "families") {
          const targetCategory = candidate.parentCode
            ? await tx.equipmentCategory.findFirst({
                where: { organizationId: auth.organizationId, code: candidate.parentCode },
                select: { id: true }
              })
            : null;
          await tx.equipmentFamily.create({
            data: {
              organizationId: auth.organizationId,
              categoryId: targetCategory?.id ?? category.id,
              code: candidate.code,
              label: candidate.label,
              description: "Cree depuis assistant IFC4"
            }
          });
          created.push(candidate);
          continue;
        }

        if (candidate.resource === "subfamilies") {
          const targetFamily = candidate.parentCode
            ? await tx.equipmentFamily.findFirst({
                where: { organizationId: auth.organizationId, code: candidate.parentCode },
                select: { id: true }
              })
            : null;
          await tx.equipmentSubfamily.create({
            data: {
              organizationId: auth.organizationId,
              familyId: targetFamily?.id ?? family.id,
              code: candidate.code,
              label: candidate.label,
              description: "Cree depuis assistant IFC4"
            }
          });
          created.push(candidate);
          continue;
        }

        if (candidate.resource === "brands") {
          const brand = await tx.equipmentBrand.create({
            data: {
              organizationId: auth.organizationId,
              code: candidate.code,
              label: candidate.label,
              description: "Cree depuis assistant IFC4"
            },
            select: { id: true }
          });
          brandByCode.set(candidate.code, brand.id);
          created.push(candidate);
          continue;
        }

        if (candidate.resource === "models") {
          const brandId = candidate.parentCode ? brandByCode.get(candidate.parentCode) : null;
          if (!brandId) {
            skipped.push(candidate);
            continue;
          }
          await tx.equipmentModel.create({
            data: {
              organizationId: auth.organizationId,
              brandId,
              code: candidate.code,
              label: candidate.label,
              description: "Cree depuis assistant IFC4"
            }
          });
          created.push(candidate);
          continue;
        }

        if (candidate.resource === "statuses") {
          await tx.equipmentStatus.create({
            data: {
              organizationId: auth.organizationId,
              code: candidate.code,
              label: candidate.label,
              description: "Cree depuis assistant IFC4"
            }
          });
          created.push(candidate);
          continue;
        }

        if (candidate.resource === "owners") {
          await tx.ownerEntity.create({
            data: {
              organizationId: auth.organizationId,
              code: candidate.code,
              label: candidate.label,
              description: "Cree depuis assistant IFC4"
            }
          });
          created.push(candidate);
        }
      }
    });

    await this.auditService.log({
      organizationId: auth.organizationId,
      userId: auth.sub,
      action: "imports.ifc4.asset-references.applied",
      entityType: "asset_reference",
      metadata: {
        created: created.length,
        skipped: skipped.length,
        filename
      }
    });

    return {
      created,
      existing,
      skipped,
      warnings: []
    };
  }

  private normalizeOptions(input?: AssistantOptionsInput): AssistantOptions {
    const equipmentOptions = parseJsonObject(input?.equipmentOptions);
    const selectedProperties = parseStringList(equipmentOptions.selectedProperties ?? input?.selectedProperties);
    return {
      selectedClasses: parseSelectedClasses(equipmentOptions.selectedClasses ?? input?.selectedClasses),
      selectedProperties,
      defaultStatusCode: normalizeCode(
        normalizeFreeText(equipmentOptions.defaultStatusCode ?? input?.defaultStatusCode),
        DEFAULT_STATUS_CODE
      ),
      defaultOwnerEntityCode: normalizeCode(
        normalizeFreeText(equipmentOptions.defaultOwnerEntityCode ?? input?.defaultOwnerEntityCode),
        DEFAULT_OWNER_CODE
      ),
      maxProducts: parsePositiveInteger(equipmentOptions.maxProducts ?? input?.maxProducts, DEFAULT_MAX_PRODUCTS, 1, 200000),
      geometryLevel: parseGeometryLevel(equipmentOptions.geometryLevel ?? input?.geometryLevel),
      maxShapeParts: parsePositiveInteger(equipmentOptions.maxShapeParts ?? input?.maxShapeParts, DEFAULT_MAX_SHAPE_PARTS, 1, 64),
      importPolicy: parseImportPolicy(equipmentOptions.importPolicy ?? input?.importPolicy),
      propertyMappings: normalizePropertyMappings(equipmentOptions.propertyMappings)
    };
  }

  private parseSpatialOverrides(input?: AssistantOptionsInput) {
    return parseJsonArray<Ifc4SpatialOverride>(input?.spatialOverrides)
      .filter((override) => typeof override.path === "string" && typeof override.type === "string")
      .map((override) => ({
        path: override.path,
        type: normalizeCode(override.type, override.type)
      }));
  }

  private parseAssetReferenceOverrides(input?: AssistantOptionsInput) {
    return parseJsonArray<Ifc4AssetReferenceOverride>(input?.assetReferenceOverrides)
      .filter((override) =>
        typeof override.resource === "string"
        && typeof override.code === "string"
        && typeof override.nextResource === "string"
      );
  }

  private applySpatialOverrides(rows: ImportRowPreview[], overrides: Ifc4SpatialOverride[]) {
    if (overrides.length === 0) {
      return rows;
    }
    const byPath = new Map(overrides.map((override) => [override.path, override.type]));
    return rows.map((row) => {
      const path = row.values.path;
      const nextType = typeof path === "string" ? byPath.get(path) : null;
      return nextType
        ? {
            ...row,
            values: {
              ...row.values,
              type: nextType
            }
          }
        : row;
    });
  }

  private applyAssetReferenceOverrides(
    candidates: Ifc4AssetReferenceCandidate[],
    overrides: Ifc4AssetReferenceOverride[]
  ) {
    if (overrides.length === 0) {
      return candidates;
    }
    const byKey = new Map(overrides.map((override) => [`${override.resource}:${override.code}`, override.nextResource]));
    return candidates.map((candidate) => {
      const nextResource = byKey.get(`${candidate.resource}:${candidate.code}`);
      return nextResource
        ? {
            ...candidate,
            resource: nextResource
          }
        : candidate;
    });
  }

  private async prepare(
    organizationId: string,
    file: { originalname: string; buffer: Buffer } | undefined,
    options: AssistantOptions
  ): Promise<PreparedIfc> {
    if (!file) {
      throw new BadRequestException("Fichier IFC4 requis");
    }
    if (!file.originalname.toLowerCase().endsWith(".ifc")) {
      throw new BadRequestException("Le fichier doit utiliser l extension .ifc");
    }
    const text = file.buffer.toString("utf8");
    const parsed = this.parseIfc(text);
    const extraction = await this.extractGeometry(file, options);
    return this.prepareFromParsed(organizationId, parsed, extraction, options);
  }

  private async prepareFromFilePath(
    organizationId: string,
    originalFilename: string,
    sourcePath: string,
    outputPath: string,
    metadataOutputPath: string,
    geometryOutputPath: string,
    options: AssistantOptions,
    jobId?: string,
    onLog?: Parameters<IfcGeometryWorker["extract"]>[0]["onLog"]
  ): Promise<PreparedIfc> {
    const text = await readFile(sourcePath, "utf8");
    const parsed = this.parseIfc(text);
    const extraction = await this.extractGeometryFromPath(
      originalFilename,
      sourcePath,
      outputPath,
      metadataOutputPath,
      geometryOutputPath,
      options,
      jobId,
      onLog
    );
    return this.prepareFromParsed(organizationId, parsed, extraction, options, {
      metadataNdjson: "ifc4-metadata.ndjson",
      geometryNdjson: "ifc4-geometry.ndjson",
      extractionJson: "ifcopenshell-extract.v1.json"
    });
  }

  private async prepareFromParsed(
    organizationId: string,
    parsed: ReturnType<Ifc4AssistantService["parseIfc"]>,
    extraction: IfcGeometryExtraction,
    options: AssistantOptions,
    artifactPaths?: { metadataNdjson?: string; geometryNdjson?: string; extractionJson?: string }
  ): Promise<PreparedIfc> {
    const geometryByGlobalId = this.buildGeometryByGlobalId(extraction);
    const productProperties = this.buildProperties(parsed.entities);
    const containment = this.buildContainment(parsed.entities);
    const products = this.buildProducts(parsed.entities, productProperties, options.selectedProperties);
    const spatial = this.buildSpatial(parsed.entities, productProperties, containment, products, geometryByGlobalId);
    const propertyCandidates = this.buildPropertyCandidates(products, options);
    const equipment = this.buildEquipments(products, spatial.productSpatialPath, options, geometryByGlobalId);
    const assetReferenceCandidates = await this.buildAssetReferences(
      organizationId,
      equipment.equipmentRows,
      options
    );

    return {
      schema: parsed.schema,
      totalEntities: parsed.entities.size,
      classSummary: this.buildClassSummary(parsed.entities),
      propertyCandidates,
      spatialRows: spatial.rawRows,
      spatialNodes: spatial.nodes,
      assetReferenceCandidates,
      equipmentRows: equipment.equipmentRows,
      equipmentRawRows: equipment.rawRows,
      geometrySummary: this.buildGeometrySummary(
        [...spatial.nodes.map((node) => node.geometry), ...equipment.equipmentRows.map((row) => row.geometry)],
        options.geometryLevel
      ),
      profile: this.buildProfile(options),
      artifactRefs: artifactPaths,
      warnings: [
        ...spatial.warnings,
        ...equipment.warnings
      ]
    };
  }

  private buildAnalysisResponse(filename: string, prepared: PreparedIfc): Ifc4AnalysisResponse {
    return {
      filename,
      schema: prepared.schema,
      totalEntities: prepared.totalEntities,
      profile: prepared.profile,
      classSummary: prepared.classSummary,
      propertyCandidates: prepared.propertyCandidates,
      spatialNodes: prepared.spatialNodes,
      assetReferences: prepared.assetReferenceCandidates,
      equipmentRows: prepared.equipmentRows,
      metadataSummary: {
        spatialCount: prepared.spatialNodes.length,
        candidateProducts: prepared.equipmentRows.length,
        selectedClasses: prepared.profile.selectedClasses
      },
      geometrySummary: prepared.geometrySummary,
      artifactRefs: prepared.artifactRefs,
      processingMode: "BATCH_PROFILED",
      warnings: prepared.warnings
    };
  }

  private async extractGeometry(file: { originalname: string; buffer: Buffer }, options: AssistantOptions): Promise<IfcGeometryExtraction> {
    const directory = await mkdtemp(join(tmpdir(), "inventory-ifc-"));
    const inputPath = join(directory, file.originalname.replace(/[^a-zA-Z0-9._-]+/g, "-") || "source.ifc");
    const outputPath = join(directory, "ifcopenshell-extract.v1.json");
    try {
      this.logger.log(`Starting strict IFC4 geometry analysis filename=${file.originalname} size=${file.buffer.length}`);
      await writeFile(inputPath, file.buffer);
      const extraction = await this.ifcGeometryWorker.extract({
        sourcePath: inputPath,
        outputPath,
        timeoutMs: 60 * 60 * 1000,
        maxProducts: options.maxProducts,
        selectedClasses: options.selectedClasses,
        geometryLevel: options.geometryLevel,
        maxShapeParts: options.maxShapeParts
      });
      this.logger.log(
        `Strict IFC4 geometry analysis completed filename=${file.originalname} spatial=${extraction.stats.totalSpatialObjects ?? 0} spatialWithGeometry=${extraction.stats.spatialWithGeometry ?? 0} products=${extraction.stats.totalProducts ?? 0} productsWithGeometry=${extraction.stats.withGeometry ?? 0} errors=${extraction.stats.errors ?? 0}`
      );
      return extraction;
    } catch (error) {
      const message = error instanceof Error ? error.message : "IFC geometry extraction failed";
      const lowerMessage = message.toLowerCase();
      const code = lowerMessage.includes("no module named") || lowerMessage.includes("modulenotfounderror")
        ? "IFC_GEOMETRY_ENGINE_UNAVAILABLE"
        : "IFC_GEOMETRY_EXTRACTION_FAILED";
      this.logger.error(`Strict IFC4 geometry analysis failed filename=${file.originalname} code=${code} detail=${message}`);
      throw new UnprocessableEntityException({
        code,
        message: code === "IFC_GEOMETRY_ENGINE_UNAVAILABLE"
          ? "IfcOpenShell est requis pour analyser la geometrie IFC4"
          : "La geometrie du fichier IFC4 n a pas pu etre extraite",
        detail: message,
        filename: file.originalname,
        python: process.env.IFC_GEOMETRY_PYTHON ?? process.env.PYTHON ?? "python",
        worker: "apps/api/workers/ifc_geometry/extract_scene.py"
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  private async extractGeometryFromPath(
    originalFilename: string,
    inputPath: string,
    outputPath: string,
    metadataOutputPath: string,
    geometryOutputPath: string,
    options: AssistantOptions,
    jobId?: string,
    onLog?: Parameters<IfcGeometryWorker["extract"]>[0]["onLog"]
  ): Promise<IfcGeometryExtraction> {
    try {
      this.logger.log(`Starting strict IFC4 geometry analysis filename=${originalFilename} path=${inputPath}`);
      const extraction = await this.ifcGeometryWorker.extract({
        jobId,
        sourcePath: inputPath,
        outputPath,
        maxProducts: options.maxProducts,
        selectedClasses: options.selectedClasses,
        geometryLevel: options.geometryLevel,
        maxShapeParts: options.maxShapeParts,
        metadataOutputPath,
        geometryOutputPath,
        onLog
      });
      this.logger.log(
        `Strict IFC4 geometry analysis completed filename=${originalFilename} spatial=${extraction.stats.totalSpatialObjects ?? 0} spatialWithGeometry=${extraction.stats.spatialWithGeometry ?? 0} products=${extraction.stats.totalProducts ?? 0} productsWithGeometry=${extraction.stats.withGeometry ?? 0} errors=${extraction.stats.errors ?? 0}`
      );
      return extraction;
    } catch (error) {
      const message = error instanceof Error ? error.message : "IFC geometry extraction failed";
      const code = this.resolveGeometryErrorCode(message);
      this.logger.error(`Strict IFC4 geometry analysis failed filename=${originalFilename} code=${code} detail=${message}`);
      throw new UnprocessableEntityException({
        code,
        message: code === "IFC_GEOMETRY_ENGINE_UNAVAILABLE"
          ? "IfcOpenShell est requis pour analyser la geometrie IFC4"
          : "La geometrie du fichier IFC4 n a pas pu etre extraite",
        detail: message,
        filename: originalFilename,
        python: process.env.IFC_GEOMETRY_PYTHON ?? process.env.PYTHON ?? "python",
        worker: "apps/api/workers/ifc_geometry/extract_scene.py"
      });
    }
  }

  private buildGeometryByGlobalId(extraction: IfcGeometryExtraction) {
    const byGlobalId = new Map<string, Ifc4GeometryPreview>();
    for (const item of [...extraction.spatialObjects, ...extraction.products]) {
      if (!item.globalId) continue;
      byGlobalId.set(item.globalId, this.mapGeometryPreview(item, extraction));
    }
    return byGlobalId;
  }

  private mapGeometryPreview(item: IfcExtractObject, extraction: IfcGeometryExtraction): Ifc4GeometryPreview {
    const hasGeometry = item.hasGeometry && item.bbox && item.center && item.size;
    const metadata = {
      bbox: item.bbox,
      shapeParts: item.shapeParts ?? null,
      globalId: item.globalId,
      ifcEntityId: item.ifcEntityId,
      ifcClass: item.ifcClass,
      extractionEngine: "ifcopenshell-python",
      unitScale: extraction.units.scaleToMeters
    };
    return {
      geometryStatus: hasGeometry ? "READY" : item.geometryError ? "ERROR" : "MISSING",
      geometryMessage: hasGeometry ? null : item.geometryError ?? "Geometrie IFC absente",
      worldCenter: item.center ? { x: item.center[0], y: item.center[1], z: item.center[2] } : null,
      worldSize: item.size ? { x: item.size[0], y: item.size[1], z: item.size[2] } : null,
      worldBbox: item.bbox
        ? {
            min: { x: item.bbox.min[0], y: item.bbox.min[1], z: item.bbox.min[2] },
            max: { x: item.bbox.max[0], y: item.bbox.max[1], z: item.bbox.max[2] }
          }
        : null,
      geometrySource: hasGeometry ? "ifcopenshell-python" : null,
      geometryMetadata: metadata
    };
  }

  private missingGeometry(label: string, geometry: Ifc4GeometryPreview | null) {
    return !geometry || geometry.geometryStatus !== "READY"
      ? {
          label,
          status: geometry?.geometryStatus ?? "MISSING",
          message: geometry?.geometryMessage ?? "Geometrie IFC obligatoire absente"
        }
      : null;
  }

  private assertGeometryReady(items: Array<{ label: string; geometry: Ifc4GeometryPreview | null }>) {
    const missing = items.map((item) => this.missingGeometry(item.label, item.geometry)).filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (missing.length > 0) {
      throw new UnprocessableEntityException({
        code: "IFC_GEOMETRY_REQUIRED",
        message: "La geometrie IFC est obligatoire pour creer ce job",
        missingCount: missing.length,
        examples: missing.slice(0, 20)
      });
    }
  }

  private buildGeometrySummary(
    items: Array<Ifc4GeometryPreview | null | undefined>,
    level: Ifc4GeometryLevel
  ): Ifc4AnalysisResponse["geometrySummary"] {
    if (level === "NONE") {
      return {
        engine: "ifcopenshell-python",
        level,
        ready: 0,
        missing: 0,
        errors: 0
      };
    }

    return {
      engine: "ifcopenshell-python",
      level,
      ready: items.filter((item) => item?.geometryStatus === "READY").length,
      missing: items.filter((item) => !item || item.geometryStatus === "MISSING").length,
      errors: items.filter((item) => item?.geometryStatus === "ERROR").length
    };
  }

  private parseIfc(text: string) {
    const entities = new Map<string, IfcEntity>();
    const schema = text.match(/FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/i)?.[1] ?? null;
    const regex = /#(\d+)\s*=\s*([A-Z0-9_]+)\s*\(([\s\S]*?)\)\s*;/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) != null) {
      entities.set(match[1], {
        id: match[1],
        type: match[2].toUpperCase(),
        args: splitArgs(match[3])
      });
    }
    return { schema, entities };
  }

  private buildClassSummary(entities: Map<string, IfcEntity>) {
    const counts = new Map<string, number>();
    for (const entity of entities.values()) {
      pushCount(counts, entity.type);
    }
    return [...counts.entries()]
      .filter(([sourceClass]) => sourceClass.startsWith("IFC"))
      .map(([sourceClass, count]) => ({
        sourceClass,
        count,
        selectedByDefault: DEFAULT_SELECTED_CLASSES.includes(sourceClass)
      }))
      .sort((left, right) => right.count - left.count || left.sourceClass.localeCompare(right.sourceClass));
  }

  private buildProperties(entities: Map<string, IfcEntity>) {
    const singleValues = new Map<string, { name: string; value: string }>();
    for (const entity of entities.values()) {
      if (entity.type !== "IFCPROPERTYSINGLEVALUE") {
        continue;
      }
      const name = readString(entity.args[0]);
      const value = readIfcValue(entity.args[2]);
      if (name && value != null) {
        singleValues.set(entity.id, { name, value });
      }
    }

    const psets = new Map<string, Record<string, string>>();
    for (const entity of entities.values()) {
      if (entity.type !== "IFCPROPERTYSET") {
        continue;
      }
      const properties: Record<string, string> = {};
      for (const ref of readRefs(entity.args[4])) {
        const property = singleValues.get(ref);
        if (property) {
          properties[property.name] = property.value;
        }
      }
      psets.set(entity.id, properties);
    }

    const objectProperties = new Map<string, Record<string, string>>();
    for (const entity of entities.values()) {
      if (entity.type !== "IFCRELDEFINESBYPROPERTIES") {
        continue;
      }
      const relatedObjects = readRefs(entity.args[4]);
      const psetRef = readRef(entity.args[5]);
      const pset = psetRef ? psets.get(psetRef) : null;
      if (!pset) {
        continue;
      }
      for (const objectRef of relatedObjects) {
        objectProperties.set(objectRef, {
          ...(objectProperties.get(objectRef) ?? {}),
          ...pset
        });
      }
    }
    return objectProperties;
  }

  private buildContainment(entities: Map<string, IfcEntity>) {
    const aggregateParent = new Map<string, string>();
    const spatialParent = new Map<string, string>();
    for (const entity of entities.values()) {
      if (entity.type === "IFCRELAGGREGATES") {
        const parent = readRef(entity.args[4]);
        if (!parent) {
          continue;
        }
        for (const child of readRefs(entity.args[5])) {
          aggregateParent.set(child, parent);
        }
      }
      if (entity.type === "IFCRELCONTAINEDINSPATIALSTRUCTURE") {
        const parent = readRef(entity.args[5]);
        if (!parent) {
          continue;
        }
        for (const child of readRefs(entity.args[4])) {
          spatialParent.set(child, parent);
        }
      }
    }
    return { aggregateParent, spatialParent };
  }

  private buildProducts(
    entities: Map<string, IfcEntity>,
    productProperties: Map<string, Record<string, string>>,
    selectedProperties: string[]
  ) {
    const products = new Map<string, IfcProduct>();
    const selectedSet = new Set(selectedProperties);
    for (const entity of entities.values()) {
      if (!entity.type.startsWith("IFC")) {
        continue;
      }
      const properties = productProperties.get(entity.id) ?? {};
      products.set(entity.id, {
        id: entity.id,
        sourceClass: entity.type,
        globalId: readString(entity.args[0]),
        name: readString(entity.args[2]),
        description: readString(entity.args[3]),
        objectType: readString(entity.args[4]),
        properties: selectedSet.size > 0
          ? Object.fromEntries(Object.entries(properties).filter(([key]) => selectedSet.has(key)))
          : properties
      });
    }
    return products;
  }

  private buildPropertyCandidates(products: Map<string, IfcProduct>, options: AssistantOptions) {
    const selectedClasses = new Set(options.selectedClasses ?? DEFAULT_SELECTED_CLASSES);
    const candidates = new Map<string, Ifc4PropertyCandidate>();
    for (const product of products.values()) {
      if (!EQUIPMENT_CLASSES.has(product.sourceClass) || !selectedClasses.has(product.sourceClass)) {
        continue;
      }
      for (const [name, value] of Object.entries(product.properties)) {
        const current = candidates.get(name);
        if (current) {
          current.count += 1;
          if (!current.sampleValue && value) {
            current.sampleValue = value;
          }
          continue;
        }
        candidates.set(name, {
          name,
          sampleValue: value || null,
          count: 1
        });
      }
    }
    return [...candidates.values()].sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
  }

  private readMappedProperty(
    properties: Record<string, string>,
    propertyName: string | null | undefined
  ) {
    return propertyName ? normalizeFreeText(properties[propertyName]) : null;
  }

  private buildSpatial(
    entities: Map<string, IfcEntity>,
    productProperties: Map<string, Record<string, string>>,
    containment: ReturnType<Ifc4AssistantService["buildContainment"]>,
    products: Map<string, IfcProduct>,
    geometryByGlobalId: Map<string, Ifc4GeometryPreview>
  ) {
    const warnings: string[] = [];
    const rowMap = new Map<string, ImportRowPreview>();
    const nodeMap = new Map<string, Ifc4SpatialPreviewNode>();
    const sourceMetadataByPath = new Map<string, Record<string, unknown>>();
    const productSpatialPath = new Map<string, { path: string | null; externalRef: string | null }>();

    const spatialRefs = [...entities.values()]
      .filter((entity) => ["IFCSITE", "IFCBUILDING", "IFCBUILDINGSTOREY", "IFCSPACE"].includes(entity.type))
      .map((entity) => entity.id);
    const pathByEntity = new Map<string, string>();

    const findParentPath = (entityId: string) => {
      const parentId = containment.aggregateParent.get(entityId) ?? containment.spatialParent.get(entityId) ?? null;
      return parentId ? pathByEntity.get(parentId) ?? null : null;
    };

    const createNode = (input: {
      type: string;
      code: string;
      label: string;
      path: string;
      parentPath: string | null;
      externalRef: string | null;
      sourceClass: string | null;
      sourceMetadata: Record<string, unknown>;
      geometry: Ifc4GeometryPreview | null;
    }) => {
      if (rowMap.has(input.path)) {
        const existingNode = nodeMap.get(input.path);
        const mergedGeometry = mergeGeometryPreview(existingNode?.geometry, input.geometry);
        if (existingNode && mergedGeometry) {
          existingNode.geometry = mergedGeometry;
          const existingRow = rowMap.get(input.path);
          if (existingRow) {
            existingRow.values = {
              ...existingRow.values,
              ...geometryRowValues(mergedGeometry)
            };
          }
        }
        return;
      }
      sourceMetadataByPath.set(input.path, input.sourceMetadata);
      const row = buildRow(rowMap.size + 2, {
        type: input.type,
        code: input.code,
        label: input.label,
        description: null,
        path: input.path,
        parentPath: input.parentPath,
        externalRef: input.externalRef,
        sourceClass: input.sourceClass,
        sourceMetadata: JSON.stringify(input.sourceMetadata),
        ...geometryRowValues(input.geometry),
        isActive: "true"
      });
      rowMap.set(input.path, row);
      nodeMap.set(input.path, {
        type: input.type,
        code: input.code,
        label: input.label,
        path: input.path,
        parentPath: input.parentPath,
        externalRef: input.externalRef,
        sourceClass: input.sourceClass,
        childrenCount: 0,
        geometry: input.geometry
      });
    };

    for (const sourceClass of ["IFCSITE", "IFCBUILDING", "IFCBUILDINGSTOREY", "IFCSPACE"]) {
      for (const entityId of spatialRefs) {
        const product = products.get(entityId);
        if (!product || product.sourceClass !== sourceClass) {
          continue;
        }
        const parentPath = findParentPath(entityId);
        const type =
          sourceClass === "IFCSITE"
            ? "SITE"
            : sourceClass === "IFCBUILDING"
              ? "BUILDING"
              : sourceClass === "IFCBUILDINGSTOREY"
                ? "FLOOR"
                : "ROOM";
        const code = normalizeCode(product.name ?? product.objectType ?? product.globalId, type);
        const label = normalizeLabel(product.name ?? product.objectType ?? product.globalId, type);
        const path = parentPath ? `${parentPath}/${code}` : code;
        const storeyElevation = sourceClass === "IFCBUILDINGSTOREY" ? readIfcNumber(entities.get(entityId)?.args[9]) : null;
        pathByEntity.set(entityId, path);
        createNode({
          type,
          code,
          label,
          path,
          parentPath,
          externalRef: product.globalId,
          sourceClass,
          sourceMetadata: {
            ifcEntityId: entityId,
            elevationMeters: storeyElevation,
            properties: productProperties.get(entityId) ?? {}
          },
          geometry: product.globalId ? geometryByGlobalId.get(product.globalId) ?? null : null
        });
      }
    }

    const floorByNumericLevel = new Map<string, string>();
    for (const [entityId, path] of pathByEntity.entries()) {
      const product = products.get(entityId);
      if (product?.sourceClass !== "IFCBUILDINGSTOREY") {
        continue;
      }
      const label = product.name ?? "";
      const number = label.match(/(\d+)/)?.[1];
      if (number) {
        floorByNumericLevel.set(number, path);
      }
    }

    const buildingPath = [...nodeMap.values()].find((node) => node.type === "BUILDING")?.path;
    for (const product of products.values()) {
      if (!EQUIPMENT_CLASSES.has(product.sourceClass) && product.sourceClass !== "IFCSPACE") {
        continue;
      }
      const zoneLabel = normalizeFreeText(product.properties.Zone);
      if (!zoneLabel) {
        continue;
      }
      const floorValue = normalizeFreeText(product.properties.Etage) ?? normalizeFreeText(product.properties.Storey);
      const floorPath = floorValue ? floorByNumericLevel.get(floorValue.replace(/\D+/g, "")) ?? null : null;
      const parentPath = floorPath ?? buildingPath ?? [...nodeMap.values()].find((node) => node.type === "SITE")?.path ?? null;
      if (!parentPath) {
        warnings.push("ZONE_PARENT_UNRESOLVED");
        continue;
      }
      const code = normalizeCode(zoneLabel, "ZONE");
      const path = `${parentPath}/${code}`;
      const productGeometry = product.globalId ? geometryByGlobalId.get(product.globalId) ?? null : null;
      createNode({
        type: "ZONE",
        code,
        label: zoneLabel,
        path,
        parentPath,
        externalRef: null,
        sourceClass: "IFC_PROPERTY_ZONE",
        sourceMetadata: {
          sourceProperty: "Zone",
          floor: floorValue
        },
        geometry: EQUIPMENT_CLASSES.has(product.sourceClass) ? productGeometry : null
      });
      if (EQUIPMENT_CLASSES.has(product.sourceClass)) {
        productSpatialPath.set(product.id, { path, externalRef: null });
      }
    }

    for (const product of products.values()) {
      if (product.sourceClass !== "IFCSPACE") {
        continue;
      }
      const existingPath = pathByEntity.get(product.id);
      const zoneLabel = normalizeFreeText(product.properties.Zone);
      if (!zoneLabel || !existingPath) {
        continue;
      }
      const parentPath = existingPath.split("/").slice(0, -1).join("/");
      const floorPath = parentPath.length > 0 ? parentPath : null;
      const zonePath = floorPath ? `${floorPath}/${normalizeCode(zoneLabel, "ZONE")}` : null;
      const roomNode = nodeMap.get(existingPath);
      if (zonePath && roomNode && nodeMap.has(zonePath)) {
        const roomCode = roomNode.code;
        const nextPath = `${zonePath}/${roomCode}`;
        rowMap.delete(existingPath);
        nodeMap.delete(existingPath);
        createNode({
          type: "ROOM",
          code: roomCode,
          label: roomNode.label,
          path: nextPath,
          parentPath: zonePath,
          externalRef: roomNode.externalRef,
          sourceClass: "IFCSPACE",
          sourceMetadata: {
            ifcEntityId: product.id,
            properties: product.properties
          },
          geometry: product.globalId ? geometryByGlobalId.get(product.globalId) ?? null : null
        });
        pathByEntity.set(product.id, nextPath);
      }
    }

    for (const [entityId, parentId] of containment.spatialParent.entries()) {
      if (productSpatialPath.has(entityId)) {
        continue;
      }
      const parentPath = pathByEntity.get(parentId) ?? null;
      if (parentPath) {
        productSpatialPath.set(entityId, { path: parentPath, externalRef: products.get(parentId)?.globalId ?? null });
      }
    }

    for (const node of nodeMap.values()) {
      if (!isStoreyNode(node) || node.geometry?.geometryStatus === "READY") {
        continue;
      }

      const childGeometries: Ifc4GeometryPreview[] = [];
      for (const candidate of nodeMap.values()) {
        if (candidate.path !== node.path && candidate.path.startsWith(`${node.path}/`) && candidate.geometry?.geometryStatus === "READY") {
          childGeometries.push(candidate.geometry);
        }
      }
      for (const product of products.values()) {
        if (!EQUIPMENT_CLASSES.has(product.sourceClass) || !product.globalId) {
          continue;
        }
        const spatial = productSpatialPath.get(product.id);
        if (!spatial?.path || (spatial.path !== node.path && !spatial.path.startsWith(`${node.path}/`))) {
          continue;
        }
        const geometry = geometryByGlobalId.get(product.globalId);
        if (geometry?.geometryStatus === "READY") {
          childGeometries.push(geometry);
        }
      }

      const sourceMetadata = sourceMetadataByPath.get(node.path) ?? {};
      const parentNode = node.parentPath ? nodeMap.get(node.parentPath) ?? null : null;
      const derivedGeometry = deriveStoreyGeometry({
        storey: node,
        sourceGlobalId: node.externalRef,
        sourceMetadata,
        parentGeometry: parentNode?.type === "BUILDING" ? parentNode.geometry ?? null : null,
        childGeometries
      });
      const nextGeometry = derivedGeometry ?? withDerivedStoreyFailure(node.geometry);
      node.geometry = nextGeometry;
      const row = rowMap.get(node.path);
      if (row) {
        const nextSourceMetadata = derivedGeometry
          ? {
              ...sourceMetadata,
              storeyGeometryPolicy: derivedGeometry.geometrySource === STOREY_DERIVED_FROM_BUILDING_GEOMETRY_SOURCE
                ? "DERIVED_FROM_PARENT_BUILDING"
                : "DERIVED_FROM_CHILDREN",
              geometryMessage: derivedGeometry.geometryMessage
            }
          : {
              ...sourceMetadata,
              storeyGeometryPolicy: "DERIVED_FROM_CHILDREN",
              geometryError: "STOREY_DERIVATION_FAILED"
            };
        sourceMetadataByPath.set(node.path, nextSourceMetadata);
        row.values = {
          ...row.values,
          sourceMetadata: JSON.stringify(nextSourceMetadata),
          ...geometryRowValues(nextGeometry)
        };
      }
    }

    for (const node of nodeMap.values()) {
      node.childrenCount = [...nodeMap.values()].filter((candidate) => candidate.parentPath === node.path).length;
    }

    const rows = [...rowMap.values()].sort((left, right) => {
      const leftPath = left.values.path ?? "";
      const rightPath = right.values.path ?? "";
      return pathDepth(leftPath) - pathDepth(rightPath) || leftPath.localeCompare(rightPath);
    });
    rows.forEach((row, index) => {
      row.rowIndex = index + 2;
    });

    return {
      rawRows: rows,
      nodes: [...nodeMap.values()].sort((left, right) => pathDepth(left.path) - pathDepth(right.path) || left.path.localeCompare(right.path)),
      productSpatialPath,
      warnings
    };
  }

  private buildEquipments(
    products: Map<string, IfcProduct>,
    productSpatialPath: Map<string, { path: string | null; externalRef: string | null }>,
    options: AssistantOptions,
    geometryByGlobalId: Map<string, Ifc4GeometryPreview>
  ) {
    const warnings: string[] = [];
    const equipmentRows: Ifc4EquipmentPreviewRow[] = [];
    const rawRows: ImportRowPreview[] = [];
    for (const product of products.values()) {
      if (!EQUIPMENT_CLASSES.has(product.sourceClass)) {
        continue;
      }
      const internalCode = this.readMappedProperty(product.properties, options.propertyMappings.internalCode)
        ?? normalizeFreeText(product.properties["ID unique"])
        ?? normalizeFreeText(product.properties["ID IFC Archicad"])
        ?? product.globalId
        ?? `IFC-${product.id}`;
      const numPiece = this.readMappedProperty(product.properties, options.propertyMappings.numPiece);
      const externalRef = this.readMappedProperty(product.properties, options.propertyMappings.externalRef)
        ?? product.globalId
        ?? null;
      const typeLabel = this.readMappedProperty(product.properties, options.propertyMappings.type)
        ?? normalizeFreeText(product.properties["Type de mobilier"])
        ?? normalizeFreeText(product.objectType)
        ?? product.sourceClass;
      const equipmentTypeCode = normalizeCode(typeLabel, product.sourceClass);
      const manufacturer = this.readMappedProperty(product.properties, options.propertyMappings.brand)
        ?? normalizeFreeText(product.properties.Fabricant)
        ?? normalizeFreeText(product.properties.Manufacturer)
        ?? null;
      const modelLabel = this.readMappedProperty(product.properties, options.propertyMappings.model)
        ?? normalizeFreeText(product.properties["Modele/Gamme"])
        ?? normalizeFreeText(product.properties["Modele"])
        ?? normalizeFreeText(product.properties.Model)
        ?? null;
      const equipmentModelCode = manufacturer && modelLabel
        ? `${normalizeCode(manufacturer, "NON_DEFINI")}__${normalizeCode(modelLabel, "MODELE")}`
        : null;
      const equipmentStatusCode = normalizeCode(
        this.readMappedProperty(product.properties, options.propertyMappings.status) ?? options.defaultStatusCode,
        DEFAULT_STATUS_CODE
      );
      const ownerEntityCode = normalizeCode(
        this.readMappedProperty(product.properties, options.propertyMappings.owner) ?? options.defaultOwnerEntityCode,
        DEFAULT_OWNER_CODE
      );
      const spatial = productSpatialPath.get(product.id) ?? { path: null, externalRef: null };
      const geometry = product.globalId ? geometryByGlobalId.get(product.globalId) ?? null : null;
      if (!spatial.path) {
        warnings.push(`EQUIPMENT_SPATIAL_UNRESOLVED:${internalCode}`);
      }
      const previewRow: Ifc4EquipmentPreviewRow = {
        rowIndex: equipmentRows.length + 2,
        sourceClass: product.sourceClass,
        internalCode,
        numPiece,
        externalRef,
        equipmentTypeCode,
        equipmentModelCode,
        equipmentStatusCode,
        ownerEntityCode,
        currentSpatialPath: spatial.path,
        currentSpatialExternalRef: spatial.externalRef,
        sourceGlobalId: product.globalId,
        label: product.name ?? product.objectType ?? null,
        properties: product.properties,
        geometry
      };
      equipmentRows.push(previewRow);
      rawRows.push(buildRow(previewRow.rowIndex, {
        internalCode,
        numPiece,
        externalRef,
        serialNumber: normalizeFreeText(product.properties.SerialNumber),
        equipmentTypeCode,
        equipmentModelCode,
        equipmentStatusCode: previewRow.equipmentStatusCode,
        ownerEntityCode: previewRow.ownerEntityCode,
        currentSpatialPath: spatial.path,
        currentSpatialExternalRef: spatial.externalRef,
        technicalCharacteristics: JSON.stringify({
          source: "IFC4",
          sourceClass: product.sourceClass,
          globalId: product.globalId,
          ifcEntityId: product.id,
          properties: product.properties
        }),
        geometrySource: geometry?.geometrySource ?? null,
        geometryMetadata: geometry?.geometryMetadata ? JSON.stringify(geometry.geometryMetadata) : null,
        worldCenterX: geometry?.worldCenter ? String(geometry.worldCenter.x) : null,
        worldCenterY: geometry?.worldCenter ? String(geometry.worldCenter.y) : null,
        worldCenterZ: geometry?.worldCenter ? String(geometry.worldCenter.z) : null,
        worldSizeX: geometry?.worldSize ? String(geometry.worldSize.x) : null,
        worldSizeY: geometry?.worldSize ? String(geometry.worldSize.y) : null,
        worldSizeZ: geometry?.worldSize ? String(geometry.worldSize.z) : null,
        notes: product.name ?? product.description ?? null,
        sourceClass: product.sourceClass
      }));
    }
    return { equipmentRows, rawRows, warnings };
  }

  private async buildAssetReferences(
    organizationId: string,
    equipmentRows: Ifc4EquipmentPreviewRow[],
    options: AssistantOptions
  ) {
    const candidates = new Map<string, Ifc4AssetReferenceCandidate>();
    addCandidate(candidates, {
      resource: "categories",
      code: "IFC4",
      label: "IFC4",
      parentCode: null,
      sourceClass: "IFC4"
    });
    addCandidate(candidates, {
      resource: "families",
      code: "IFC4_MOBILIER",
      label: "Mobilier IFC4",
      parentCode: "IFC4",
      sourceClass: "IFC4"
    });
    addCandidate(candidates, {
      resource: "subfamilies",
      code: "IFC4_MOBILIER",
      label: "Mobilier IFC4",
      parentCode: "IFC4_MOBILIER",
      sourceClass: "IFC4"
    });
    addCandidate(candidates, {
      resource: "statuses",
      code: options.defaultStatusCode ?? DEFAULT_STATUS_CODE,
      label: options.defaultStatusCode ?? DEFAULT_STATUS_CODE,
      parentCode: null,
      sourceClass: "IFC4"
    });
    addCandidate(candidates, {
      resource: "owners",
      code: options.defaultOwnerEntityCode ?? DEFAULT_OWNER_CODE,
      label: options.defaultOwnerEntityCode ?? DEFAULT_OWNER_CODE,
      parentCode: null,
      sourceClass: "IFC4"
    });

    for (const row of equipmentRows) {
      const categoryLabel = this.readMappedProperty(row.properties, options.propertyMappings.category);
      const categoryCode = categoryLabel ? normalizeCode(categoryLabel, "IFC4") : "IFC4";
      const categorySourceLabel = categoryLabel ?? "IFC4";
      const familyLabel = this.readMappedProperty(row.properties, options.propertyMappings.family);
      const familyCode = familyLabel ? normalizeCode(familyLabel, "IFC4_MOBILIER") : "IFC4_MOBILIER";
      const familySourceLabel = familyLabel ?? "Mobilier IFC4";
      const subfamilyLabel = this.readMappedProperty(row.properties, options.propertyMappings.subfamily);
      const subfamilyCode = subfamilyLabel ? normalizeCode(subfamilyLabel, familyCode) : "IFC4_MOBILIER";
      const subfamilySourceLabel = subfamilyLabel ?? "Mobilier IFC4";

      addCandidate(candidates, {
        resource: "categories",
        code: categoryCode,
        label: categorySourceLabel,
        parentCode: null,
        sourceClass: row.sourceClass
      });
      addCandidate(candidates, {
        resource: "families",
        code: familyCode,
        label: familySourceLabel,
        parentCode: categoryCode,
        sourceClass: row.sourceClass
      });
      addCandidate(candidates, {
        resource: "subfamilies",
        code: subfamilyCode,
        label: subfamilySourceLabel,
        parentCode: familyCode,
        sourceClass: row.sourceClass
      });
      if (row.equipmentTypeCode) {
        addCandidate(candidates, {
          resource: "types",
          code: row.equipmentTypeCode,
          label: row.equipmentTypeCode.replace(/[-_]+/g, " "),
          parentCode: subfamilyCode,
          sourceClass: row.sourceClass
        });
      }
      if (row.equipmentModelCode) {
        const brandCode = row.equipmentModelCode.split("__")[0] ?? "NON_DEFINI";
        addCandidate(candidates, {
          resource: "brands",
          code: brandCode,
          label: brandCode.replace(/[-_]+/g, " "),
          parentCode: null,
          sourceClass: row.sourceClass
        });
        addCandidate(candidates, {
          resource: "models",
          code: row.equipmentModelCode,
          label: row.equipmentModelCode.replace(/[-_]+/g, " "),
          parentCode: brandCode,
          sourceClass: row.sourceClass
        });
      }
    }

    const references = [...candidates.values()];
    const [categories, families, subfamilies, types, brands, models, statuses, owners] = await Promise.all([
      this.prisma.equipmentCategory.findMany({ where: { organizationId }, select: { code: true } }),
      this.prisma.equipmentFamily.findMany({ where: { organizationId }, select: { code: true } }),
      this.prisma.equipmentSubfamily.findMany({ where: { organizationId }, select: { code: true } }),
      this.prisma.equipmentType.findMany({ where: { organizationId }, select: { code: true } }),
      this.prisma.equipmentBrand.findMany({ where: { organizationId }, select: { code: true } }),
      this.prisma.equipmentModel.findMany({ where: { organizationId }, select: { code: true } }),
      this.prisma.equipmentStatus.findMany({ where: { organizationId }, select: { code: true } }),
      this.prisma.ownerEntity.findMany({ where: { organizationId }, select: { code: true } })
    ]);
    const existingByResource = {
      categories: new Set(categories.map((item) => item.code)),
      families: new Set(families.map((item) => item.code)),
      subfamilies: new Set(subfamilies.map((item) => item.code)),
      types: new Set(types.map((item) => item.code)),
      brands: new Set(brands.map((item) => item.code)),
      models: new Set(models.map((item) => item.code)),
      statuses: new Set(statuses.map((item) => item.code)),
      owners: new Set(owners.map((item) => item.code))
    };
    for (const reference of references) {
      reference.exists = existingByResource[reference.resource].has(reference.code);
    }
    return references.sort((left, right) => left.resource.localeCompare(right.resource) || left.code.localeCompare(right.code));
  }

  private async ensureCategory(
    tx: Prisma.TransactionClient,
    organizationId: string,
    candidates: Ifc4AssetReferenceCandidate[],
    created: Ifc4AssetReferenceCandidate[],
    existing: Ifc4AssetReferenceCandidate[]
  ) {
    const candidate = candidates.find((item) => item.resource === "categories" && item.code === "IFC4") ?? {
      resource: "categories" as const,
      code: "IFC4",
      label: "IFC4",
      parentCode: null,
      sourceClass: "IFC4",
      count: 1,
      exists: false
    };
    const current = await tx.equipmentCategory.findFirst({ where: { organizationId, code: candidate.code }, select: { id: true } });
    if (current) {
      existing.push(candidate);
      return current;
    }
    const category = await tx.equipmentCategory.create({
      data: { organizationId, code: candidate.code, label: candidate.label, description: "Cree depuis assistant IFC4" },
      select: { id: true }
    });
    created.push(candidate);
    return category;
  }

  private async ensureFamily(
    tx: Prisma.TransactionClient,
    organizationId: string,
    categoryId: string,
    candidates: Ifc4AssetReferenceCandidate[],
    created: Ifc4AssetReferenceCandidate[],
    existing: Ifc4AssetReferenceCandidate[]
  ) {
    const candidate = candidates.find((item) => item.resource === "families" && item.code === "IFC4_MOBILIER") ?? {
      resource: "families" as const,
      code: "IFC4_MOBILIER",
      label: "Mobilier IFC4",
      parentCode: "IFC4",
      sourceClass: "IFC4",
      count: 1,
      exists: false
    };
    const current = await tx.equipmentFamily.findFirst({ where: { organizationId, code: candidate.code }, select: { id: true } });
    if (current) {
      existing.push(candidate);
      return current;
    }
    const family = await tx.equipmentFamily.create({
      data: { organizationId, categoryId, code: candidate.code, label: candidate.label, description: "Cree depuis assistant IFC4" },
      select: { id: true }
    });
    created.push(candidate);
    return family;
  }

  private async ensureSubfamily(
    tx: Prisma.TransactionClient,
    organizationId: string,
    familyId: string,
    candidates: Ifc4AssetReferenceCandidate[],
    created: Ifc4AssetReferenceCandidate[],
    existing: Ifc4AssetReferenceCandidate[]
  ) {
    const candidate = candidates.find((item) => item.resource === "subfamilies" && item.code === "IFC4_MOBILIER") ?? {
      resource: "subfamilies" as const,
      code: "IFC4_MOBILIER",
      label: "Mobilier IFC4",
      parentCode: "IFC4_MOBILIER",
      sourceClass: "IFC4",
      count: 1,
      exists: false
    };
    const current = await tx.equipmentSubfamily.findFirst({ where: { organizationId, code: candidate.code }, select: { id: true } });
    if (current) {
      existing.push(candidate);
      return current;
    }
    const subfamily = await tx.equipmentSubfamily.create({
      data: { organizationId, familyId, code: candidate.code, label: candidate.label, description: "Cree depuis assistant IFC4" },
      select: { id: true }
    });
    created.push(candidate);
    return subfamily;
  }

  private async findExistingReference(
    tx: Prisma.TransactionClient,
    organizationId: string,
    resource: Ifc4AssetReferenceCandidate["resource"],
    code: string
  ) {
    switch (resource) {
      case "categories":
        return tx.equipmentCategory.findFirst({ where: { organizationId, code }, select: { id: true } });
      case "families":
        return tx.equipmentFamily.findFirst({ where: { organizationId, code }, select: { id: true } });
      case "subfamilies":
        return tx.equipmentSubfamily.findFirst({ where: { organizationId, code }, select: { id: true } });
      case "types":
        return tx.equipmentType.findFirst({ where: { organizationId, code }, select: { id: true } });
      case "brands":
        return tx.equipmentBrand.findFirst({ where: { organizationId, code }, select: { id: true } });
      case "models":
        return tx.equipmentModel.findFirst({ where: { organizationId, code }, select: { id: true } });
      case "statuses":
        return tx.equipmentStatus.findFirst({ where: { organizationId, code }, select: { id: true } });
      case "owners":
        return tx.ownerEntity.findFirst({ where: { organizationId, code }, select: { id: true } });
    }
  }
}
