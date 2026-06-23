import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConflictException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImportsService } from "./imports.service";
import * as importsStorage from "./imports-storage";

const cleanupPaths: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  while (cleanupPaths.length > 0) {
    const path = cleanupPaths.pop();
    if (path) {
      await rm(path, { recursive: true, force: true });
    }
  }
});

function createJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    organizationId: "org-1",
    profileId: null,
    targetDomain: "SPATIAL_NODES",
    sourceKind: "CSV",
    status: "UPLOADED",
    originalFilename: "spatial.csv",
    sheetName: "Feuil1",
    sourceSnapshot: {
      sheetNames: ["Feuil1"],
      selectedSheetName: "Feuil1",
      headerRowIndex: 1,
      headers: ["Type", "Code", "Libelle", "Path"],
      rowCount: 1,
      previewRows: [],
      rawRowsRef: "runtime/raw-rows.json"
    },
    mappings: [
      { sourceColumn: "Type", targetField: "type", transformType: "TRIM" },
      { sourceColumn: "Code", targetField: "code", transformType: "TRIM" },
      { sourceColumn: "Libelle", targetField: "label", transformType: "TRIM" },
      { sourceColumn: "Path", targetField: "path", transformType: "TRIM" }
    ],
    options: null,
    summary: null,
    report: null,
    createdAt: new Date("2026-06-17T09:00:00.000Z"),
    updatedAt: new Date("2026-06-17T09:00:00.000Z"),
    startedAt: null,
    completedAt: null,
    ...overrides
  };
}

function createReport(mode: "PREVIEW" | "VALIDATE" | "EXECUTE") {
  return {
    mode,
    targetDomain: "spatial-nodes" as const,
    headers: ["Type", "Code", "Libelle", "Path"],
    mappings: [
      { sourceColumn: "Type", targetField: "type", transformType: "TRIM" as const },
      { sourceColumn: "Code", targetField: "code", transformType: "TRIM" as const },
      { sourceColumn: "Libelle", targetField: "label", transformType: "TRIM" as const },
      { sourceColumn: "Path", targetField: "path", transformType: "TRIM" as const }
    ],
    summary: {
      rowsRead: 1,
      rowsValid: 1,
      rowsRejected: 0,
      rowsWithWarnings: 0,
      simulatedWrites: mode === "EXECUTE" ? 0 : 1,
      appliedWrites: 0,
      executionMode: mode,
      targetDomain: "spatial-nodes" as const
    },
    rows: [
      {
        rowIndex: 2,
        status: mode === "EXECUTE" ? ("CREATED" as const) : ("VALID" as const),
        resolvedTargetKey: "HQ",
        normalizedValues: {
          type: "SITE",
          code: "HQ",
          label: "Site principal",
          path: "HQ"
        },
        messages: ["OPERATION_CREATE"]
      }
    ]
  };
}

function createPrismaMock(job: ReturnType<typeof createJob>, update: ReturnType<typeof vi.fn>) {
  let currentJob = { ...job };
  const importJobWriteFindMany = vi.fn().mockResolvedValue([]);
  const tx = {
    importJob: {
      update: vi.fn().mockImplementation(async (args) => {
        const persisted = await update(args);
        currentJob = {
          ...currentJob,
          ...persisted
        };
        return currentJob;
      })
    },
    importJobWrite: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 })
    }
  };

  return {
    importJob: {
      findFirst: vi.fn().mockImplementation(async () => currentJob),
      update: tx.importJob.update,
      delete: vi.fn().mockResolvedValue({ id: currentJob.id })
    },
    importJobWrite: {
      findMany: importJobWriteFindMany
    },
    spatialNode: {
      findMany: vi.fn().mockResolvedValue([])
    },
    equipment: {
      findMany: vi.fn().mockResolvedValue([])
    },
    immobilization: {
      findMany: vi.fn().mockResolvedValue([])
    },
    $transaction: vi.fn().mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx))
  };
}

function createService(input: {
  prisma: unknown;
  audit?: unknown;
  spatial?: unknown;
  equipmentsImport?: unknown;
  immobilizationsImport?: unknown;
}) {
  return new ImportsService(
    input.prisma as never,
    (input.audit ?? { log: vi.fn().mockResolvedValue(undefined) }) as never,
    (input.spatial ?? { buildImportReport: vi.fn(), executeImportReport: vi.fn() }) as never,
    (input.equipmentsImport ?? { buildImportReport: vi.fn(), executeImportReport: vi.fn(), purgeCreatedDataForImportJob: vi.fn() }) as never,
    (input.immobilizationsImport ?? { buildImportReport: vi.fn(), executeImportReport: vi.fn(), purgeCreatedDataForImportJob: vi.fn() }) as never
  );
}

describe("ImportsService", () => {
  it("delegates preview of spatial-nodes to SpatialService without executing writes", async () => {
    const runtimeDir = await mkdtemp(join(tmpdir(), "inventory-imports-"));
    cleanupPaths.push(runtimeDir);
    vi.spyOn(process, "cwd").mockReturnValue(join(runtimeDir, "apps", "api"));
    const stored = await importsStorage.persistRawRows("org-1", "job-1", []);
    const job = createJob();
    job.sourceSnapshot.rawRowsRef = stored.relativePath;
    const report = createReport("PREVIEW");
    const buildImportReport = vi.fn().mockResolvedValue(report);
    const executeImportReport = vi.fn();
    const update = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve({
        ...job,
        ...data,
        targetDomain: "SPATIAL_NODES",
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      })
    );
    const prisma = createPrismaMock(job, update);

    const service = createService({
      prisma,
      spatial: { buildImportReport, executeImportReport }
    });

    const result = await service.previewJob(
      { organizationId: "org-1", sub: "user-1" } as never,
      "job-1"
    );

    expect(buildImportReport).toHaveBeenCalledTimes(1);
    expect(executeImportReport).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "MAPPED"
        })
      })
    );
    expect(result.report?.summary.simulatedWrites).toBe(1);
  });

  it("delegates validate of spatial-nodes to SpatialService without executing writes", async () => {
    const runtimeDir = await mkdtemp(join(tmpdir(), "inventory-imports-"));
    cleanupPaths.push(runtimeDir);
    vi.spyOn(process, "cwd").mockReturnValue(join(runtimeDir, "apps", "api"));
    const stored = await importsStorage.persistRawRows("org-1", "job-1", []);
    const job = createJob();
    job.sourceSnapshot.rawRowsRef = stored.relativePath;
    const report = createReport("VALIDATE");
    const buildImportReport = vi.fn().mockResolvedValue(report);
    const executeImportReport = vi.fn();
    const update = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve({
        ...job,
        ...data,
        targetDomain: "SPATIAL_NODES",
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      })
    );
    const prisma = createPrismaMock(job, update);

    const service = createService({
      prisma,
      spatial: { buildImportReport, executeImportReport }
    });

    const result = await service.validateJob(
      { organizationId: "org-1", sub: "user-1" } as never,
      "job-1"
    );

    expect(buildImportReport).toHaveBeenCalledTimes(1);
    expect(executeImportReport).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "READY"
        })
      })
    );
    expect(result.summary?.executionMode).toBe("VALIDATE");
  });

  it("executes spatial-nodes imports and persists appliedWrites from SpatialService", async () => {
    const runtimeDir = await mkdtemp(join(tmpdir(), "inventory-imports-"));
    cleanupPaths.push(runtimeDir);
    vi.spyOn(process, "cwd").mockReturnValue(join(runtimeDir, "apps", "api"));
    const stored = await importsStorage.persistRawRows("org-1", "job-1", []);
    const job = createJob();
    job.sourceSnapshot.rawRowsRef = stored.relativePath;
    const report = createReport("EXECUTE");
    const buildImportReport = vi.fn().mockResolvedValue(report);
    const executeImportReport = vi.fn().mockResolvedValue(1);
    const update = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve({
        ...job,
        ...data,
        targetDomain: "SPATIAL_NODES",
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      })
    );
    const prisma = createPrismaMock(job, update);

    const service = createService({
      prisma,
      spatial: { buildImportReport, executeImportReport }
    });

    const result = await service.executeJob(
      { organizationId: "org-1", sub: "user-1" } as never,
      "job-1"
    );

    expect(buildImportReport).toHaveBeenCalledTimes(1);
    expect(executeImportReport).toHaveBeenCalledWith(
      expect.objectContaining({
        db: expect.any(Object),
        organizationId: "org-1",
        importJobId: "job-1",
        sourceKind: "CSV"
      })
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "COMPLETED",
          summary: expect.objectContaining({
            appliedWrites: 1
          })
        })
      })
    );
    expect(result.summary?.appliedWrites).toBe(1);
  });

  it("blocks job deletion when created spatial nodes still exist", async () => {
    const job = createJob({
      status: "COMPLETED",
      completedAt: new Date("2026-06-17T10:00:00.000Z")
    });
    const update = vi.fn();
    const prisma = createPrismaMock(job, update);
    prisma.importJobWrite.findMany.mockResolvedValue([
      {
        operation: "CREATED",
        targetDomain: "SPATIAL_NODES",
        targetEntityId: "node-1"
      },
      {
        operation: "UPDATED",
        targetDomain: "SPATIAL_NODES",
        targetEntityId: "node-2"
      }
    ]);
    prisma.spatialNode.findMany.mockResolvedValue([{ id: "node-1" }]);
    const removeArtifacts = vi.spyOn(importsStorage, "removeImportJobArtifacts").mockResolvedValue(undefined);

    const service = createService({ prisma });

    await expect(service.deleteJob({ organizationId: "org-1", sub: "user-1" } as never, "job-1")).rejects.toMatchObject({
      constructor: ConflictException,
      response: {
        message: "Impossible de supprimer ce job tant que ses creations metier n ont pas ete purgees.",
        code: "IMPORT_JOB_DELETE_BLOCKED",
        details: {
          createdCount: 1,
          updatedCount: 1
        }
      }
    });

    expect(prisma.importJob.delete).not.toHaveBeenCalled();
    expect(removeArtifacts).not.toHaveBeenCalled();
  });

  it("blocks job deletion when created equipments still exist", async () => {
    const job = createJob({
      targetDomain: "EQUIPMENTS",
      status: "COMPLETED",
      completedAt: new Date("2026-06-18T10:00:00.000Z")
    });
    const update = vi.fn();
    const prisma = createPrismaMock(job, update);
    prisma.importJobWrite.findMany.mockResolvedValue([
      {
        operation: "CREATED",
        targetDomain: "EQUIPMENTS",
        targetEntityId: "equipment-1"
      }
    ]);
    prisma.equipment.findMany.mockResolvedValue([{ id: "equipment-1" }]);
    const removeArtifacts = vi.spyOn(importsStorage, "removeImportJobArtifacts").mockResolvedValue(undefined);

    const service = createService({ prisma });

    await expect(service.deleteJob({ organizationId: "org-1", sub: "user-1" } as never, "job-1")).rejects.toMatchObject({
      constructor: ConflictException,
      response: {
        code: "IMPORT_JOB_DELETE_BLOCKED",
        details: {
          createdCount: 1,
          remainingEquipments: 1
        }
      }
    });

    expect(prisma.importJob.delete).not.toHaveBeenCalled();
    expect(removeArtifacts).not.toHaveBeenCalled();
  });

  it("allows job deletion after created spatial nodes have already been purged", async () => {
    const job = createJob({
      status: "COMPLETED",
      completedAt: new Date("2026-06-17T10:00:00.000Z")
    });
    const update = vi.fn();
    const prisma = createPrismaMock(job, update);
    prisma.importJobWrite.findMany.mockResolvedValue([
      {
        operation: "CREATED",
        targetDomain: "SPATIAL_NODES",
        targetEntityId: "node-1"
      },
      {
        operation: "UPDATED",
        targetDomain: "SPATIAL_NODES",
        targetEntityId: "node-2"
      }
    ]);
    prisma.spatialNode.findMany.mockResolvedValue([]);
    const removeArtifacts = vi.spyOn(importsStorage, "removeImportJobArtifacts").mockResolvedValue(undefined);
    const auditLog = vi.fn().mockResolvedValue(undefined);

    const service = createService({ prisma, audit: { log: auditLog } });

    const result = await service.deleteJob({ organizationId: "org-1", sub: "user-1" } as never, "job-1");

    expect(prisma.importJob.delete).toHaveBeenCalledWith({
      where: { id: "job-1" }
    });
    expect(removeArtifacts).toHaveBeenCalledWith("org-1", "job-1");
    expect(auditLog).toHaveBeenCalled();
    expect(result).toEqual({
      id: "job-1",
      deleted: true
    });
  });
});
