import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  Prisma,
  type ImportJobStatus as PrismaImportJobStatus,
  type ImportSourceKind as PrismaImportSourceKind,
  type ImportTargetDomain as PrismaImportTargetDomain
} from "@prisma/client";
import {
  IMPORT_JOB_WRITE_OPERATIONS,
  IMPORT_JOB_STATUSES,
  IMPORT_MATCH_POLICIES,
  IMPORT_REPORT_MODES,
  IMPORT_ROW_STATUSES,
  IMPORT_SOURCE_KINDS,
  IMPORT_TARGET_DOMAINS,
  IMPORT_TRANSFORM_TYPES,
  type ImportJobStatus,
  type ImportJobDetail,
  type ImportJobPurgeCreatedDataResult,
  type ImportJobLogEntry,
  type ImportMatchPolicy,
  type ImportJobReport,
  type ImportReportMode,
  type ImportRowPreview,
  type ImportRowStatus,
  type ImportJobSummary,
  type ImportJobWriteOperation,
  type ImportJobWriteSummary,
  type ImportMappingInput,
  type ImportProfileDetail,
  type ImportProfileSummary,
  type ImportSourceKind,
  type ImportSourceSnapshot,
  type ImportTargetDomain,
  type ImportTransformType
} from "@inventory/shared";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { matchesSearchTerm, normalizeSearchTerm, paginateItems, sortItems } from "../common/listing";
import { PrismaService } from "../prisma.service";
import { SpatialService } from "../spatial/spatial.service";
import { CreateImportJobDto } from "./dto/create-import-job.dto";
import { CreateImportProfileDto } from "./dto/create-import-profile.dto";
import { ListImportJobsDto } from "./dto/list-import-jobs.dto";
import { ListImportProfilesDto } from "./dto/list-import-profiles.dto";
import { RunImportJobDto } from "./dto/run-import-job.dto";
import { UpdateImportProfileDto } from "./dto/update-import-profile.dto";
import { UploadImportJobDto } from "./dto/upload-import-job.dto";
import {
  buildImportReport,
  getTargetFieldCatalog,
  parseImportBuffer,
  validateMappingSet
} from "./imports-engine";
import {
  persistImportSourceFile,
  persistImportSourcePath,
  persistRawRows,
  readRawRows,
  removeImportJobArtifacts
} from "./imports-storage";
import { EquipmentsImportService } from "./equipments-import.service";
import { ImmobilizationsImportService } from "./immobilizations-import.service";

const JSON_NULL = Prisma.JsonNull;

const IMPORT_TARGET_DOMAIN_TO_DB: Record<ImportTargetDomain, PrismaImportTargetDomain> = {
  "ifc4-analysis": "IFC4_ANALYSIS",
  "spatial-nodes": "SPATIAL_NODES",
  equipments: "EQUIPMENTS",
  immobilizations: "IMMOBILIZATIONS"
};

const IMPORT_TARGET_DOMAIN_FROM_DB: Record<PrismaImportTargetDomain, ImportTargetDomain> = {
  IFC4_ANALYSIS: "ifc4-analysis",
  SPATIAL_NODES: "spatial-nodes",
  EQUIPMENTS: "equipments",
  IMMOBILIZATIONS: "immobilizations"
};

function toDbTargetDomain(targetDomain: ImportTargetDomain): PrismaImportTargetDomain {
  return IMPORT_TARGET_DOMAIN_TO_DB[targetDomain];
}

function fromDbTargetDomain(targetDomain: PrismaImportTargetDomain): ImportTargetDomain {
  return IMPORT_TARGET_DOMAIN_FROM_DB[targetDomain];
}

function isImportTargetDomain(value: unknown): value is ImportTargetDomain {
  return typeof value === "string" && IMPORT_TARGET_DOMAINS.includes(value as ImportTargetDomain);
}

function isImportJobWriteOperation(value: unknown): value is ImportJobWriteOperation {
  return typeof value === "string" && IMPORT_JOB_WRITE_OPERATIONS.includes(value as ImportJobWriteOperation);
}

function isImportSourceKind(value: unknown): value is ImportSourceKind {
  return typeof value === "string" && IMPORT_SOURCE_KINDS.includes(value as ImportSourceKind);
}

function isImportJobStatus(value: unknown): value is ImportJobStatus {
  return typeof value === "string" && IMPORT_JOB_STATUSES.includes(value as ImportJobStatus);
}

function isImportTransformType(value: unknown): value is ImportTransformType {
  return typeof value === "string" && IMPORT_TRANSFORM_TYPES.includes(value as ImportTransformType);
}

function isImportMatchPolicy(value: unknown): value is ImportMatchPolicy {
  return typeof value === "string" && IMPORT_MATCH_POLICIES.includes(value as ImportMatchPolicy);
}

function isImportReportMode(value: unknown): value is ImportReportMode {
  return typeof value === "string" && IMPORT_REPORT_MODES.includes(value as ImportReportMode);
}

function isImportRowStatus(value: unknown): value is ImportRowStatus {
  return typeof value === "string" && IMPORT_ROW_STATUSES.includes(value as ImportRowStatus);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly spatialService: SpatialService,
    private readonly equipmentsImportService: EquipmentsImportService,
    private readonly immobilizationsImportService: ImmobilizationsImportService
  ) {}

  private parseMappings(value: Prisma.JsonValue | null | undefined): ImportMappingInput[] {
    if (!Array.isArray(value)) {
      return [];
    }
    const mappings: ImportMappingInput[] = [];
    for (const item of value) {
      if (!isRecord(item)) {
        continue;
      }
      mappings.push({
        sourceColumn: typeof item.sourceColumn === "string" ? item.sourceColumn : "",
        targetField: typeof item.targetField === "string" ? item.targetField : "",
        transformType: isImportTransformType(item.transformType) ? item.transformType : "IDENTITY",
        transformConfig: isRecord(item.transformConfig) ? item.transformConfig : null,
        isRequired: typeof item.isRequired === "boolean" ? item.isRequired : undefined,
        matchPolicy: isImportMatchPolicy(item.matchPolicy) ? item.matchPolicy : null
      });
    }
    return mappings;
  }

  private parseOptions(value: Prisma.JsonValue | null | undefined): Record<string, unknown> | null {
    return isRecord(value) ? value : null;
  }

  private parseSourceSnapshot(value: Prisma.JsonValue | null | undefined): ImportSourceSnapshot | null {
    if (!isRecord(value)) {
      return null;
    }
    if (!Array.isArray(value.headers) || !Array.isArray(value.sheetNames) || !Array.isArray(value.previewRows)) {
      return null;
    }
    return {
      sheetNames: value.sheetNames.filter((item): item is string => typeof item === "string"),
      selectedSheetName: typeof value.selectedSheetName === "string" ? value.selectedSheetName : "",
      headerRowIndex: typeof value.headerRowIndex === "number" ? value.headerRowIndex : 1,
      headers: value.headers.filter((item): item is string => typeof item === "string"),
      rowCount: typeof value.rowCount === "number" ? value.rowCount : 0,
      previewRows: value.previewRows.flatMap((item) => {
        if (!isRecord(item)) {
          return [];
        }
        return [{
          rowIndex: typeof item.rowIndex === "number" ? item.rowIndex : 0,
          values: isRecord(item.values)
            ? Object.fromEntries(
                Object.entries(item.values).map(([key, entryValue]) => [
                  key,
                  typeof entryValue === "string" ? entryValue : null
                ])
              )
            : {}
        }];
      }),
      rawRowsRef: typeof value.rawRowsRef === "string" ? value.rawRowsRef : ""
    };
  }

  private parseReport(value: Prisma.JsonValue | null | undefined): ImportJobReport | null {
    if (!isRecord(value) || !Array.isArray(value.headers) || !Array.isArray(value.mappings) || !Array.isArray(value.rows)) {
      return null;
    }
    const summary = isRecord(value.summary) ? value.summary : {};
    const targetDomain = isImportTargetDomain(value.targetDomain) ? value.targetDomain : "equipments";
    const summaryTargetDomain = isImportTargetDomain(summary.targetDomain) ? summary.targetDomain : targetDomain;
    const mode = isImportReportMode(value.mode) ? value.mode : "PREVIEW";
    const executionMode = isImportReportMode(summary.executionMode) ? summary.executionMode : "PREVIEW";
    return {
      mode,
      targetDomain,
      headers: value.headers.filter((item): item is string => typeof item === "string"),
      mappings: this.parseMappings(value.mappings as Prisma.JsonArray),
      summary: {
        rowsRead: typeof summary.rowsRead === "number" ? summary.rowsRead : 0,
        rowsValid: typeof summary.rowsValid === "number" ? summary.rowsValid : 0,
        rowsRejected: typeof summary.rowsRejected === "number" ? summary.rowsRejected : 0,
        rowsWithWarnings: typeof summary.rowsWithWarnings === "number" ? summary.rowsWithWarnings : 0,
        simulatedWrites: typeof summary.simulatedWrites === "number" ? summary.simulatedWrites : 0,
        appliedWrites: typeof summary.appliedWrites === "number" ? summary.appliedWrites : 0,
        executionMode,
        targetDomain: summaryTargetDomain
      },
      rows: value.rows.flatMap((item) => {
        if (!isRecord(item)) {
          return [];
        }
        return [{
          rowIndex: typeof item.rowIndex === "number" ? item.rowIndex : 0,
          status: isImportRowStatus(item.status) ? item.status : "REJECTED",
          resolvedTargetKey: typeof item.resolvedTargetKey === "string" ? item.resolvedTargetKey : null,
          normalizedValues: isRecord(item.normalizedValues)
            ? Object.fromEntries(
                Object.entries(item.normalizedValues).map(([key, entryValue]) => [
                  key,
                  typeof entryValue === "string" || typeof entryValue === "number" || typeof entryValue === "boolean"
                    ? entryValue
                    : null
                ])
              )
            : {},
          messages: Array.isArray(item.messages)
            ? item.messages.filter((entry): entry is string => typeof entry === "string")
            : []
        }];
      })
    };
  }

  private mapProfile(profile: {
    id: string;
    organizationId: string;
    targetDomain: PrismaImportTargetDomain;
    name: string;
    sourceKind: PrismaImportSourceKind;
    sheetName: string | null;
    headerRowIndex: number;
    mappings: Prisma.JsonValue;
    options: Prisma.JsonValue | null;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): ImportProfileDetail {
    const mappings = this.parseMappings(profile.mappings);
    return {
      id: profile.id,
      organizationId: profile.organizationId,
      targetDomain: fromDbTargetDomain(profile.targetDomain),
      name: profile.name,
      sourceKind: profile.sourceKind,
      sheetName: profile.sheetName,
      headerRowIndex: profile.headerRowIndex,
      mappingsCount: mappings.length,
      options: this.parseOptions(profile.options),
      mappings,
      isArchived: profile.isArchived,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString()
    };
  }

  private mapProfileSummary(profile: Parameters<ImportsService["mapProfile"]>[0]): ImportProfileSummary {
    return this.mapProfile(profile);
  }

  private buildWriteSummary(
    writes: Array<{
      operation: string;
    }>
  ): ImportJobWriteSummary | null {
    if (writes.length === 0) {
      return null;
    }

    let createdCount = 0;
    let updatedCount = 0;
    for (const write of writes) {
      if (!isImportJobWriteOperation(write.operation)) {
        continue;
      }
      if (write.operation === "CREATED") {
        createdCount += 1;
      } else if (write.operation === "UPDATED") {
        updatedCount += 1;
      }
    }

    return {
      createdCount,
      updatedCount
    };
  }

  private mapJob(job: {
    id: string;
    organizationId: string;
    profileId: string | null;
    targetDomain: PrismaImportTargetDomain;
    sourceKind: PrismaImportSourceKind | null;
    status: PrismaImportJobStatus;
    originalFilename: string | null;
    sheetName: string | null;
    sourceSnapshot: Prisma.JsonValue | null;
    mappings: Prisma.JsonValue | null;
    options: Prisma.JsonValue | null;
    summary: Prisma.JsonValue | null;
    report: Prisma.JsonValue | null;
    writes?: Array<{
      operation: string;
    }>;
    createdAt: Date;
    updatedAt: Date;
  }): ImportJobDetail {
    const parsedReport = this.parseReport(job.report);
    const parsedSummary = isRecord(job.summary) ? job.summary : null;
    const targetDomain = fromDbTargetDomain(job.targetDomain);
    const sourceKind = isImportSourceKind(job.sourceKind) ? job.sourceKind : null;
    const status = isImportJobStatus(job.status) ? job.status : "DRAFT";
    return {
      id: job.id,
      organizationId: job.organizationId,
      profileId: job.profileId,
      targetDomain,
      sourceKind,
      status,
      originalFilename: job.originalFilename,
      sheetName: job.sheetName,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      writeSummary: this.buildWriteSummary(job.writes ?? []),
      sourceSnapshot: this.parseSourceSnapshot(job.sourceSnapshot),
      mappings: this.parseMappings(job.mappings),
      options: this.parseOptions(job.options),
      summary:
        parsedSummary && typeof parsedSummary.rowsRead === "number"
          ? {
              rowsRead: typeof parsedSummary.rowsRead === "number" ? parsedSummary.rowsRead : 0,
              rowsValid: typeof parsedSummary.rowsValid === "number" ? parsedSummary.rowsValid : 0,
              rowsRejected: typeof parsedSummary.rowsRejected === "number" ? parsedSummary.rowsRejected : 0,
              rowsWithWarnings:
                typeof parsedSummary.rowsWithWarnings === "number" ? parsedSummary.rowsWithWarnings : 0,
              simulatedWrites:
                typeof parsedSummary.simulatedWrites === "number" ? parsedSummary.simulatedWrites : 0,
              appliedWrites: typeof parsedSummary.appliedWrites === "number" ? parsedSummary.appliedWrites : 0,
              executionMode:
                isImportReportMode(parsedSummary.executionMode) ? parsedSummary.executionMode : "PREVIEW",
              targetDomain:
                isImportTargetDomain(parsedSummary.targetDomain) ? parsedSummary.targetDomain : targetDomain
            }
          : null,
      report: parsedReport
    };
  }

  private mapJobSummary(job: Parameters<ImportsService["mapJob"]>[0]): ImportJobSummary {
    return this.mapJob(job);
  }

  private async getWriteSummaryMap(organizationId: string, jobIds: string[]) {
    if (jobIds.length === 0) {
      return new Map<string, ImportJobWriteSummary | null>();
    }

    const writes = await this.prisma.importJobWrite.findMany({
      where: {
        organizationId,
        jobId: {
          in: jobIds
        }
      },
      select: {
        jobId: true,
        operation: true
      }
    });

    const grouped = new Map<string, Array<{ operation: string }>>();
    for (const write of writes) {
      const current = grouped.get(write.jobId) ?? [];
      current.push({ operation: write.operation });
      grouped.set(write.jobId, current);
    }

    const summaryMap = new Map<string, ImportJobWriteSummary | null>();
    for (const jobId of jobIds) {
      summaryMap.set(jobId, this.buildWriteSummary(grouped.get(jobId) ?? []));
    }
    return summaryMap;
  }

  private validateProfileInput(targetDomain: ImportTargetDomain, mappings: ImportMappingInput[]) {
    const errors = validateMappingSet(targetDomain, mappings);
    if (errors.length > 0) {
      throw new BadRequestException(errors.join(" | "));
    }
  }

  private async getProfileOrThrow(organizationId: string, profileId: string) {
    const profile = await this.prisma.importProfile.findFirst({
      where: {
        id: profileId,
        organizationId
      }
    });
    if (!profile) {
      throw new NotFoundException("Import profile not found");
    }
    return profile;
  }

  private async getJobOrThrow(organizationId: string, jobId: string) {
    const job = await this.prisma.importJob.findFirst({
      where: {
        id: jobId,
        organizationId
      }
    });
    if (!job) {
      throw new NotFoundException("Import job not found");
    }
    return job;
  }

  private resolveSourceKind(originalFilename: string, requestedSourceKind?: ImportSourceKind | null) {
    if (requestedSourceKind) {
      return requestedSourceKind;
    }
    const lower = originalFilename.toLowerCase();
    if (lower.endsWith(".csv")) {
      return "CSV" as const;
    }
    if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      return "XLSX" as const;
    }
    throw new BadRequestException("Unsupported import file extension");
  }

  private async resolveMappings(job: Awaited<ReturnType<ImportsService["getJobOrThrow"]>>, dto?: RunImportJobDto) {
    let targetDomain = fromDbTargetDomain(job.targetDomain);
    let mappings = this.parseMappings(job.mappings);
    let options = this.parseOptions(job.options);

    if (dto?.profileId) {
      const profile = await this.getProfileOrThrow(job.organizationId, dto.profileId);
      targetDomain = fromDbTargetDomain(profile.targetDomain);
      mappings = this.parseMappings(profile.mappings);
      options = this.parseOptions(profile.options);
    }

    if (dto?.overrideMappings?.length) {
      mappings = dto.overrideMappings;
    }

    if (dto?.options && isRecord(dto.options)) {
      options = dto.options;
    }

    this.validateProfileInput(targetDomain, mappings);
    return {
      targetDomain,
      mappings,
      options
    };
  }

  async listProfiles(organizationId: string, query: ListImportProfilesDto) {
    const profiles = await this.prisma.importProfile.findMany({
      where: {
        organizationId
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    const search = normalizeSearchTerm(query.q);
    const filtered = profiles
      .filter((profile) => {
        if (query.targetDomain && profile.targetDomain !== toDbTargetDomain(query.targetDomain)) {
          return false;
        }
        if (query.isArchived && String(profile.isArchived) !== query.isArchived) {
          return false;
        }
        return matchesSearchTerm(search, [profile.name, fromDbTargetDomain(profile.targetDomain), profile.sheetName]);
      })
      .map((profile) => this.mapProfileSummary(profile));

    const sorted = sortItems(
      filtered,
      {
        name: (item: ImportProfileSummary) => item.name,
        targetDomain: (item: ImportProfileSummary) => item.targetDomain,
        createdAt: (item: ImportProfileSummary) => item.createdAt,
        updatedAt: (item: ImportProfileSummary) => item.updatedAt
      }[query.sort ?? "createdAt"],
      query.direction ?? "desc"
    );

    return paginateItems(sorted, query.page, query.pageSize);
  }

  async createProfile(auth: AuthenticatedUser, dto: CreateImportProfileDto) {
    this.validateProfileInput(dto.targetDomain, dto.mappings);
    const created = await this.prisma.importProfile.create({
      data: {
        organizationId: auth.organizationId,
        targetDomain: toDbTargetDomain(dto.targetDomain),
        name: dto.name.trim(),
        sourceKind: dto.sourceKind,
        sheetName: dto.sheetName?.trim() || null,
        headerRowIndex: dto.headerRowIndex,
        mappings: dto.mappings as unknown as Prisma.InputJsonValue,
        options: dto.options ? (dto.options as Prisma.InputJsonValue) : JSON_NULL,
        createdById: auth.sub
      }
    });

    await this.auditService.log({
      organizationId: auth.organizationId,
      userId: auth.sub,
      action: "imports.profile.created",
      entityType: "import_profile",
      entityId: created.id,
      metadata: {
        targetDomain: dto.targetDomain,
        name: dto.name
      }
    });

    return this.mapProfile(created);
  }

  async getProfile(organizationId: string, profileId: string) {
    const profile = await this.getProfileOrThrow(organizationId, profileId);
    return this.mapProfile(profile);
  }

  async updateProfile(auth: AuthenticatedUser, profileId: string, dto: UpdateImportProfileDto) {
    const profile = await this.getProfileOrThrow(auth.organizationId, profileId);
    this.validateProfileInput(dto.targetDomain, dto.mappings);
    const updated = await this.prisma.importProfile.update({
      where: {
        id: profile.id
      },
      data: {
        targetDomain: toDbTargetDomain(dto.targetDomain),
        name: dto.name.trim(),
        sourceKind: dto.sourceKind,
        sheetName: dto.sheetName?.trim() || null,
        headerRowIndex: dto.headerRowIndex,
        mappings: dto.mappings as unknown as Prisma.InputJsonValue,
        options: dto.options ? (dto.options as Prisma.InputJsonValue) : JSON_NULL
      }
    });

    await this.auditService.log({
      organizationId: auth.organizationId,
      userId: auth.sub,
      action: "imports.profile.updated",
      entityType: "import_profile",
      entityId: profile.id,
      metadata: {
        targetDomain: dto.targetDomain,
        name: dto.name
      }
    });

    return this.mapProfile(updated);
  }

  async archiveProfile(auth: AuthenticatedUser, profileId: string) {
    const profile = await this.getProfileOrThrow(auth.organizationId, profileId);
    const archived = await this.prisma.importProfile.update({
      where: { id: profile.id },
      data: {
        isArchived: true
      }
    });

    await this.auditService.log({
      organizationId: auth.organizationId,
      userId: auth.sub,
      action: "imports.profile.archived",
      entityType: "import_profile",
      entityId: profile.id,
      metadata: JSON_NULL
    });

    return this.mapProfile(archived);
  }

  async listJobs(organizationId: string, query: ListImportJobsDto) {
    const jobs = await this.prisma.importJob.findMany({
      where: {
        organizationId
      },
      orderBy: {
        createdAt: "desc"
      }
    });
    const search = normalizeSearchTerm(query.q);
    const filtered = jobs
      .filter((job) => {
        if (query.targetDomain && job.targetDomain !== toDbTargetDomain(query.targetDomain)) {
          return false;
        }
        if (query.status && job.status !== query.status) {
          return false;
        }
        if (query.profileId && job.profileId !== query.profileId) {
          return false;
        }
        return matchesSearchTerm(search, [
          fromDbTargetDomain(job.targetDomain),
          job.status,
          job.originalFilename,
          job.sheetName
        ]);
      });

    const writeSummaryMap = await this.getWriteSummaryMap(
      organizationId,
      filtered.map((job) => job.id)
    );
    const mapped = filtered.map((job) => {
      const writeSummary = writeSummaryMap.get(job.id);
      return this.mapJobSummary({
        ...job,
        writes: [
          ...Array.from({ length: writeSummary?.createdCount ?? 0 }, () => ({ operation: "CREATED" })),
          ...Array.from({ length: writeSummary?.updatedCount ?? 0 }, () => ({ operation: "UPDATED" }))
        ]
      });
    });

    const sorted = sortItems(
      mapped,
      {
        createdAt: (item: ImportJobSummary) => item.createdAt,
        updatedAt: (item: ImportJobSummary) => item.updatedAt,
        status: (item: ImportJobSummary) => item.status,
        targetDomain: (item: ImportJobSummary) => item.targetDomain
      }[query.sort ?? "createdAt"],
      query.direction ?? "desc"
    );

    return paginateItems(sorted, query.page, query.pageSize);
  }

  async createJob(auth: AuthenticatedUser, dto: CreateImportJobDto) {
    let targetDomain: ImportTargetDomain | null = dto.targetDomain ?? null;
    let sourceKind: ImportSourceKind | null = null;
    let sheetName: string | null = null;
    let mappings: ImportMappingInput[] = [];
    let options: Record<string, unknown> | null = null;

    if (dto.profileId) {
      const profile = await this.getProfileOrThrow(auth.organizationId, dto.profileId);
      targetDomain = fromDbTargetDomain(profile.targetDomain);
      sourceKind = profile.sourceKind;
      sheetName = profile.sheetName;
      mappings = this.parseMappings(profile.mappings);
      options = this.parseOptions(profile.options);
    }

    if (!targetDomain) {
      throw new BadRequestException("targetDomain is required when no profile is supplied");
    }

    const created = await this.prisma.importJob.create({
      data: {
        organizationId: auth.organizationId,
        profileId: dto.profileId ?? null,
        targetDomain: toDbTargetDomain(targetDomain),
        sourceKind,
        sheetName,
        mappings: mappings as unknown as Prisma.InputJsonValue,
        options: options ? (options as Prisma.InputJsonValue) : JSON_NULL,
        createdById: auth.sub
      }
    });

    await this.auditService.log({
      organizationId: auth.organizationId,
      userId: auth.sub,
      action: "imports.job.created",
      entityType: "import_job",
      entityId: created.id,
      metadata: {
        targetDomain,
        profileId: dto.profileId ?? null
      }
    });

    return this.getJob(auth.organizationId, created.id);
  }

  async createPreparedJob(
    auth: AuthenticatedUser,
    input: {
      targetDomain: ImportTargetDomain;
      originalFilename: string;
      storedMimeType: string;
      sourceBuffer?: Buffer;
      sourceFilePath?: string;
      headers: string[];
      rawRows: ImportRowPreview[];
      mappings: ImportMappingInput[];
      options?: Record<string, unknown> | null;
      selectedSheetName?: string;
    }
  ) {
    this.validateProfileInput(input.targetDomain, input.mappings);

    const created = await this.prisma.importJob.create({
      data: {
        organizationId: auth.organizationId,
        targetDomain: toDbTargetDomain(input.targetDomain),
        sourceKind: "CSV",
        mappings: input.mappings as unknown as Prisma.InputJsonValue,
        options: input.options ? (input.options as Prisma.InputJsonValue) : JSON_NULL,
        createdById: auth.sub
      }
    });

    const storedFile = input.sourceFilePath
      ? await persistImportSourcePath(auth.organizationId, created.id, input.originalFilename, input.sourceFilePath)
      : await persistImportSourceFile(
          auth.organizationId,
          created.id,
          input.originalFilename,
          input.sourceBuffer ?? Buffer.from("")
        );
    const rawRowsFile = await persistRawRows(auth.organizationId, created.id, input.rawRows);
    const previewRows = input.rawRows.slice(0, 20);
    const sourceSnapshot: ImportSourceSnapshot = {
      sheetNames: [input.selectedSheetName ?? "IFC4"],
      selectedSheetName: input.selectedSheetName ?? "IFC4",
      headerRowIndex: 1,
      headers: input.headers,
      rowCount: input.rawRows.length,
      previewRows,
      rawRowsRef: rawRowsFile.relativePath
    };

    await this.prisma.importJob.update({
      where: {
        id: created.id
      },
      data: {
        originalFilename: input.originalFilename,
        storedMimeType: input.storedMimeType,
        storedFileRef: storedFile.relativePath,
        sheetName: sourceSnapshot.selectedSheetName,
        sourceSnapshot: sourceSnapshot as unknown as Prisma.InputJsonValue,
        status: input.mappings.length > 0 ? "MAPPED" : "UPLOADED",
        summary: JSON_NULL,
        report: JSON_NULL,
        completedAt: null
      }
    });

    await this.auditService.log({
      organizationId: auth.organizationId,
      userId: auth.sub,
      action: "imports.job.prepared",
      entityType: "import_job",
      entityId: created.id,
      metadata: {
        targetDomain: input.targetDomain,
        originalFilename: input.originalFilename,
        rows: input.rawRows.length,
        sourceAssistant: "IFC4"
      }
    });

    return this.getJob(auth.organizationId, created.id);
  }

  async getJob(organizationId: string, jobId: string) {
    const job = await this.getJobOrThrow(organizationId, jobId);
    const writes = await this.prisma.importJobWrite.findMany({
      where: {
        organizationId,
        jobId
      },
      select: {
        operation: true
      }
    });
    return this.mapJob({
      ...job,
      writes
    });
  }

  async listJobLogs(organizationId: string, jobId: string): Promise<ImportJobLogEntry[]> {
    await this.getJobOrThrow(organizationId, jobId);
    const logs = await this.prisma.importJobLog.findMany({
      where: {
        organizationId,
        jobId
      },
      orderBy: {
        createdAt: "asc"
      }
    });
    return logs.map((log) => ({
      id: log.id,
      organizationId: log.organizationId,
      jobId: log.jobId,
      level: log.level,
      step: log.step,
      message: log.message,
      metadata:
        log.metadata && typeof log.metadata === "object" && !Array.isArray(log.metadata)
          ? log.metadata as Record<string, unknown>
          : null,
      createdAt: log.createdAt.toISOString()
    }));
  }

  async uploadJob(
    auth: AuthenticatedUser,
    jobId: string,
    dto: UploadImportJobDto,
    file: { originalname: string; mimetype: string; buffer: Buffer } | undefined
  ) {
    if (!file) {
      throw new BadRequestException("Import file is required");
    }
    const job = await this.getJobOrThrow(auth.organizationId, jobId);
    const sourceKind = this.resolveSourceKind(file.originalname, dto.sourceKind ?? job.sourceKind ?? null);
    const storedFile = await persistImportSourceFile(auth.organizationId, job.id, file.originalname, file.buffer);
    const parsed = parseImportBuffer(file.buffer, sourceKind, {
      sheetName: dto.sheetName ?? job.sheetName,
      headerRowIndex: dto.headerRowIndex ?? null
    });
    const rawRowsFile = await persistRawRows(auth.organizationId, job.id, parsed.rawRows);
    const sourceSnapshot = {
      ...parsed.sourceSnapshot,
      rawRowsRef: rawRowsFile.relativePath
    };

    const updated = await this.prisma.importJob.update({
      where: {
        id: job.id
      },
      data: {
        sourceKind,
        originalFilename: file.originalname,
        storedMimeType: file.mimetype,
        storedFileRef: storedFile.relativePath,
        sheetName: sourceSnapshot.selectedSheetName,
        sourceSnapshot: sourceSnapshot as unknown as Prisma.InputJsonValue,
        status: this.parseMappings(job.mappings).length > 0 ? "MAPPED" : "UPLOADED",
        summary: JSON_NULL,
        report: JSON_NULL,
        completedAt: null
      }
    });

    await this.auditService.log({
      organizationId: auth.organizationId,
      userId: auth.sub,
      action: "imports.job.uploaded",
      entityType: "import_job",
      entityId: job.id,
      metadata: {
        sourceKind,
        originalFilename: file.originalname,
        rows: sourceSnapshot.rowCount
      }
    });

    return this.getJob(auth.organizationId, updated.id);
  }

  private async runJobMode(
    auth: AuthenticatedUser,
    jobId: string,
    dto: RunImportJobDto | undefined,
    mode: "PREVIEW" | "VALIDATE" | "EXECUTE" | "EXECUTE_NOOP"
  ) {
    const job = await this.getJobOrThrow(auth.organizationId, jobId);
    const sourceSnapshot = this.parseSourceSnapshot(job.sourceSnapshot);
    if (!sourceSnapshot?.rawRowsRef) {
      throw new BadRequestException("No uploaded source is attached to this import job");
    }

    const resolved = await this.resolveMappings(job, dto);
    const mappingErrors = validateMappingSet(resolved.targetDomain, resolved.mappings);
    if (mappingErrors.length > 0) {
      throw new BadRequestException(mappingErrors.join(" | "));
    }

    for (const mapping of resolved.mappings) {
      if (!sourceSnapshot.headers.includes(mapping.sourceColumn) && mapping.transformType !== "CONSTANT") {
        throw new BadRequestException(`Unknown source column in uploaded file: ${mapping.sourceColumn}`);
      }
    }

    const report = await this.buildDomainReport({
      organizationId: auth.organizationId,
      mode,
      targetDomain: resolved.targetDomain,
      sourceSnapshot,
      mappings: resolved.mappings,
      options: resolved.options
    });

    const statusByMode = {
      PREVIEW: "MAPPED",
      VALIDATE: report.summary.rowsRejected > 0 ? "VALIDATED" : "READY",
      EXECUTE: report.summary.rowsRejected > 0 ? "COMPLETED" : "COMPLETED",
      EXECUTE_NOOP: "COMPLETED"
    } as const;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (mode === "EXECUTE") {
        await tx.importJobWrite.deleteMany({
          where: {
            organizationId: auth.organizationId,
            jobId: job.id
          }
        });

        report.summary.appliedWrites = await this.executeDomainReport({
          db: tx,
          organizationId: auth.organizationId,
          targetDomain: resolved.targetDomain,
          report,
          importProfileId: dto?.profileId ?? job.profileId,
          importJobId: job.id,
          sourceKind: job.sourceKind,
          userId: auth.sub
        });
      }

      const persisted = await tx.importJob.update({
        where: {
          id: job.id
        },
        data: {
          targetDomain: toDbTargetDomain(resolved.targetDomain),
          profileId: dto?.profileId ?? job.profileId,
          mappings: resolved.mappings as unknown as Prisma.InputJsonValue,
          options: resolved.options ? (resolved.options as Prisma.InputJsonValue) : JSON_NULL,
          summary: report.summary as unknown as Prisma.InputJsonValue,
          report: report as unknown as Prisma.InputJsonValue,
          status: statusByMode[mode],
          startedAt: mode === "EXECUTE" || mode === "EXECUTE_NOOP" ? new Date() : job.startedAt,
          completedAt: mode === "EXECUTE" || mode === "EXECUTE_NOOP" ? new Date() : null
        }
      });

      await this.auditService.log({
        db: tx,
        organizationId: auth.organizationId,
        userId: auth.sub,
        action:
          mode === "PREVIEW"
            ? "imports.job.previewed"
            : mode === "VALIDATE"
              ? "imports.job.validated"
              : "imports.job.executed",
        entityType: "import_job",
        entityId: job.id,
        metadata: {
          mode,
          targetDomain: resolved.targetDomain,
          rowsRead: report.summary.rowsRead,
          rowsRejected: report.summary.rowsRejected,
          appliedWrites: report.summary.appliedWrites
        }
      });

      return persisted;
    });

    return this.getJob(auth.organizationId, updated.id);
  }

  private async buildDomainReport(input: {
    organizationId: string;
    mode: "PREVIEW" | "VALIDATE" | "EXECUTE" | "EXECUTE_NOOP";
    targetDomain: ImportTargetDomain;
    sourceSnapshot: ImportSourceSnapshot;
    mappings: ImportMappingInput[];
    options?: Record<string, unknown> | null;
  }) {
    if (input.targetDomain === "spatial-nodes") {
      return this.spatialService.buildImportReport({
        organizationId: input.organizationId,
        mode: input.mode,
        sourceSnapshot: input.sourceSnapshot,
        mappings: input.mappings,
        options: input.options
      });
    }
    if (input.targetDomain === "immobilizations") {
      return this.immobilizationsImportService.buildImportReport({
        organizationId: input.organizationId,
        mode: input.mode,
        sourceSnapshot: input.sourceSnapshot,
        mappings: input.mappings
      });
    }
    if (input.targetDomain === "equipments") {
      return this.equipmentsImportService.buildImportReport({
        organizationId: input.organizationId,
        mode: input.mode,
        sourceSnapshot: input.sourceSnapshot,
        mappings: input.mappings
      });
    }
    return buildImportReport({
      targetDomain: input.targetDomain,
      mode: input.mode,
      headers: input.sourceSnapshot.headers,
      rawRows: await readRawRows(input.sourceSnapshot.rawRowsRef),
      mappings: input.mappings
    });
  }

  private executeDomainReport(input: {
    db: Prisma.TransactionClient;
    organizationId: string;
    targetDomain: ImportTargetDomain;
    report: ImportJobReport;
    importProfileId?: string | null;
    importJobId: string;
    sourceKind?: PrismaImportSourceKind | null;
    userId?: string | null;
  }) {
    if (input.targetDomain === "spatial-nodes") {
      return this.spatialService.executeImportReport({
        db: input.db,
        organizationId: input.organizationId,
        report: input.report,
        importProfileId: input.importProfileId,
        importJobId: input.importJobId,
        sourceKind: input.sourceKind
      });
    }
    if (input.targetDomain === "immobilizations") {
      return this.immobilizationsImportService.executeImportReport({
        db: input.db,
        organizationId: input.organizationId,
        report: input.report,
        importJobId: input.importJobId,
        userId: input.userId
      });
    }
    if (input.targetDomain === "equipments") {
      return this.equipmentsImportService.executeImportReport({
        db: input.db,
        organizationId: input.organizationId,
        report: input.report,
        importJobId: input.importJobId,
        userId: input.userId
      });
    }
    return Promise.resolve(0);
  }

  previewJob(auth: AuthenticatedUser, jobId: string, dto?: RunImportJobDto) {
    return this.runJobMode(auth, jobId, dto, "PREVIEW");
  }

  validateJob(auth: AuthenticatedUser, jobId: string, dto?: RunImportJobDto) {
    return this.runJobMode(auth, jobId, dto, "VALIDATE");
  }

  executeJob(auth: AuthenticatedUser, jobId: string, dto?: RunImportJobDto) {
    return this.runJobMode(auth, jobId, dto, "EXECUTE");
  }

  async getJobReport(organizationId: string, jobId: string) {
    const job = await this.getJobOrThrow(organizationId, jobId);
    const report = this.parseReport(job.report);
    if (!report) {
      throw new NotFoundException("Import report not found");
    }
    return report;
  }

  async cancelJob(auth: AuthenticatedUser, jobId: string) {
    const job = await this.getJobOrThrow(auth.organizationId, jobId);
    if (["COMPLETED", "FAILED", "CANCELLED"].includes(job.status)) {
      throw new BadRequestException("This import job can no longer be cancelled");
    }
    const cancelled = await this.prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: "CANCELLED",
        completedAt: new Date()
      }
    });

    await this.auditService.log({
      organizationId: auth.organizationId,
      userId: auth.sub,
      action: "imports.job.cancelled",
      entityType: "import_job",
      entityId: job.id,
      metadata: JSON_NULL
    });

    return this.getJob(auth.organizationId, cancelled.id);
  }

  async deleteJob(auth: AuthenticatedUser, jobId: string) {
    const job = await this.getJobOrThrow(auth.organizationId, jobId);
    if (job.status === "RUNNING") {
      throw new BadRequestException("This import job cannot be deleted while it is running");
    }
    const writes = await this.prisma.importJobWrite.findMany({
      where: {
        organizationId: auth.organizationId,
        jobId: job.id
      },
      select: {
        operation: true,
        targetDomain: true,
        targetEntityId: true
      }
    });

    const createdWrites = writes.filter((write) => write.operation === "CREATED");
    if (createdWrites.length > 0) {
      const spatialCreatedIds = createdWrites
        .filter((write) => write.targetDomain === "SPATIAL_NODES")
        .map((write) => write.targetEntityId);
      const equipmentCreatedIds = createdWrites
        .filter((write) => write.targetDomain === "EQUIPMENTS")
        .map((write) => write.targetEntityId);
      const immobilizationCreatedIds = createdWrites
        .filter((write) => write.targetDomain === "IMMOBILIZATIONS")
        .map((write) => write.targetEntityId);

      const [remainingSpatialNodes, remainingEquipments, remainingImmobilizations] = await Promise.all([
        spatialCreatedIds.length > 0
          ? this.prisma.spatialNode.findMany({
              where: {
                organizationId: auth.organizationId,
                id: {
                  in: spatialCreatedIds
                }
              },
              select: {
                id: true
              }
            })
          : [],
        equipmentCreatedIds.length > 0
          ? this.prisma.equipment.findMany({
              where: {
                organizationId: auth.organizationId,
                id: {
                  in: equipmentCreatedIds
                }
              },
              select: {
                id: true
              }
            })
          : [],
        immobilizationCreatedIds.length > 0
          ? this.prisma.immobilization.findMany({
              where: {
                organizationId: auth.organizationId,
                id: {
                  in: immobilizationCreatedIds
                }
              },
              select: {
                id: true
              }
            })
          : []
      ]);

      if (remainingSpatialNodes.length > 0 || remainingEquipments.length > 0 || remainingImmobilizations.length > 0) {
        throw new ConflictException({
          message: "Impossible de supprimer ce job tant que ses creations metier n ont pas ete purgees.",
          code: "IMPORT_JOB_DELETE_BLOCKED",
          details: {
            createdCount: createdWrites.length,
            updatedCount: writes.filter((write) => write.operation === "UPDATED").length,
            remainingSpatialNodes: remainingSpatialNodes.length,
            remainingEquipments: remainingEquipments.length,
            remainingImmobilizations: remainingImmobilizations.length
          }
        });
      }
    }

    await this.prisma.importJob.delete({
      where: { id: job.id }
    });

    await removeImportJobArtifacts(auth.organizationId, job.id);

    await this.auditService.log({
      organizationId: auth.organizationId,
      userId: auth.sub,
      action: "imports.job.deleted",
      entityType: "import_job",
      entityId: job.id,
      metadata: {
        targetDomain: fromDbTargetDomain(job.targetDomain),
        originalFilename: job.originalFilename
      }
    });

    return {
      id: job.id,
      deleted: true
    };
  }

  async purgeCreatedData(auth: AuthenticatedUser, jobId: string): Promise<ImportJobPurgeCreatedDataResult> {
    const job = await this.getJobOrThrow(auth.organizationId, jobId);
    const targetDomain = fromDbTargetDomain(job.targetDomain);
    if (!job.completedAt) {
      throw new BadRequestException("Ce job n a pas encore ete execute");
    }

    const writes = await this.prisma.importJobWrite.findMany({
      where: {
        organizationId: auth.organizationId,
        jobId
      },
      orderBy: {
        createdAt: "asc"
      }
    });
    if (writes.length === 0) {
      throw new BadRequestException("Aucune provenance d ecriture n est disponible pour ce job");
    }

    if (targetDomain === "spatial-nodes") {
      return this.spatialService.purgeCreatedDataForImportJob({
        organizationId: auth.organizationId,
        userId: auth.sub,
        jobId,
        writes
      });
    }
    if (targetDomain === "immobilizations") {
      return this.immobilizationsImportService.purgeCreatedDataForImportJob({
        organizationId: auth.organizationId,
        userId: auth.sub,
        jobId,
        writes: writes.filter((write) => write.targetDomain === "IMMOBILIZATIONS")
      });
    }
    if (targetDomain === "equipments") {
      return this.equipmentsImportService.purgeCreatedDataForImportJob({
        organizationId: auth.organizationId,
        userId: auth.sub,
        jobId,
        writes: writes.filter((write) => write.targetDomain === "EQUIPMENTS")
      });
    }
    throw new BadRequestException("La purge V1 ne supporte pas ce domaine");
  }

  listTargetFields(targetDomain: ImportTargetDomain) {
    return getTargetFieldCatalog(targetDomain);
  }
}
