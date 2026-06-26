import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { persistRawRows } from "../imports/imports-storage";
import { SpatialService } from "./spatial.service";

describe("SpatialService", () => {
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

  it("normalizes path segments and computes depth consistently", () => {
    const service = new SpatialService({} as never, { log: vi.fn() } as never);

    const resolved = (service as any).resolvePathForPersistence({
      type: "ROOM",
      code: " b 101 ",
      label: " Bureau 101 ",
      parentPath: " Site principal / bat a / etage 1 "
    });

    expect(resolved.code).toBe("B-101");
    expect(resolved.label).toBe("Bureau 101");
    expect(resolved.parentPath).toBe("SITE-PRINCIPAL/BAT-A/ETAGE-1");
    expect(resolved.path).toBe("SITE-PRINCIPAL/BAT-A/ETAGE-1/B-101");
    expect(resolved.depth).toBe(3);
  });

  it("rejects invalid hierarchy for mutation parent validation", async () => {
    const service = new SpatialService(
      {
        spatialNode: {
          findFirst: vi.fn().mockResolvedValue({
            id: "parent-zone",
            organizationId: "org-1",
            type: "ZONE",
            path: "HQ/BAT-A/STOCK"
          })
        }
      } as never,
      { log: vi.fn() } as never
    );

    await expect(
      (service as any).resolveParentForMutation("org-1", "FLOOR", "parent-zone")
    ).rejects.toThrow("Parent spatial incompatible avec le type de noeud");
  });

  it("rejects self or descendant attachment during mutation parent resolution", async () => {
    const service = new SpatialService(
      {
        spatialNode: {
          findFirst: vi.fn().mockResolvedValue({
            id: "child-room",
            organizationId: "org-1",
            type: "ROOM",
            path: "HQ/BAT-A/RDC/R101"
          })
        }
      } as never,
      { log: vi.fn() } as never
    );

    await expect(
      (service as any).resolveParentForMutation("org-1", "ROOM", "child-room", "HQ/BAT-A/RDC")
    ).rejects.toThrow("Un noeud ne peut pas etre rattache a lui-meme ou a un descendant");
  });

  it("builds a valid report for a room directly under a floor", async () => {
    const runtimeDir = await mkdtemp(join(tmpdir(), "inventory-spatial-"));
    cleanupPaths.push(runtimeDir);
    vi.spyOn(process, "cwd").mockReturnValue(join(runtimeDir, "apps", "api"));

    const rawRows = [
      {
        rowIndex: 2,
        values: {
          Type: "SITE",
          Code: "HQ",
          Libelle: "Site principal",
          Path: "HQ"
        }
      },
      {
        rowIndex: 3,
        values: {
          Type: "BUILDING",
          Code: "BAT-A",
          Libelle: "Batiment A",
          Parent: "HQ"
        }
      },
      {
        rowIndex: 4,
        values: {
          Type: "FLOOR",
          Code: "RDC",
          Libelle: "Rez-de-chaussee",
          Parent: "HQ/BAT-A"
        }
      },
      {
        rowIndex: 5,
        values: {
          Type: "ROOM",
          Code: "R101",
          Libelle: "Bureau 101",
          Parent: "HQ/BAT-A/RDC",
          sourceClass: "IfcSpace"
        }
      }
    ];

    const stored = await persistRawRows("org-1", "job-1", rawRows);
    const prisma = {
      spatialNode: {
        findMany: vi.fn().mockResolvedValue([])
      }
    } as unknown as ConstructorParameters<typeof SpatialService>[0];

    const service = new SpatialService(prisma, { log: vi.fn() } as never);
    const report = await service.buildImportReport({
      organizationId: "org-1",
      mode: "VALIDATE",
      sourceSnapshot: {
        sheetNames: ["Feuil1"],
        selectedSheetName: "Feuil1",
        headerRowIndex: 1,
        headers: ["Type", "Code", "Libelle", "Path", "Parent"],
        rowCount: rawRows.length,
        previewRows: rawRows,
        rawRowsRef: stored.relativePath
      },
      mappings: [
        { sourceColumn: "Type", targetField: "type", transformType: "TRIM" },
        { sourceColumn: "Code", targetField: "code", transformType: "TRIM" },
        { sourceColumn: "Libelle", targetField: "label", transformType: "TRIM" },
        { sourceColumn: "Path", targetField: "path", transformType: "TRIM" },
        { sourceColumn: "Parent", targetField: "parentPath", transformType: "TRIM" },
        { sourceColumn: "sourceClass", targetField: "sourceClass", transformType: "TRIM", isRequired: false }
      ]
    });

    expect(report.summary.rowsRejected).toBe(0);
    expect(report.rows[3]?.resolvedTargetKey).toBe("HQ/BAT-A/RDC/R101");
    expect(report.rows[3]?.messages).toContain("OPERATION_CREATE");
  });

  it("marks an unchanged existing spatial node as NO_OP", async () => {
    const runtimeDir = await mkdtemp(join(tmpdir(), "inventory-spatial-"));
    cleanupPaths.push(runtimeDir);
    vi.spyOn(process, "cwd").mockReturnValue(join(runtimeDir, "apps", "api"));

    const rawRows = [
      {
        rowIndex: 2,
        values: {
          Type: "SITE",
          Code: "HQ",
          Libelle: "Site principal",
          Path: "HQ"
        }
      }
    ];

    const stored = await persistRawRows("org-1", "job-noop", rawRows);
    const service = new SpatialService(
      {
        spatialNode: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "node-1",
              type: "SITE",
              code: "HQ",
              label: "Site principal",
              description: null,
              path: "HQ",
              parentId: null,
              externalRef: null,
              sourceClass: null,
              sourceMetadata: null,
              geometrySource: null,
              geometryMetadata: null,
              worldCenterX: null,
              worldCenterY: null,
              worldCenterZ: null,
              worldSizeX: null,
              worldSizeY: null,
              worldSizeZ: null,
              isActive: true
            }
          ])
        }
      } as never,
      { log: vi.fn() } as never
    );

    const report = await service.buildImportReport({
      organizationId: "org-1",
      mode: "VALIDATE",
      sourceSnapshot: {
        sheetNames: ["Feuil1"],
        selectedSheetName: "Feuil1",
        headerRowIndex: 1,
        headers: ["Type", "Code", "Libelle", "Path"],
        rowCount: rawRows.length,
        previewRows: rawRows,
        rawRowsRef: stored.relativePath
      },
      mappings: [
        { sourceColumn: "Type", targetField: "type", transformType: "TRIM" },
        { sourceColumn: "Code", targetField: "code", transformType: "TRIM" },
        { sourceColumn: "Libelle", targetField: "label", transformType: "TRIM" },
        { sourceColumn: "Path", targetField: "path", transformType: "TRIM" }
      ]
    });

    expect(report.rows[0]?.status).toBe("NO_OP");
    expect(report.rows[0]?.messages).toContain("OPERATION_NO_OP");
    expect(report.summary.simulatedWrites).toBe(0);
  });

  it("rejects a room without resolvable parent", async () => {
    const runtimeDir = await mkdtemp(join(tmpdir(), "inventory-spatial-"));
    cleanupPaths.push(runtimeDir);
    vi.spyOn(process, "cwd").mockReturnValue(join(runtimeDir, "apps", "api"));

    const rawRows = [
      {
        rowIndex: 2,
        values: {
          Type: "ROOM",
          Code: "R404",
          Libelle: "Bureau 404"
        }
      }
    ];

    const stored = await persistRawRows("org-1", "job-2", rawRows);
    const prisma = {
      spatialNode: {
        findMany: vi.fn().mockResolvedValue([])
      }
    } as unknown as ConstructorParameters<typeof SpatialService>[0];

    const service = new SpatialService(prisma, { log: vi.fn() } as never);
    const report = await service.buildImportReport({
      organizationId: "org-1",
      mode: "VALIDATE",
      sourceSnapshot: {
        sheetNames: ["Feuil1"],
        selectedSheetName: "Feuil1",
        headerRowIndex: 1,
        headers: ["Type", "Code", "Libelle"],
        rowCount: rawRows.length,
        previewRows: rawRows,
        rawRowsRef: stored.relativePath
      },
      mappings: [
        { sourceColumn: "Type", targetField: "type", transformType: "TRIM" },
        { sourceColumn: "Code", targetField: "code", transformType: "TRIM" },
        { sourceColumn: "Libelle", targetField: "label", transformType: "TRIM" }
      ]
    });

    expect(report.summary.rowsRejected).toBe(1);
    expect(report.rows[0]?.messages).toContain("PATH_UNRESOLVABLE");
  });

  it("rejects duplicate path and duplicate code under the same parent during report build", async () => {
    const runtimeDir = await mkdtemp(join(tmpdir(), "inventory-spatial-"));
    cleanupPaths.push(runtimeDir);
    vi.spyOn(process, "cwd").mockReturnValue(join(runtimeDir, "apps", "api"));

    const rawRows = [
      {
        rowIndex: 2,
        values: {
          Type: "SITE",
          Code: "HQ",
          Libelle: "Site principal",
          Path: "HQ"
        }
      },
      {
        rowIndex: 3,
        values: {
          Type: "BUILDING",
          Code: "BAT-A",
          Libelle: "Batiment A",
          Parent: "HQ"
        }
      },
      {
        rowIndex: 4,
        values: {
          Type: "BUILDING",
          Code: "BAT-A",
          Libelle: "Batiment A bis",
          Parent: "HQ"
        }
      }
    ];

    const stored = await persistRawRows("org-1", "job-dup", rawRows);
    const service = new SpatialService(
      {
        spatialNode: {
          findMany: vi.fn().mockResolvedValue([])
        }
      } as never,
      { log: vi.fn() } as never
    );

    const report = await service.buildImportReport({
      organizationId: "org-1",
      mode: "VALIDATE",
      sourceSnapshot: {
        sheetNames: ["Feuil1"],
        selectedSheetName: "Feuil1",
        headerRowIndex: 1,
        headers: ["Type", "Code", "Libelle", "Path", "Parent"],
        rowCount: rawRows.length,
        previewRows: rawRows,
        rawRowsRef: stored.relativePath
      },
      mappings: [
        { sourceColumn: "Type", targetField: "type", transformType: "TRIM" },
        { sourceColumn: "Code", targetField: "code", transformType: "TRIM" },
        { sourceColumn: "Libelle", targetField: "label", transformType: "TRIM" },
        { sourceColumn: "Path", targetField: "path", transformType: "TRIM", isRequired: false },
        { sourceColumn: "Parent", targetField: "parentPath", transformType: "TRIM", isRequired: false }
      ]
    });

    expect(report.summary.rowsRejected).toBe(2);
    expect(report.rows[1]?.messages).toContain("DUPLICATE_PATH_IN_FILE");
    expect(report.rows[2]?.messages).toContain("DUPLICATE_PATH_IN_FILE");
    expect(report.rows[1]?.messages).toContain("DUPLICATE_CODE_UNDER_PARENT");
    expect(report.rows[2]?.messages).toContain("DUPLICATE_CODE_UNDER_PARENT");
  });

  it("rejects legacy LOCATION rows when the admin option is not enabled", async () => {
    const runtimeDir = await mkdtemp(join(tmpdir(), "inventory-spatial-"));
    cleanupPaths.push(runtimeDir);
    vi.spyOn(process, "cwd").mockReturnValue(join(runtimeDir, "apps", "api"));

    const rawRows = [
      {
        rowIndex: 2,
        values: {
          Type: "LOCATION",
          Code: "LOC-001",
          Libelle: "Localisation legacy",
          Path: "LOC-001"
        }
      }
    ];

    const stored = await persistRawRows("org-1", "job-location", rawRows);
    const service = new SpatialService(
      {
        spatialNode: {
          findMany: vi.fn().mockResolvedValue([])
        }
      } as never,
      { log: vi.fn() } as never
    );

    const report = await service.buildImportReport({
      organizationId: "org-1",
      mode: "VALIDATE",
      sourceSnapshot: {
        sheetNames: ["Feuil1"],
        selectedSheetName: "Feuil1",
        headerRowIndex: 1,
        headers: ["Type", "Code", "Libelle", "Path"],
        rowCount: rawRows.length,
        previewRows: rawRows,
        rawRowsRef: stored.relativePath
      },
      mappings: [
        { sourceColumn: "Type", targetField: "type", transformType: "TRIM" },
        { sourceColumn: "Code", targetField: "code", transformType: "TRIM" },
        { sourceColumn: "Libelle", targetField: "label", transformType: "TRIM" },
        { sourceColumn: "Path", targetField: "path", transformType: "TRIM" }
      ]
    });

    expect(report.summary.rowsRejected).toBe(1);
    expect(report.rows[0]?.messages).toContain("LEGACY_LOCATION_IMPORT_FORBIDDEN");
  });

  it("rejects descendants in cascade when their parent row is rejected", async () => {
    const runtimeDir = await mkdtemp(join(tmpdir(), "inventory-spatial-"));
    cleanupPaths.push(runtimeDir);
    vi.spyOn(process, "cwd").mockReturnValue(join(runtimeDir, "apps", "api"));

    const rawRows = [
      {
        rowIndex: 2,
        values: {
          Type: "ROOM",
          Code: "R-404",
          Libelle: "Bureau 404",
          Parent: "HQ"
        }
      },
      {
        rowIndex: 3,
        values: {
          Type: "LOCATION",
          Code: "LOC-404",
          Libelle: "Localisation 404",
          Parent: "HQ/R-404"
        }
      }
    ];

    const stored = await persistRawRows("org-1", "job-cascade", rawRows);
    const service = new SpatialService(
      {
        spatialNode: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "site-1",
              organizationId: "org-1",
              type: "SITE",
              path: "HQ",
              code: "HQ",
              parentId: null
            }
          ])
        }
      } as never,
      { log: vi.fn() } as never
    );

    const report = await service.buildImportReport({
      organizationId: "org-1",
      mode: "VALIDATE",
      sourceSnapshot: {
        sheetNames: ["Feuil1"],
        selectedSheetName: "Feuil1",
        headerRowIndex: 1,
        headers: ["Type", "Code", "Libelle", "Parent"],
        rowCount: rawRows.length,
        previewRows: rawRows,
        rawRowsRef: stored.relativePath
      },
      mappings: [
        { sourceColumn: "Type", targetField: "type", transformType: "TRIM" },
        { sourceColumn: "Code", targetField: "code", transformType: "TRIM" },
        { sourceColumn: "Libelle", targetField: "label", transformType: "TRIM" },
        { sourceColumn: "Parent", targetField: "parentPath", transformType: "TRIM" }
      ]
    });

    expect(report.summary.rowsRejected).toBe(2);
    expect(report.rows[0]?.messages).toContain("PARENT_CHILD_TYPE_MISMATCH");
    expect(report.rows[1]?.messages).toContain("PARENT_NOT_FOUND");
  });

  it("marks an existing path as update during validation", async () => {
    const runtimeDir = await mkdtemp(join(tmpdir(), "inventory-spatial-"));
    cleanupPaths.push(runtimeDir);
    vi.spyOn(process, "cwd").mockReturnValue(join(runtimeDir, "apps", "api"));

    const rawRows = [
      {
        rowIndex: 2,
        values: {
          Type: "ROOM",
          Code: "R101",
          Libelle: "Bureau 101",
          Path: "HQ/BAT-A/R101"
        }
      }
    ];

    const stored = await persistRawRows("org-1", "job-update", rawRows);
    const service = new SpatialService(
      {
        spatialNode: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "building-1",
              organizationId: "org-1",
              type: "BUILDING",
              path: "HQ/BAT-A",
              code: "BAT-A",
              parentId: "site-1"
            },
            {
              id: "room-1",
              organizationId: "org-1",
              type: "ROOM",
              path: "HQ/BAT-A/R101",
              code: "R101",
              parentId: "building-1"
            }
          ])
        }
      } as never,
      { log: vi.fn() } as never
    );

    const report = await service.buildImportReport({
      organizationId: "org-1",
      mode: "VALIDATE",
      sourceSnapshot: {
        sheetNames: ["Feuil1"],
        selectedSheetName: "Feuil1",
        headerRowIndex: 1,
        headers: ["Type", "Code", "Libelle", "Path"],
        rowCount: rawRows.length,
        previewRows: rawRows,
        rawRowsRef: stored.relativePath
      },
      mappings: [
        { sourceColumn: "Type", targetField: "type", transformType: "TRIM" },
        { sourceColumn: "Code", targetField: "code", transformType: "TRIM" },
        { sourceColumn: "Libelle", targetField: "label", transformType: "TRIM" },
        { sourceColumn: "Path", targetField: "path", transformType: "TRIM" }
      ]
    });

    expect(report.summary.rowsRejected).toBe(0);
    expect(report.rows[0]?.messages).toContain("OPERATION_UPDATE");
  });

  it("recomputes path, depth and parent during executeImportReport", async () => {
    const updates: Array<Record<string, unknown>> = [];
    const syncSpy = vi.fn().mockResolvedValue(undefined);
    const service = new SpatialService(
      {
        $transaction: async (callback: (tx: any) => Promise<number>) =>
          callback({
            spatialNode: {
              findMany: vi.fn().mockResolvedValue([
                {
                  id: "site-1",
                  organizationId: "org-1",
                  type: "SITE",
                  path: "HQ",
                  code: "HQ"
                },
                {
                  id: "building-1",
                  organizationId: "org-1",
                  type: "BUILDING",
                  path: "HQ/BAT-A",
                  code: "BAT-A"
                }
              ]),
              findFirst: vi.fn().mockResolvedValue({
                id: "existing-room",
                organizationId: "org-1",
                path: "HQ/BAT-A/R101"
              }),
              update: vi.fn().mockImplementation(({ data }) => {
                updates.push(data);
                return Promise.resolve({ id: "existing-room" });
              }),
              create: vi.fn()
            },
            importJobWrite: {
              create: vi.fn().mockResolvedValue({ id: "write-1" })
            }
          })
      } as never,
      { log: vi.fn() } as never
    );
    (service as any).syncScopesForSpatialNodes = syncSpy;

    await service.executeImportReport({
      organizationId: "org-1",
      importJobId: "job-1",
      report: {
        mode: "EXECUTE",
        targetDomain: "spatial-nodes",
        headers: [],
        mappings: [],
        summary: {
          rowsRead: 1,
          rowsValid: 1,
          rowsRejected: 0,
          rowsWithWarnings: 0,
          simulatedWrites: 0,
          appliedWrites: 0,
          executionMode: "EXECUTE",
          targetDomain: "spatial-nodes"
        },
        rows: [
          {
            rowIndex: 2,
            status: "UPDATED",
            resolvedTargetKey: "HQ/BAT-A/r 101",
            normalizedValues: {
              type: "ROOM",
              code: "r 101",
              label: " Bureau 101 ",
              path: "HQ/BAT-A/r 101",
              parentPath: "HQ/BAT-A"
            },
            messages: []
          }
        ]
      }
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      code: "R-101",
      label: "Bureau 101",
      path: "HQ/BAT-A/R-101",
      depth: 2,
      parentId: "building-1"
    });
    expect(syncSpy).toHaveBeenCalled();
  });

  it("rejects executeImportReport when the resolved parent path is missing", async () => {
    const service = new SpatialService(
      {
        $transaction: async (callback: (tx: any) => Promise<number>) =>
          callback({
            spatialNode: {
              findMany: vi.fn().mockResolvedValue([]),
              findFirst: vi.fn(),
              update: vi.fn(),
              create: vi.fn()
            },
            importJobWrite: {
              create: vi.fn().mockResolvedValue({ id: "write-1" })
            }
          })
      } as never,
      { log: vi.fn() } as never
    );

    await expect(
      service.executeImportReport({
        organizationId: "org-1",
        importJobId: "job-1",
        report: {
          mode: "EXECUTE",
          targetDomain: "spatial-nodes",
          headers: [],
          mappings: [],
          summary: {
            rowsRead: 1,
            rowsValid: 1,
            rowsRejected: 0,
            rowsWithWarnings: 0,
            simulatedWrites: 0,
            appliedWrites: 0,
            executionMode: "EXECUTE",
            targetDomain: "spatial-nodes"
          },
          rows: [
            {
              rowIndex: 2,
              status: "CREATED",
              resolvedTargetKey: "ROOM-404",
              normalizedValues: {
                type: "ROOM",
                code: "ROOM-404",
                label: "Bureau 404",
                path: "ROOM-404"
              },
              messages: []
            }
          ]
        }
      })
    ).rejects.toThrow(BadRequestException);
  });

  it("backfills legacy locations with normalized path and depth", async () => {
    const createSpy = vi.fn().mockResolvedValue({ id: "legacy-node-1" });
    const syncSpy = vi.fn().mockResolvedValue(undefined);
    const service = new SpatialService(
      {
        location: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "loc-1",
              organizationId: "org-1",
              code: "stock principal",
              name: "Stock principal",
              description: "Depot"
            }
          ])
        },
        spatialNode: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: createSpy
        }
      } as never,
      { log: vi.fn() } as never
    );
    (service as any).syncScopesForSpatialNodes = syncSpy;

    const result = await service.backfillLegacyLocations("org-1");

    expect(result.createdCount).toBe(1);
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: "STOCK-PRINCIPAL",
          path: "STOCK-PRINCIPAL",
          depth: 0
        })
      })
    );
  });
});
