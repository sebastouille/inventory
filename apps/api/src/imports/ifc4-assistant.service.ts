import { BadRequestException, Injectable, Logger, UnprocessableEntityException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type {
  Ifc4AnalysisResponse,
  Ifc4AssetReferenceOverride,
  Ifc4AssetReferenceCandidate,
  Ifc4AssetReferencesApplyResult,
  Ifc4ClassSummary,
  Ifc4GeometryPreview,
  Ifc4CreateJobResponse,
  Ifc4EquipmentPropertyMappings,
  Ifc4EquipmentPreviewRow,
  Ifc4PropertyCandidate,
  Ifc4SpatialOverride,
  Ifc4SpatialPreviewNode,
  ImportMappingInput,
  ImportRowPreview,
  ImportTargetDomain
} from "@inventory/shared";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { IfcGeometryWorker, type IfcExtractObject, type IfcGeometryExtraction } from "../bim-3d/ifc-geometry-worker";
import { PrismaService } from "../prisma.service";
import { ImportsService } from "./imports.service";

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
};

type AssistantOptions = {
  selectedClasses?: string[];
  defaultStatusCode?: string;
  defaultOwnerEntityCode?: string;
  propertyMappings: Ifc4EquipmentPropertyMappings;
};

type AssistantOptionsInput = {
  selectedClasses?: unknown;
  defaultStatusCode?: unknown;
  defaultOwnerEntityCode?: unknown;
  spatialOverrides?: unknown;
  assetReferenceOverrides?: unknown;
  equipmentOptions?: unknown;
};

const DEFAULT_STATUS_CODE = "EN_SERVICE";
const DEFAULT_OWNER_CODE = "CPRP";
const DEFAULT_SELECTED_CLASSES = ["IFCFURNITURE"];
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

@Injectable()
export class Ifc4AssistantService {
  private readonly logger = new Logger(Ifc4AssistantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly importsService: ImportsService,
    private readonly auditService: AuditService,
    private readonly ifcGeometryWorker: IfcGeometryWorker
  ) {}

  async analyze(
    auth: AuthenticatedUser,
    file: { originalname: string; buffer: Buffer } | undefined,
    optionsInput?: AssistantOptionsInput
  ): Promise<Ifc4AnalysisResponse> {
    const prepared = await this.prepare(auth.organizationId, file, this.normalizeOptions(optionsInput));
    return {
      filename: file?.originalname ?? "source.ifc",
      schema: prepared.schema,
      totalEntities: prepared.totalEntities,
      classSummary: prepared.classSummary,
      propertyCandidates: prepared.propertyCandidates,
      spatialNodes: prepared.spatialNodes,
      assetReferences: prepared.assetReferenceCandidates,
      equipmentRows: prepared.equipmentRows,
      geometrySummary: prepared.geometrySummary,
      warnings: prepared.warnings
    };
  }

  async createSpatialJob(
    auth: AuthenticatedUser,
    file: { originalname: string; mimetype: string; buffer: Buffer } | undefined,
    optionsInput?: AssistantOptionsInput
  ): Promise<Ifc4CreateJobResponse> {
    const prepared = await this.prepare(auth.organizationId, file, this.normalizeOptions(optionsInput));
    this.assertGeometryReady(
      prepared.spatialNodes.map((node) => ({
        label: node.path,
        geometry: node.geometry ?? null
      }))
    );
    const spatialRows = this.applySpatialOverrides(prepared.spatialRows, this.parseSpatialOverrides(optionsInput));
    const job = await this.importsService.createPreparedJob(auth, {
      targetDomain: "spatial-nodes",
      originalFilename: file?.originalname ?? "source.ifc",
      storedMimeType: file?.mimetype ?? "application/octet-stream",
      sourceBuffer: file?.buffer ?? Buffer.from(""),
      headers: SPATIAL_HEADERS,
      rawRows: spatialRows,
      mappings: buildMappings("spatial-nodes", SPATIAL_HEADERS),
      options: {
        sourceAssistant: "IFC4"
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
    const selectedClasses = new Set(options.selectedClasses ?? DEFAULT_SELECTED_CLASSES);
    this.assertGeometryReady(
      prepared.equipmentRows
        .filter((row) => selectedClasses.has(row.sourceClass.toUpperCase()))
        .map((row) => ({
          label: row.internalCode,
          geometry: row.geometry ?? null
        }))
    );
    const rawRows = prepared.equipmentRawRows.filter((row) => {
      const sourceClass = row.values.sourceClass ?? row.values.SourceClass ?? null;
      return !sourceClass || selectedClasses.has(String(sourceClass).toUpperCase());
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
        selectedClasses: [...selectedClasses]
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

  private normalizeOptions(input?: AssistantOptionsInput): AssistantOptions {
    const equipmentOptions = parseJsonObject(input?.equipmentOptions);
    return {
      selectedClasses: parseSelectedClasses(equipmentOptions.selectedClasses ?? input?.selectedClasses),
      defaultStatusCode: normalizeCode(
        normalizeFreeText(equipmentOptions.defaultStatusCode ?? input?.defaultStatusCode),
        DEFAULT_STATUS_CODE
      ),
      defaultOwnerEntityCode: normalizeCode(
        normalizeFreeText(equipmentOptions.defaultOwnerEntityCode ?? input?.defaultOwnerEntityCode),
        DEFAULT_OWNER_CODE
      ),
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
    const extraction = await this.extractGeometry(file);
    const geometryByGlobalId = this.buildGeometryByGlobalId(extraction);
    const productProperties = this.buildProperties(parsed.entities);
    const containment = this.buildContainment(parsed.entities);
    const products = this.buildProducts(parsed.entities, productProperties);
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
      geometrySummary: this.buildGeometrySummary([...spatial.nodes.map((node) => node.geometry), ...equipment.equipmentRows.map((row) => row.geometry)]),
      warnings: [
        ...spatial.warnings,
        ...equipment.warnings
      ]
    };
  }

  private async extractGeometry(file: { originalname: string; buffer: Buffer }): Promise<IfcGeometryExtraction> {
    const directory = await mkdtemp(join(tmpdir(), "inventory-ifc-"));
    const inputPath = join(directory, file.originalname.replace(/[^a-zA-Z0-9._-]+/g, "-") || "source.ifc");
    const outputPath = join(directory, "ifcopenshell-extract.v1.json");
    try {
      this.logger.log(`Starting strict IFC4 geometry analysis filename=${file.originalname} size=${file.buffer.length}`);
      await writeFile(inputPath, file.buffer);
      const extraction = await this.ifcGeometryWorker.extract({
        sourcePath: inputPath,
        outputPath,
        timeoutMs: 120000
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

  private buildGeometrySummary(items: Array<Ifc4GeometryPreview | null | undefined>): Ifc4AnalysisResponse["geometrySummary"] {
    return {
      engine: "ifcopenshell-python",
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

  private buildProducts(entities: Map<string, IfcEntity>, productProperties: Map<string, Record<string, string>>) {
    const products = new Map<string, IfcProduct>();
    for (const entity of entities.values()) {
      if (!entity.type.startsWith("IFC")) {
        continue;
      }
      products.set(entity.id, {
        id: entity.id,
        sourceClass: entity.type,
        globalId: readString(entity.args[0]),
        name: readString(entity.args[2]),
        description: readString(entity.args[3]),
        objectType: readString(entity.args[4]),
        properties: productProperties.get(entity.id) ?? {}
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
