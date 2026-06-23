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
import { PrismaService } from "../prisma.service";
import { normalizeImportRows } from "./imports-engine";
import { readRawRows } from "./imports-storage";

type DbClient = PrismaService | Prisma.TransactionClient;

type NormalizedValues = Record<string, string | number | boolean | null>;

interface PreparedImmobilizationRow {
  rowIndex: number;
  code: string | null;
  label: string | null;
  description: string | null;
  status: string | null;
  costCenter: string | null;
  purchaseValue: Prisma.Decimal | null;
  purchaseValueReport: string | null;
  purchaseDate: Date | null;
  purchaseDateReport: string | null;
  serviceStartAt: Date | null;
  serviceStartAtReport: string | null;
  sourceSystem: string | null;
  externalRef: string | null;
  normalizedValues: NormalizedValues;
  messages: string[];
}

interface ImmobilizationCandidate extends PreparedImmobilizationRow {
  operation: "CREATE" | "UPDATE" | "REJECT";
  existingId: string | null;
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

function parseDecimalValue(value: unknown) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return { decimal: null, report: null, error: null };
  }
  try {
    const decimal = new Prisma.Decimal(normalized.replace(",", "."));
    return { decimal, report: decimal.toFixed(2), error: null };
  } catch {
    return { decimal: null, report: normalized, error: "PURCHASE_VALUE_INVALID" };
  }
}

function rowStatus(mode: ImportReportMode, operation: "CREATE" | "UPDATE" | "REJECT", messages: string[]): ImportRowStatus {
  if (operation === "REJECT") {
    return "REJECTED";
  }
  if (mode === "EXECUTE") {
    return operation === "CREATE" ? "CREATED" : "UPDATED";
  }
  return messages.length > 0 ? "WARNING" : "VALID";
}

@Injectable()
export class ImmobilizationsImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  private prepareRow(row: {
    rowIndex: number;
    normalizedValues: NormalizedValues;
    messages: string[];
  }): PreparedImmobilizationRow {
    const code = normalizeOptionalString(row.normalizedValues.code);
    const label = normalizeOptionalString(row.normalizedValues.label);
    const purchaseValue = parseDecimalValue(row.normalizedValues.purchaseValue);
    const purchaseDate = parseDateValue(row.normalizedValues.purchaseDate);
    const serviceStartAt = parseDateValue(row.normalizedValues.serviceStartAt);
    const messages = [...row.messages];

    if (!code) {
      messages.push("CODE_REQUIRED");
    }
    if (!label) {
      messages.push("LABEL_REQUIRED");
    }
    if (purchaseValue.error) {
      messages.push(purchaseValue.error);
    }
    if (purchaseDate.error) {
      messages.push("PURCHASE_DATE_INVALID");
    }
    if (serviceStartAt.error) {
      messages.push("SERVICE_START_DATE_INVALID");
    }

    return {
      rowIndex: row.rowIndex,
      code,
      label,
      description: normalizeOptionalString(row.normalizedValues.description),
      status: normalizeOptionalString(row.normalizedValues.status),
      costCenter: normalizeOptionalString(row.normalizedValues.costCenter),
      purchaseValue: purchaseValue.decimal,
      purchaseValueReport: purchaseValue.report,
      purchaseDate: purchaseDate.date,
      purchaseDateReport: purchaseDate.report,
      serviceStartAt: serviceStartAt.date,
      serviceStartAtReport: serviceStartAt.report,
      sourceSystem: normalizeOptionalString(row.normalizedValues.sourceSystem),
      externalRef: normalizeOptionalString(row.normalizedValues.externalRef),
      normalizedValues: row.normalizedValues,
      messages
    };
  }

  async buildImportReport(input: {
    organizationId: string;
    mode: ImportReportMode;
    sourceSnapshot: ImportSourceSnapshot;
    mappings: ImportMappingInput[];
  }): Promise<ImportJobReport> {
    const normalizedRows = normalizeImportRows({
      targetDomain: "immobilizations",
      rawRows: await readRawRows(input.sourceSnapshot.rawRowsRef),
      mappings: input.mappings
    });
    const preparedRows = normalizedRows.map((row) => this.prepareRow(row));
    const codeCounts = new Map<string, number>();
    for (const row of preparedRows) {
      if (row.code) {
        codeCounts.set(row.code, (codeCounts.get(row.code) ?? 0) + 1);
      }
    }

    const existing = await this.prisma.immobilization.findMany({
      where: { organizationId: input.organizationId },
      select: { id: true, code: true }
    });
    const existingByCode = new Map(existing.map((item) => [item.code, item.id]));

    const candidates: ImmobilizationCandidate[] = preparedRows.map((row) => {
      const messages = [...row.messages];
      if (row.code && (codeCounts.get(row.code) ?? 0) > 1) {
        messages.push("DUPLICATE_CODE_IN_FILE");
      }
      const existingId = row.code ? existingByCode.get(row.code) ?? null : null;
      const operation = messages.length > 0 || !row.code || !row.label
        ? "REJECT"
        : existingId
          ? "UPDATE"
          : "CREATE";
      return { ...row, messages, operation, existingId };
    });

    const rows: ImportRowReport[] = candidates.map((candidate) => ({
      rowIndex: candidate.rowIndex,
      status: rowStatus(input.mode, candidate.operation, candidate.messages),
      resolvedTargetKey: candidate.code,
      normalizedValues: {
        ...candidate.normalizedValues,
        code: candidate.code,
        label: candidate.label,
        description: candidate.description,
        status: candidate.status,
        costCenter: candidate.costCenter,
        purchaseValue: candidate.purchaseValueReport,
        purchaseDate: candidate.purchaseDateReport,
        serviceStartAt: candidate.serviceStartAtReport,
        sourceSystem: candidate.sourceSystem,
        externalRef: candidate.externalRef
      },
      messages: [
        ...candidate.messages,
        ...(candidate.operation === "REJECT" ? [] : [`OPERATION_${candidate.operation}`])
      ]
    }));
    const successfulRows = rows.filter((row) => row.status !== "REJECTED");
    return {
      mode: input.mode,
      targetDomain: "immobilizations",
      headers: input.sourceSnapshot.headers,
      mappings: input.mappings,
      summary: {
        rowsRead: rows.length,
        rowsValid: successfulRows.length,
        rowsRejected: rows.filter((row) => row.status === "REJECTED").length,
        rowsWithWarnings: rows.filter((row) => row.status === "WARNING").length,
        simulatedWrites: input.mode === "EXECUTE" ? 0 : successfulRows.length,
        appliedWrites: 0,
        executionMode: input.mode,
        targetDomain: "immobilizations"
      },
      rows
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
      for (const row of input.report.rows.filter((item) => item.status !== "REJECTED")) {
        const code = normalizeOptionalString(row.normalizedValues.code);
        const label = normalizeOptionalString(row.normalizedValues.label);
        if (!code || !label) {
          throw new BadRequestException("Immobilization import row is missing code or label");
        }
        const purchaseValue = parseDecimalValue(row.normalizedValues.purchaseValue);
        const purchaseDate = parseDateValue(row.normalizedValues.purchaseDate);
        const serviceStartAt = parseDateValue(row.normalizedValues.serviceStartAt);
        if (purchaseValue.error || purchaseDate.error || serviceStartAt.error) {
          throw new BadRequestException("Immobilization import row contains invalid values");
        }
        const data = {
          organizationId: input.organizationId,
          code,
          label,
          description: normalizeOptionalString(row.normalizedValues.description),
          status: normalizeOptionalString(row.normalizedValues.status),
          costCenter: normalizeOptionalString(row.normalizedValues.costCenter),
          purchaseValue: purchaseValue.decimal,
          purchaseDate: purchaseDate.date,
          serviceStartAt: serviceStartAt.date,
          sourceSystem: normalizeOptionalString(row.normalizedValues.sourceSystem),
          externalRef: normalizeOptionalString(row.normalizedValues.externalRef)
        };
        const existing = await tx.immobilization.findFirst({
          where: { organizationId: input.organizationId, code }
        });
        if (existing) {
          const updated = await tx.immobilization.update({
            where: { id: existing.id },
            data
          });
          await tx.importJobWrite.create({
            data: {
              organizationId: input.organizationId,
              jobId: input.importJobId,
              targetDomain: "IMMOBILIZATIONS",
              targetEntityType: "immobilization",
              targetEntityId: updated.id,
              operation: "UPDATED",
              targetPath: code,
              payload: {
                code,
                externalRef: data.externalRef,
                sourceSystem: data.sourceSystem
              }
            }
          });
          await this.auditService.log({
            db: tx,
            organizationId: input.organizationId,
            userId: input.userId,
            action: "immobilizations.import.updated",
            entityType: "immobilization",
            entityId: updated.id,
            metadata: { code }
          });
        } else {
          const created = await tx.immobilization.create({
            data: {
              ...data,
              initializedByImportJobId: input.importJobId
            }
          });
          await tx.importJobWrite.create({
            data: {
              organizationId: input.organizationId,
              jobId: input.importJobId,
              targetDomain: "IMMOBILIZATIONS",
              targetEntityType: "immobilization",
              targetEntityId: created.id,
              operation: "CREATED",
              targetPath: code,
              payload: {
                code,
                externalRef: data.externalRef,
                sourceSystem: data.sourceSystem
              }
            }
          });
          await this.auditService.log({
            db: tx,
            organizationId: input.organizationId,
            userId: input.userId,
            action: "immobilizations.import.created",
            entityType: "immobilization",
            entityId: created.id,
            metadata: { code }
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
      const immobilizations = await tx.immobilization.findMany({
        where: {
          organizationId: input.organizationId,
          id: { in: createdIds }
        },
        select: { id: true, code: true }
      });
      const presentIds = new Set(immobilizations.map((item) => item.id));
      const linkedEquipments = await tx.equipment.findMany({
        where: {
          organizationId: input.organizationId,
          immobilizationId: { in: immobilizations.map((item) => item.id) }
        },
        select: { id: true, internalCode: true, immobilizationId: true }
      });
      if (linkedEquipments.length > 0) {
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
            blockedNodes: linkedEquipments.length
          },
          blocked: linkedEquipments.map((equipment) => ({
            entityType: "immobilization",
            entityId: equipment.immobilizationId ?? "",
            targetKey: equipment.internalCode,
            path: equipment.internalCode,
            reason: "HAS_LINKED_EQUIPMENTS"
          }))
        };
      }
      if (immobilizations.length === 0) {
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
      const deleted = await tx.immobilization.deleteMany({
        where: {
          organizationId: input.organizationId,
          id: { in: immobilizations.map((item) => item.id) }
        }
      });
      await this.auditService.log({
        db: tx,
        organizationId: input.organizationId,
        userId: input.userId,
        action: "imports.job.purged_immobilizations",
        entityType: "import_job",
        entityId: input.jobId,
        metadata: {
          purgedImmobilizations: deleted.count
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
          purgedEquipments: 0,
          purgedImmobilizations: deleted.count,
          purgedMovements: 0,
          purgedAssignments: 0,
          blockedNodes: 0
        },
        blocked: []
      };
    });
  }
}
