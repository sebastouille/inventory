import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EquipmentsImportService } from "./equipments-import.service";
import { ImmobilizationsImportService } from "./immobilizations-import.service";
import { persistRawRows } from "./imports-storage";

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

async function sourceSnapshot(headers: string[], values: Record<string, string | null>[]) {
  const runtimeDir = await mkdtemp(join(tmpdir(), "inventory-imports-domain-"));
  cleanupPaths.push(runtimeDir);
  vi.spyOn(process, "cwd").mockReturnValue(join(runtimeDir, "apps", "api"));
  const rows = values.map((row, index) => ({
    rowIndex: index + 2,
    values: row
  }));
  const stored = await persistRawRows("org-1", "job-1", rows);
  return {
    sheetNames: ["Feuil1"],
    selectedSheetName: "Feuil1",
    headerRowIndex: 1,
    headers,
    rowCount: rows.length,
    previewRows: rows,
    rawRowsRef: stored.relativePath
  };
}

describe("ImmobilizationsImportService", () => {
  it("builds create decisions and converts Excel serial dates", async () => {
    const prisma = {
      immobilization: {
        findMany: vi.fn().mockResolvedValue([])
      }
    };
    const service = new ImmobilizationsImportService(prisma as never, { log: vi.fn() } as never);
    const snapshot = await sourceSnapshot(["Immobilisation", "Libelle", "Date", "Valeur"], [
      {
        Immobilisation: "200002204",
        Libelle: "17 avenue General Leclerc",
        Date: "27211",
        Valeur: "747000,18"
      }
    ]);

    const report = await service.buildImportReport({
      organizationId: "org-1",
      mode: "VALIDATE",
      sourceSnapshot: snapshot,
      mappings: [
        { sourceColumn: "Immobilisation", targetField: "code", transformType: "TRIM" },
        { sourceColumn: "Libelle", targetField: "label", transformType: "TRIM" },
        { sourceColumn: "Date", targetField: "serviceStartAt", transformType: "TRIM" },
        { sourceColumn: "Valeur", targetField: "purchaseValue", transformType: "TRIM" }
      ]
    });

    expect(report.rows[0].status).toBe("VALID");
    expect(report.rows[0].messages).toContain("OPERATION_CREATE");
    expect(report.rows[0].normalizedValues.purchaseValue).toBe("747000.18");
    expect(report.rows[0].normalizedValues.serviceStartAt).toBe("1974-07-01T00:00:00.000Z");
  });
});

describe("EquipmentsImportService", () => {
  function createPrismaMock(typeRows: Array<{ id: string; code: string; isActive: boolean }>) {
    return {
      equipmentType: { findMany: vi.fn().mockResolvedValue(typeRows) },
      equipmentModel: { findMany: vi.fn().mockResolvedValue([]) },
      equipmentStatus: { findMany: vi.fn().mockResolvedValue([{ id: "status-1", code: "EN_SERVICE", isActive: true }]) },
      ownerEntity: { findMany: vi.fn().mockResolvedValue([{ id: "owner-1", code: "CPRP", isActive: true }]) },
      immobilization: { findMany: vi.fn().mockResolvedValue([]) },
      spatialNode: {
        findMany: vi.fn().mockResolvedValue([{ id: "spatial-1", code: "B", path: "CPRPSNCF-MARSEILLE/LECLERC/R+1/B", externalRef: null, isActive: true }])
      },
      equipment: { findMany: vi.fn().mockResolvedValue([]) }
    };
  }

  it("resolves current spatial node by path", async () => {
    const service = new EquipmentsImportService(
      createPrismaMock([{ id: "type-1", code: "BUREAU", isActive: true }]) as never,
      { log: vi.fn() } as never,
      { recordForAssetMutation: vi.fn() } as never
    );
    const snapshot = await sourceSnapshot(["Code", "Type", "Statut", "Proprietaire", "Chemin"], [
      {
        Code: "IFC-001",
        Type: "BUREAU",
        Statut: "EN_SERVICE",
        Proprietaire: "CPRP",
        Chemin: "CPRPSNCF-MARSEILLE/LECLERC/R+1/B"
      }
    ]);

    const report = await service.buildImportReport({
      organizationId: "org-1",
      mode: "VALIDATE",
      sourceSnapshot: snapshot,
      mappings: [
        { sourceColumn: "Code", targetField: "internalCode", transformType: "TRIM" },
        { sourceColumn: "Type", targetField: "equipmentTypeCode", transformType: "TRIM" },
        { sourceColumn: "Statut", targetField: "equipmentStatusCode", transformType: "TRIM" },
        { sourceColumn: "Proprietaire", targetField: "ownerEntityCode", transformType: "TRIM" },
        { sourceColumn: "Chemin", targetField: "currentSpatialPath", transformType: "TRIM" }
      ]
    });

    expect(report.rows[0].status).toBe("VALID");
    expect(report.rows[0].messages).toContain("OPERATION_CREATE");
    expect(report.rows[0].normalizedValues.currentSpatialNodeId).toBe("spatial-1");
  });

  it("marks an unchanged existing equipment as NO_OP", async () => {
    const prisma = createPrismaMock([{ id: "type-1", code: "BUREAU", isActive: true }]);
    prisma.equipment.findMany.mockResolvedValue([
      {
        id: "equipment-1",
        internalCode: "IFC-001",
        numPiece: null,
        externalRef: null,
        serialNumber: null,
        equipmentTypeId: "type-1",
        equipmentModelId: null,
        equipmentStatusId: "status-1",
        ownerEntityId: "owner-1",
        currentSpatialNodeId: "spatial-1",
        immobilizationId: null,
        technicalCharacteristics: null,
        geometrySource: null,
        geometryMetadata: null,
        worldCenterX: null,
        worldCenterY: null,
        worldCenterZ: null,
        worldSizeX: null,
        worldSizeY: null,
        worldSizeZ: null,
        notes: null,
        receivedAt: null,
        commissionedAt: null,
        lastInventoryAt: null,
        isDeleted: false
      }
    ]);
    const service = new EquipmentsImportService(
      prisma as never,
      { log: vi.fn() } as never,
      { recordForAssetMutation: vi.fn() } as never
    );
    const snapshot = await sourceSnapshot(["Code", "Type", "Statut", "Proprietaire", "Chemin"], [
      {
        Code: "IFC-001",
        Type: "BUREAU",
        Statut: "EN_SERVICE",
        Proprietaire: "CPRP",
        Chemin: "CPRPSNCF-MARSEILLE/LECLERC/R+1/B"
      }
    ]);

    const report = await service.buildImportReport({
      organizationId: "org-1",
      mode: "VALIDATE",
      sourceSnapshot: snapshot,
      mappings: [
        { sourceColumn: "Code", targetField: "internalCode", transformType: "TRIM" },
        { sourceColumn: "Type", targetField: "equipmentTypeCode", transformType: "TRIM" },
        { sourceColumn: "Statut", targetField: "equipmentStatusCode", transformType: "TRIM" },
        { sourceColumn: "Proprietaire", targetField: "ownerEntityCode", transformType: "TRIM" },
        { sourceColumn: "Chemin", targetField: "currentSpatialPath", transformType: "TRIM" }
      ]
    });

    expect(report.rows[0].status).toBe("NO_OP");
    expect(report.rows[0].messages).toContain("OPERATION_NO_OP");
    expect(report.summary.simulatedWrites).toBe(0);
  });

  it("rejects equipment rows when the referenced type is missing", async () => {
    const service = new EquipmentsImportService(
      createPrismaMock([]) as never,
      { log: vi.fn() } as never,
      { recordForAssetMutation: vi.fn() } as never
    );
    const snapshot = await sourceSnapshot(["Code", "Type", "Statut", "Proprietaire"], [
      {
        Code: "IFC-001",
        Type: "BUREAU",
        Statut: "EN_SERVICE",
        Proprietaire: "CPRP"
      }
    ]);

    const report = await service.buildImportReport({
      organizationId: "org-1",
      mode: "VALIDATE",
      sourceSnapshot: snapshot,
      mappings: [
        { sourceColumn: "Code", targetField: "internalCode", transformType: "TRIM" },
        { sourceColumn: "Type", targetField: "equipmentTypeCode", transformType: "TRIM" },
        { sourceColumn: "Statut", targetField: "equipmentStatusCode", transformType: "TRIM" },
        { sourceColumn: "Proprietaire", targetField: "ownerEntityCode", transformType: "TRIM" }
      ]
    });

    expect(report.rows[0].status).toBe("REJECTED");
    expect(report.rows[0].messages).toContain("EQUIPMENT_TYPE_NOT_FOUND");
  });
});
