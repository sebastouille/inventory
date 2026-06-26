import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  ImportJobReport,
  ImportJobPurgeCreatedDataResult,
  ImportMappingInput,
  ImportReportMode,
  ImportRowReport,
  ImportRowStatus,
  ImportSourceSnapshot
} from "@inventory/shared";
import { AuditService } from "../audit/audit.service";
import { equipmentInclude } from "../assets/assets.repository";
import { EquipmentMovementsService } from "../equipment-movements/equipment-movements.service";
import { PrismaService } from "../prisma.service";
import { normalizeImportRows } from "./imports-engine";
import { readRawRows } from "./imports-storage";

type DbClient = PrismaService | Prisma.TransactionClient;
type NormalizedValues = Record<string, string | number | boolean | null>;
type EquipmentState = Prisma.EquipmentGetPayload<{ include: typeof equipmentInclude }>;

interface EquipmentReferenceState {
  typesByCode: Map<string, { id: string; code: string; isActive: boolean }>;
  modelsByCode: Map<string, { id: string; code: string; isActive: boolean }>;
  statusesByCode: Map<string, { id: string; code: string; isActive: boolean }>;
  ownersByCode: Map<string, { id: string; code: string; isActive: boolean }>;
  immobilizationsByCode: Map<string, { id: string; code: string; isActive: boolean }>;
  spatialByPath: Map<string, { id: string; path: string; isActive: boolean }>;
  spatialByExternalRef: Map<string, { id: string; externalRef: string | null; isActive: boolean }[]>;
  spatialByCode: Map<string, { id: string; code: string; isActive: boolean }[]>;
  equipmentsByInternalCode: Map<string, ExistingEquipmentForImport>;
  equipmentsBySerialNumber: Map<string, { id: string; internalCode: string; serialNumber: string | null }>;
}

type ExistingEquipmentForImport = {
  id: string;
  internalCode: string;
  numPiece: string | null;
  externalRef: string | null;
  serialNumber: string | null;
  equipmentTypeId: string;
  equipmentModelId: string | null;
  equipmentStatusId: string;
  ownerEntityId: string;
  currentSpatialNodeId: string | null;
  immobilizationId: string | null;
  technicalCharacteristics: string | null;
  geometrySource: string | null;
  geometryMetadata: Prisma.JsonValue | null;
  worldCenterX: number | null;
  worldCenterY: number | null;
  worldCenterZ: number | null;
  worldSizeX: number | null;
  worldSizeY: number | null;
  worldSizeZ: number | null;
  notes: string | null;
  receivedAt: Date | null;
  commissionedAt: Date | null;
  lastInventoryAt: Date | null;
  isDeleted: boolean;
};

interface PreparedEquipmentRow {
  rowIndex: number;
  internalCode: string | null;
  numPiece: string | null;
  externalRef: string | null;
  serialNumber: string | null;
  equipmentTypeCode: string | null;
  equipmentModelCode: string | null;
  equipmentStatusCode: string | null;
  ownerEntityCode: string | null;
  currentSpatialPath: string | null;
  currentSpatialExternalRef: string | null;
  currentSpatialCode: string | null;
  immobilizationCode: string | null;
  technicalCharacteristics: string | null;
  geometrySource: string | null;
  geometryMetadata: Prisma.InputJsonValue | null;
  worldCenterX: number | null;
  worldCenterY: number | null;
  worldCenterZ: number | null;
  worldSizeX: number | null;
  worldSizeY: number | null;
  worldSizeZ: number | null;
  notes: string | null;
  receivedAt: Date | null;
  receivedAtReport: string | null;
  commissionedAt: Date | null;
  commissionedAtReport: string | null;
  lastInventoryAt: Date | null;
  lastInventoryAtReport: string | null;
  normalizedValues: NormalizedValues;
  messages: string[];
}

interface EquipmentCandidate extends PreparedEquipmentRow {
  operation: "CREATE" | "UPDATE" | "NO_OP" | "REJECT";
  existingId: string | null;
  equipmentTypeId: string | null;
  equipmentModelId: string | null;
  equipmentStatusId: string | null;
  ownerEntityId: string | null;
  currentSpatialNodeId: string | null;
  immobilizationId: string | null;
}

function normalizeOptionalString(value: unknown) {
  if (value == null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseExcelDateSerial(value: string) {
  if (!/^\d+(\.\d+)?$/.test(value.trim())) {
    return null;
  }
  const serial = Number(value);
  if (!Number.isFinite(serial) || serial <= 0) {
    return null;
  }
  const epoch = Date.UTC(1899, 11, 30);
  return new Date(epoch + serial * 86400000);
}

function parseDateValue(value: unknown) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return { date: null, report: null, error: null };
  }
  const excelDate = parseExcelDateSerial(normalized);
  const date = excelDate ?? new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return { date: null, report: normalized, error: "DATE_INVALID" };
  }
  return { date, report: date.toISOString(), error: null };
}

function parseOptionalNumber(value: unknown) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseJsonValue(value: unknown) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return null;
  }
  try {
    return JSON.parse(normalized) as Prisma.InputJsonValue;
  } catch {
    return { rawValue: normalized } as Prisma.InputJsonValue;
  }
}

function jsonCompareValue(value: unknown) {
  if (value == null || value === Prisma.JsonNull) {
    return "null";
  }
  return JSON.stringify(value);
}

function nullableNumberCompare(left: number | null, right: number | null) {
  return left === right || (left == null && right == null);
}

function nullableDateCompare(left: Date | null, right: Date | null) {
  return (left?.toISOString() ?? null) === (right?.toISOString() ?? null);
}

function rowStatus(mode: ImportReportMode, operation: "CREATE" | "UPDATE" | "NO_OP" | "REJECT", messages: string[]): ImportRowStatus {
  if (operation === "REJECT") {
    return "REJECTED";
  }
  if (operation === "NO_OP") {
    return "NO_OP";
  }
  if (mode === "EXECUTE") {
    return operation === "CREATE" ? "CREATED" : "UPDATED";
  }
  return messages.length > 0 ? "WARNING" : "VALID";
}

@Injectable()
export class EquipmentsImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly equipmentMovementsService: EquipmentMovementsService
  ) {}

  private async loadReferenceState(db: DbClient, organizationId: string): Promise<EquipmentReferenceState> {
    const [
      types,
      models,
      statuses,
      owners,
      immobilizations,
      spatialNodes,
      equipments
    ] = await Promise.all([
      db.equipmentType.findMany({ where: { organizationId }, select: { id: true, code: true, isActive: true } }),
      db.equipmentModel.findMany({ where: { organizationId }, select: { id: true, code: true, isActive: true } }),
      db.equipmentStatus.findMany({ where: { organizationId }, select: { id: true, code: true, isActive: true } }),
      db.ownerEntity.findMany({ where: { organizationId }, select: { id: true, code: true, isActive: true } }),
      db.immobilization.findMany({ where: { organizationId }, select: { id: true, code: true, isActive: true } }),
      db.spatialNode.findMany({
        where: { organizationId },
        select: { id: true, code: true, path: true, externalRef: true, isActive: true }
      }),
      db.equipment.findMany({
        where: { organizationId },
        select: {
          id: true,
          internalCode: true,
          numPiece: true,
          externalRef: true,
          serialNumber: true,
          equipmentTypeId: true,
          equipmentModelId: true,
          equipmentStatusId: true,
          ownerEntityId: true,
          currentSpatialNodeId: true,
          immobilizationId: true,
          technicalCharacteristics: true,
          geometrySource: true,
          geometryMetadata: true,
          worldCenterX: true,
          worldCenterY: true,
          worldCenterZ: true,
          worldSizeX: true,
          worldSizeY: true,
          worldSizeZ: true,
          notes: true,
          receivedAt: true,
          commissionedAt: true,
          lastInventoryAt: true,
          isDeleted: true
        }
      })
    ]);

    const spatialByExternalRef = new Map<string, { id: string; externalRef: string | null; isActive: boolean }[]>();
    const spatialByCode = new Map<string, { id: string; code: string; isActive: boolean }[]>();
    for (const node of spatialNodes) {
      if (node.externalRef) {
        spatialByExternalRef.set(node.externalRef, [...(spatialByExternalRef.get(node.externalRef) ?? []), node]);
      }
      spatialByCode.set(node.code, [...(spatialByCode.get(node.code) ?? []), node]);
    }

    return {
      typesByCode: new Map(types.map((item) => [item.code, item])),
      modelsByCode: new Map(models.map((item) => [item.code, item])),
      statusesByCode: new Map(statuses.map((item) => [item.code, item])),
      ownersByCode: new Map(owners.map((item) => [item.code, item])),
      immobilizationsByCode: new Map(immobilizations.map((item) => [item.code, item])),
      spatialByPath: new Map(spatialNodes.map((item) => [item.path, item])),
      spatialByExternalRef,
      spatialByCode,
      equipmentsByInternalCode: new Map(equipments.map((item) => [item.internalCode, item])),
      equipmentsBySerialNumber: new Map(equipments.filter((item) => item.serialNumber).map((item) => [item.serialNumber!, item]))
    };
  }

  private prepareRow(row: {
    rowIndex: number;
    normalizedValues: NormalizedValues;
    messages: string[];
  }): PreparedEquipmentRow {
    const receivedAt = parseDateValue(row.normalizedValues.receivedAt);
    const commissionedAt = parseDateValue(row.normalizedValues.commissionedAt);
    const lastInventoryAt = parseDateValue(row.normalizedValues.lastInventoryAt);
    const messages = [...row.messages];
    if (receivedAt.error || commissionedAt.error || lastInventoryAt.error) {
      messages.push("DATE_INVALID");
    }

    const internalCode = normalizeOptionalString(row.normalizedValues.internalCode);
    const equipmentTypeCode = normalizeOptionalString(row.normalizedValues.equipmentTypeCode);
    const equipmentStatusCode = normalizeOptionalString(row.normalizedValues.equipmentStatusCode);
    const ownerEntityCode = normalizeOptionalString(row.normalizedValues.ownerEntityCode);
    if (!internalCode) {
      messages.push("INTERNAL_CODE_REQUIRED");
    }
    if (!equipmentTypeCode) {
      messages.push("EQUIPMENT_TYPE_REQUIRED");
    }
    if (!equipmentStatusCode) {
      messages.push("EQUIPMENT_STATUS_REQUIRED");
    }
    if (!ownerEntityCode) {
      messages.push("OWNER_ENTITY_REQUIRED");
    }

    return {
      rowIndex: row.rowIndex,
      internalCode,
      numPiece: normalizeOptionalString(row.normalizedValues.numPiece),
      externalRef: normalizeOptionalString(row.normalizedValues.externalRef),
      serialNumber: normalizeOptionalString(row.normalizedValues.serialNumber),
      equipmentTypeCode,
      equipmentModelCode: normalizeOptionalString(row.normalizedValues.equipmentModelCode),
      equipmentStatusCode,
      ownerEntityCode,
      currentSpatialPath: normalizeOptionalString(row.normalizedValues.currentSpatialPath),
      currentSpatialExternalRef: normalizeOptionalString(row.normalizedValues.currentSpatialExternalRef),
      currentSpatialCode: normalizeOptionalString(row.normalizedValues.currentSpatialCode),
      immobilizationCode: normalizeOptionalString(row.normalizedValues.immobilizationCode),
      technicalCharacteristics: normalizeOptionalString(row.normalizedValues.technicalCharacteristics),
      geometrySource: normalizeOptionalString(row.normalizedValues.geometrySource),
      geometryMetadata: parseJsonValue(row.normalizedValues.geometryMetadata),
      worldCenterX: parseOptionalNumber(row.normalizedValues.worldCenterX),
      worldCenterY: parseOptionalNumber(row.normalizedValues.worldCenterY),
      worldCenterZ: parseOptionalNumber(row.normalizedValues.worldCenterZ),
      worldSizeX: parseOptionalNumber(row.normalizedValues.worldSizeX),
      worldSizeY: parseOptionalNumber(row.normalizedValues.worldSizeY),
      worldSizeZ: parseOptionalNumber(row.normalizedValues.worldSizeZ),
      notes: normalizeOptionalString(row.normalizedValues.notes),
      receivedAt: receivedAt.date,
      receivedAtReport: receivedAt.report,
      commissionedAt: commissionedAt.date,
      commissionedAtReport: commissionedAt.report,
      lastInventoryAt: lastInventoryAt.date,
      lastInventoryAtReport: lastInventoryAt.report,
      normalizedValues: row.normalizedValues,
      messages
    };
  }

  private resolveSpatialNode(
    row: PreparedEquipmentRow,
    references: EquipmentReferenceState,
    messages: string[]
  ) {
    if (row.currentSpatialPath) {
      const node = references.spatialByPath.get(row.currentSpatialPath);
      if (!node || !node.isActive) {
        messages.push("SPATIAL_NODE_NOT_FOUND");
        return null;
      }
      return node.id;
    }
    if (row.currentSpatialExternalRef) {
      const nodes = (references.spatialByExternalRef.get(row.currentSpatialExternalRef) ?? []).filter((node) => node.isActive);
      if (nodes.length === 1) {
        return nodes[0].id;
      }
      messages.push(nodes.length > 1 ? "SPATIAL_EXTERNAL_REF_AMBIGUOUS" : "SPATIAL_NODE_NOT_FOUND");
      return null;
    }
    if (row.currentSpatialCode) {
      const nodes = (references.spatialByCode.get(row.currentSpatialCode) ?? []).filter((node) => node.isActive);
      if (nodes.length === 1) {
        return nodes[0].id;
      }
      messages.push(nodes.length > 1 ? "SPATIAL_CODE_AMBIGUOUS" : "SPATIAL_NODE_NOT_FOUND");
      return null;
    }
    return null;
  }

  private isEquipmentImportNoOp(
    existing: ExistingEquipmentForImport,
    row: PreparedEquipmentRow,
    resolved: {
      equipmentTypeId: string | null;
      equipmentModelId: string | null;
      equipmentStatusId: string | null;
      ownerEntityId: string | null;
      currentSpatialNodeId: string | null;
      immobilizationId: string | null;
    }
  ) {
    return (
      existing.numPiece === row.numPiece &&
      existing.externalRef === row.externalRef &&
      existing.serialNumber === row.serialNumber &&
      existing.equipmentTypeId === resolved.equipmentTypeId &&
      existing.equipmentModelId === resolved.equipmentModelId &&
      existing.equipmentStatusId === resolved.equipmentStatusId &&
      existing.ownerEntityId === resolved.ownerEntityId &&
      existing.currentSpatialNodeId === resolved.currentSpatialNodeId &&
      existing.immobilizationId === resolved.immobilizationId &&
      existing.technicalCharacteristics === row.technicalCharacteristics &&
      existing.notes === row.notes &&
      nullableDateCompare(existing.receivedAt, row.receivedAt) &&
      nullableDateCompare(existing.commissionedAt, row.commissionedAt) &&
      nullableDateCompare(existing.lastInventoryAt, row.lastInventoryAt) &&
      existing.geometrySource === row.geometrySource &&
      jsonCompareValue(existing.geometryMetadata) === jsonCompareValue(row.geometryMetadata) &&
      nullableNumberCompare(existing.worldCenterX, row.worldCenterX) &&
      nullableNumberCompare(existing.worldCenterY, row.worldCenterY) &&
      nullableNumberCompare(existing.worldCenterZ, row.worldCenterZ) &&
      nullableNumberCompare(existing.worldSizeX, row.worldSizeX) &&
      nullableNumberCompare(existing.worldSizeY, row.worldSizeY) &&
      nullableNumberCompare(existing.worldSizeZ, row.worldSizeZ)
    );
  }

  private buildCandidate(
    row: PreparedEquipmentRow,
    references: EquipmentReferenceState,
    internalCodeCounts: Map<string, number>,
    serialCounts: Map<string, number>
  ): EquipmentCandidate {
    const messages = [...row.messages];
    if (row.internalCode && (internalCodeCounts.get(row.internalCode) ?? 0) > 1) {
      messages.push("DUPLICATE_INTERNAL_CODE_IN_FILE");
    }
    if (row.serialNumber && (serialCounts.get(row.serialNumber) ?? 0) > 1) {
      messages.push("DUPLICATE_SERIAL_NUMBER_IN_FILE");
    }

    const existing = row.internalCode ? references.equipmentsByInternalCode.get(row.internalCode) ?? null : null;
    if (existing?.isDeleted) {
      messages.push("EQUIPMENT_ARCHIVED");
    }
    const existingBySerial = row.serialNumber ? references.equipmentsBySerialNumber.get(row.serialNumber) ?? null : null;
    if (existingBySerial && existingBySerial.id !== existing?.id) {
      messages.push("SERIAL_NUMBER_CONFLICT");
    }

    const type = row.equipmentTypeCode ? references.typesByCode.get(row.equipmentTypeCode) ?? null : null;
    if (!type || !type.isActive) {
      messages.push("EQUIPMENT_TYPE_NOT_FOUND");
    }
    const model = row.equipmentModelCode ? references.modelsByCode.get(row.equipmentModelCode) ?? null : null;
    if (row.equipmentModelCode && (!model || !model.isActive)) {
      messages.push("EQUIPMENT_MODEL_NOT_FOUND");
    }
    const status = row.equipmentStatusCode ? references.statusesByCode.get(row.equipmentStatusCode) ?? null : null;
    if (!status || !status.isActive) {
      messages.push("EQUIPMENT_STATUS_NOT_FOUND");
    }
    const owner = row.ownerEntityCode ? references.ownersByCode.get(row.ownerEntityCode) ?? null : null;
    if (!owner || !owner.isActive) {
      messages.push("OWNER_ENTITY_NOT_FOUND");
    }
    const immobilization = row.immobilizationCode
      ? references.immobilizationsByCode.get(row.immobilizationCode) ?? null
      : null;
    if (row.immobilizationCode && !immobilization) {
      messages.push("IMMOBILIZATION_NOT_FOUND");
    }
    if (immobilization && !immobilization.isActive) {
      messages.push("IMMOBILIZATION_INACTIVE");
    }
    const currentSpatialNodeId = this.resolveSpatialNode(row, references, messages);
    const resolvedIds = {
      equipmentTypeId: type?.id ?? null,
      equipmentModelId: model?.id ?? null,
      equipmentStatusId: status?.id ?? null,
      ownerEntityId: owner?.id ?? null,
      currentSpatialNodeId,
      immobilizationId: immobilization?.id ?? null
    };
    const operation = messages.length > 0 || !row.internalCode || !type || !status || !owner
      ? "REJECT"
      : existing
        ? this.isEquipmentImportNoOp(existing, row, resolvedIds)
          ? "NO_OP"
          : "UPDATE"
        : "CREATE";

    return {
      ...row,
      messages,
      operation,
      existingId: existing?.id ?? null,
      ...resolvedIds
    };
  }

  async buildImportReport(input: {
    organizationId: string;
    mode: ImportReportMode;
    sourceSnapshot: ImportSourceSnapshot;
    mappings: ImportMappingInput[];
  }): Promise<ImportJobReport> {
    const normalizedRows = normalizeImportRows({
      targetDomain: "equipments",
      rawRows: await readRawRows(input.sourceSnapshot.rawRowsRef),
      mappings: input.mappings
    });
    const preparedRows = normalizedRows.map((row) => this.prepareRow(row));
    const internalCodeCounts = new Map<string, number>();
    const serialCounts = new Map<string, number>();
    for (const row of preparedRows) {
      if (row.internalCode) {
        internalCodeCounts.set(row.internalCode, (internalCodeCounts.get(row.internalCode) ?? 0) + 1);
      }
      if (row.serialNumber) {
        serialCounts.set(row.serialNumber, (serialCounts.get(row.serialNumber) ?? 0) + 1);
      }
    }
    const references = await this.loadReferenceState(this.prisma, input.organizationId);
    const candidates = preparedRows.map((row) => this.buildCandidate(row, references, internalCodeCounts, serialCounts));
    const rows: ImportRowReport[] = candidates.map((candidate) => ({
      rowIndex: candidate.rowIndex,
      status: rowStatus(input.mode, candidate.operation, candidate.messages),
      resolvedTargetKey: candidate.internalCode,
      normalizedValues: {
        ...candidate.normalizedValues,
        internalCode: candidate.internalCode,
        numPiece: candidate.numPiece,
        externalRef: candidate.externalRef,
        serialNumber: candidate.serialNumber,
        equipmentTypeCode: candidate.equipmentTypeCode,
        equipmentModelCode: candidate.equipmentModelCode,
        equipmentStatusCode: candidate.equipmentStatusCode,
        ownerEntityCode: candidate.ownerEntityCode,
        currentSpatialPath: candidate.currentSpatialPath,
        currentSpatialExternalRef: candidate.currentSpatialExternalRef,
        currentSpatialCode: candidate.currentSpatialCode,
        currentSpatialNodeId: candidate.currentSpatialNodeId,
        immobilizationCode: candidate.immobilizationCode,
        immobilizationId: candidate.immobilizationId,
        technicalCharacteristics: candidate.technicalCharacteristics,
        geometrySource: candidate.geometrySource,
        geometryMetadata: candidate.geometryMetadata ? JSON.stringify(candidate.geometryMetadata) : null,
        worldCenterX: candidate.worldCenterX,
        worldCenterY: candidate.worldCenterY,
        worldCenterZ: candidate.worldCenterZ,
        worldSizeX: candidate.worldSizeX,
        worldSizeY: candidate.worldSizeY,
        worldSizeZ: candidate.worldSizeZ,
        notes: candidate.notes,
        receivedAt: candidate.receivedAtReport,
        commissionedAt: candidate.commissionedAtReport,
        lastInventoryAt: candidate.lastInventoryAtReport
      },
      messages: [
        ...candidate.messages,
        ...(candidate.operation === "REJECT" ? [] : [`OPERATION_${candidate.operation}`])
      ]
    }));
    const successfulRows = rows.filter((row) => row.status !== "REJECTED");
    const writableRows = rows.filter((row) => !["REJECTED", "NO_OP", "SKIPPED"].includes(row.status));
    return {
      mode: input.mode,
      targetDomain: "equipments",
      headers: input.sourceSnapshot.headers,
      mappings: input.mappings,
      summary: {
        rowsRead: rows.length,
        rowsValid: successfulRows.length,
        rowsRejected: rows.filter((row) => row.status === "REJECTED").length,
        rowsWithWarnings: rows.filter((row) => row.status === "WARNING").length,
        simulatedWrites: input.mode === "EXECUTE" ? 0 : writableRows.length,
        appliedWrites: 0,
        executionMode: input.mode,
        targetDomain: "equipments"
      },
      rows
    };
  }

  private buildEquipmentData(input: {
    organizationId: string;
    row: ImportRowReport;
    references: EquipmentReferenceState;
  }) {
    const prepared = this.prepareRow({
      rowIndex: input.row.rowIndex,
      normalizedValues: input.row.normalizedValues,
      messages: []
    });
    const candidate = this.buildCandidate(prepared, input.references, new Map([[prepared.internalCode ?? "", 1]]), new Map());
    if (
      candidate.operation === "REJECT" ||
      !candidate.internalCode ||
      !candidate.equipmentTypeId ||
      !candidate.equipmentStatusId ||
      !candidate.ownerEntityId
    ) {
      throw new BadRequestException(`Equipment import row ${input.row.rowIndex} is invalid`);
    }
    const geometryData = candidate.geometrySource
      ? {
          geometrySource: candidate.geometrySource,
          geometryMetadata: candidate.geometryMetadata ?? Prisma.JsonNull,
          worldCenterX: candidate.worldCenterX,
          worldCenterY: candidate.worldCenterY,
          worldCenterZ: candidate.worldCenterZ,
          worldSizeX: candidate.worldSizeX,
          worldSizeY: candidate.worldSizeY,
          worldSizeZ: candidate.worldSizeZ,
          geometryUpdatedAt: new Date()
        }
      : {};
    return {
      candidate,
      data: {
        organizationId: input.organizationId,
        internalCode: candidate.internalCode,
        numPiece: candidate.numPiece,
        externalRef: candidate.externalRef,
        serialNumber: candidate.serialNumber,
        equipmentTypeId: candidate.equipmentTypeId,
        equipmentModelId: candidate.equipmentModelId,
        equipmentStatusId: candidate.equipmentStatusId,
        ownerEntityId: candidate.ownerEntityId,
        currentSpatialNodeId: candidate.currentSpatialNodeId,
        immobilizationId: candidate.immobilizationId,
        technicalCharacteristics: candidate.technicalCharacteristics,
        ...geometryData,
        notes: candidate.notes,
        receivedAt: candidate.receivedAt,
        commissionedAt: candidate.commissionedAt,
        lastInventoryAt: candidate.lastInventoryAt
      }
    };
  }

  async executeImportReport(input: {
    db?: Prisma.TransactionClient;
    organizationId: string;
    report: ImportJobReport;
    importJobId: string;
    userId?: string | null;
  }) {
    const run = async (tx: Prisma.TransactionClient) => {
      let appliedWrites = 0;
      for (const row of input.report.rows.filter((item) => !["REJECTED", "NO_OP", "SKIPPED"].includes(item.status))) {
        const references = await this.loadReferenceState(tx, input.organizationId);
        const { candidate, data } = this.buildEquipmentData({
          organizationId: input.organizationId,
          row,
          references
        });
        const existing = candidate.existingId
          ? await tx.equipment.findFirst({
              where: { id: candidate.existingId, organizationId: input.organizationId },
              include: equipmentInclude
            })
          : null;
        let after: EquipmentState | null = null;
        let entityId: string;
        if (existing) {
          const updated = await tx.equipment.update({
            where: { id: existing.id },
            data
          });
          entityId = updated.id;
          after = await tx.equipment.findFirst({
            where: { id: updated.id, organizationId: input.organizationId },
            include: equipmentInclude
          });
          await tx.importJobWrite.create({
            data: {
              organizationId: input.organizationId,
              jobId: input.importJobId,
              targetDomain: "EQUIPMENTS",
              targetEntityType: "equipment",
              targetEntityId: updated.id,
              operation: "UPDATED",
              targetPath: candidate.internalCode,
              payload: {
                internalCode: candidate.internalCode,
                numPiece: candidate.numPiece,
                externalRef: candidate.externalRef,
                currentSpatialNodeId: candidate.currentSpatialNodeId,
                immobilizationId: candidate.immobilizationId
              }
            }
          });
          await this.auditService.log({
            db: tx,
            organizationId: input.organizationId,
            userId: input.userId,
            action: "assets.import.updated",
            entityType: "equipment",
            entityId: updated.id,
            metadata: { internalCode: candidate.internalCode, numPiece: candidate.numPiece, externalRef: candidate.externalRef }
          });
        } else {
          const created = await tx.equipment.create({
            data: {
              ...data,
              initializedByImportJobId: input.importJobId
            }
          });
          entityId = created.id;
          after = await tx.equipment.findFirst({
            where: { id: created.id, organizationId: input.organizationId },
            include: equipmentInclude
          });
          await tx.importJobWrite.create({
            data: {
              organizationId: input.organizationId,
              jobId: input.importJobId,
              targetDomain: "EQUIPMENTS",
              targetEntityType: "equipment",
              targetEntityId: created.id,
              operation: "CREATED",
              targetPath: candidate.internalCode,
              payload: {
                internalCode: candidate.internalCode,
                numPiece: candidate.numPiece,
                externalRef: candidate.externalRef,
                currentSpatialNodeId: candidate.currentSpatialNodeId,
                immobilizationId: candidate.immobilizationId
              }
            }
          });
          await this.auditService.log({
            db: tx,
            organizationId: input.organizationId,
            userId: input.userId,
            action: "assets.import.created",
            entityType: "equipment",
            entityId: created.id,
            metadata: { internalCode: candidate.internalCode, numPiece: candidate.numPiece, externalRef: candidate.externalRef }
          });
        }
        if (after) {
          await this.equipmentMovementsService.recordForAssetMutation(tx, {
            organizationId: input.organizationId,
            equipmentId: entityId,
            createdById: input.userId,
            source: "IMPORT",
            triggerType: existing ? "IMPORT_EXECUTED" : "IMPORT_EXECUTED",
            before: existing,
            after
          });
        }
        appliedWrites += 1;
      }
      return appliedWrites;
    };
    return input.db ? run(input.db) : this.prisma.$transaction(run);
  }

  async purgeCreatedDataForImportJob(input: {
    organizationId: string;
    userId?: string | null;
    jobId: string;
    writes: Array<{
      operation: "CREATED" | "UPDATED";
      targetEntityId: string;
      targetPath: string | null;
    }>;
  }): Promise<ImportJobPurgeCreatedDataResult> {
    const createdIds = input.writes.filter((write) => write.operation === "CREATED").map((write) => write.targetEntityId);
    const updatedCount = input.writes.filter((write) => write.operation === "UPDATED").length;
    if (createdIds.length === 0) {
      return {
        status: "NO_OP",
        summary: {
          trackedCreated: 0,
          trackedUpdated: updatedCount,
          alreadyMissing: 0,
          purgedNodes: 0,
          purgedScopes: 0,
          purgedEquipments: 0,
          purgedImmobilizations: 0,
          purgedMovements: 0,
          purgedAssignments: 0,
          blockedNodes: 0
        },
        blocked: []
      };
    }

    return this.prisma.$transaction(async (tx) => {
      const equipments = await tx.equipment.findMany({
        where: {
          organizationId: input.organizationId,
          id: { in: createdIds }
        },
        select: { id: true, internalCode: true }
      });
      const presentIds = new Set(equipments.map((item) => item.id));
      const externalAssignments = await tx.equipmentAssignment.findMany({
        where: {
          organizationId: input.organizationId,
          targetEquipmentId: { in: equipments.map((item) => item.id) },
          equipmentId: { notIn: equipments.map((item) => item.id) },
          endsAt: null
        },
        select: {
          id: true,
          targetEquipmentId: true,
          equipment: { select: { internalCode: true } }
        }
      });
      if (externalAssignments.length > 0) {
        return {
          status: "BLOCKED",
          summary: {
            trackedCreated: createdIds.length,
            trackedUpdated: updatedCount,
            alreadyMissing: createdIds.length - presentIds.size,
            purgedNodes: 0,
            purgedScopes: 0,
            purgedEquipments: 0,
            purgedImmobilizations: 0,
            purgedMovements: 0,
            purgedAssignments: 0,
            blockedNodes: externalAssignments.length
          },
          blocked: externalAssignments.map((assignment) => ({
            entityType: "equipment",
            entityId: assignment.targetEquipmentId ?? "",
            targetKey: assignment.equipment.internalCode,
            path: assignment.equipment.internalCode,
            reason: "HAS_EXTERNAL_ASSIGNMENTS"
          }))
        };
      }
      if (equipments.length === 0) {
        return {
          status: "NO_OP",
          summary: {
            trackedCreated: createdIds.length,
            trackedUpdated: updatedCount,
            alreadyMissing: createdIds.length,
            purgedNodes: 0,
            purgedScopes: 0,
            purgedEquipments: 0,
            purgedImmobilizations: 0,
            purgedMovements: 0,
            purgedAssignments: 0,
            blockedNodes: 0
          },
          blocked: []
        };
      }

      const movementDelete = await tx.equipmentMovement.deleteMany({
        where: {
          organizationId: input.organizationId,
          equipmentId: { in: equipments.map((item) => item.id) }
        }
      });
      const assignmentDelete = await tx.equipmentAssignment.deleteMany({
        where: {
          organizationId: input.organizationId,
          OR: [
            { equipmentId: { in: equipments.map((item) => item.id) } },
            { targetEquipmentId: { in: equipments.map((item) => item.id) } }
          ]
        }
      });
      const equipmentDelete = await tx.equipment.deleteMany({
        where: {
          organizationId: input.organizationId,
          id: { in: equipments.map((item) => item.id) }
        }
      });
      await this.auditService.log({
        db: tx,
        organizationId: input.organizationId,
        userId: input.userId,
        action: "imports.job.purged_equipments",
        entityType: "import_job",
        entityId: input.jobId,
        metadata: {
          purgedEquipments: equipmentDelete.count,
          purgedMovements: movementDelete.count,
          purgedAssignments: assignmentDelete.count
        }
      });
      return {
        status: "PURGED",
        summary: {
          trackedCreated: createdIds.length,
          trackedUpdated: updatedCount,
          alreadyMissing: createdIds.length - presentIds.size,
          purgedNodes: 0,
          purgedScopes: 0,
          purgedEquipments: equipmentDelete.count,
          purgedImmobilizations: 0,
          purgedMovements: movementDelete.count,
          purgedAssignments: assignmentDelete.count,
          blockedNodes: 0
        },
        blocked: []
      };
    });
  }
}
