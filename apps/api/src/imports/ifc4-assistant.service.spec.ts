import { describe, expect, it, vi } from "vitest";
import { Ifc4AssistantService } from "./ifc4-assistant.service";

function buildPrismaMock() {
  return {
    equipmentCategory: { findMany: vi.fn().mockResolvedValue([]) },
    equipmentFamily: { findMany: vi.fn().mockResolvedValue([]) },
    equipmentSubfamily: { findMany: vi.fn().mockResolvedValue([]) },
    equipmentType: { findMany: vi.fn().mockResolvedValue([]) },
    equipmentBrand: { findMany: vi.fn().mockResolvedValue([]) },
    equipmentModel: { findMany: vi.fn().mockResolvedValue([]) },
    equipmentStatus: { findMany: vi.fn().mockResolvedValue([]) },
    ownerEntity: { findMany: vi.fn().mockResolvedValue([]) },
    spatialNode: { findMany: vi.fn().mockResolvedValue([]) }
  };
}

function buildGeometryWorkerMock() {
  return {
    extract: vi.fn().mockResolvedValue({
      version: "ifcopenshell-extract-v1",
      source: { filename: "sample.ifc", schema: "IFC4" },
      units: { lengthUnit: "METRE", scaleToMeters: 1 },
      globalBbox: { min: [0, 0, 0], max: [10, 10, 3] },
      spatialObjects: [
        {
          globalId: "SITEGUID",
          ifcEntityId: 1,
          ifcClass: "IfcSite",
          name: "Site principal",
          description: null,
          parentGlobalId: null,
          storeyGlobalId: null,
          bbox: { min: [0, 0, 0], max: [10, 10, 3] },
          center: [5, 5, 1.5],
          size: [10, 10, 3],
          hasGeometry: true,
          geometryError: null
        },
        {
          globalId: "BLDGID",
          ifcEntityId: 2,
          ifcClass: "IfcBuilding",
          name: "Batiment A",
          description: null,
          parentGlobalId: "SITEGUID",
          storeyGlobalId: null,
          bbox: { min: [0, 0, 0], max: [10, 10, 3] },
          center: [5, 5, 1.5],
          size: [10, 10, 3],
          hasGeometry: true,
          geometryError: null
        },
        {
          globalId: "FLOORID",
          ifcEntityId: 3,
          ifcClass: "IfcBuildingStorey",
          name: "R+1",
          description: null,
          parentGlobalId: "BLDGID",
          storeyGlobalId: null,
          bbox: { min: [0, 0, 0], max: [10, 10, 0.2] },
          center: [5, 5, 0.1],
          size: [10, 10, 0.2],
          hasGeometry: true,
          geometryError: null
        }
      ],
      products: [
        {
          globalId: "FURNGUID",
          ifcEntityId: 4,
          ifcClass: "IfcFurniture",
          name: "Bureau 1",
          description: "Bureau",
          parentGlobalId: null,
          storeyGlobalId: "FLOORID",
          bbox: { min: [1, 1, 0], max: [2, 2, 1] },
          center: [1.5, 1.5, 0.5],
          size: [1, 1, 1],
          hasGeometry: true,
          geometryError: null
        }
      ],
      storeys: [],
      stats: { totalProducts: 1, withGeometry: 1, withoutGeometry: 0, errors: 0 },
      warnings: []
    })
  };
}

const IFC_SAMPLE = `ISO-10303-21;
HEADER;
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCSITE('SITEGUID',$,'Site principal',$,$,$,$,$,$,$,$,$,$);
#2=IFCBUILDING('BLDGID',$,'Batiment A',$,$,$,$,$,$,$,$,$);
#3=IFCBUILDINGSTOREY('FLOORID',$,'R+1',$,$,$,$,$,$);
#4=IFCFURNITURE('FURNGUID',$,'Bureau 1',$,'Bureau',$,$,$,$);
#5=IFCPROPERTYSINGLEVALUE('Zone',$,IFCLABEL('B'),$);
#6=IFCPROPERTYSINGLEVALUE('Etage',$,IFCLABEL('1'),$);
#7=IFCPROPERTYSINGLEVALUE('ID unique',$,IFCLABEL('MOB-001'),$);
#8=IFCPROPERTYSINGLEVALUE('Type de mobilier',$,IFCLABEL('Bureau'),$);
#9=IFCPROPERTYSET('PSETGUID',$,'Infos',$,(#5,#6,#7,#8));
#10=IFCRELDEFINESBYPROPERTIES('RELPROP',$,$,$,(#4),#9);
#11=IFCRELAGGREGATES('REL1',$,$,$,#1,(#2));
#12=IFCRELAGGREGATES('REL2',$,$,$,#2,(#3));
#13=IFCRELCONTAINEDINSPATIALSTRUCTURE('REL3',$,$,$,(#4),#3);
ENDSEC;
END-ISO-10303-21;`;

describe("Ifc4AssistantService", () => {
  it("extracts spatial preview, references and equipment rows from IFC4", async () => {
    const service = new Ifc4AssistantService(
      buildPrismaMock() as never,
      { createPreparedJob: vi.fn() } as never,
      { log: vi.fn() } as never,
      buildGeometryWorkerMock() as never
    );

    const analysis = await service.analyze(
      { organizationId: "org-1" } as never,
      {
        originalname: "sample.ifc",
        buffer: Buffer.from(IFC_SAMPLE, "utf8")
      }
    );

    expect(analysis.schema).toBe("IFC4");
    expect(analysis.spatialNodes.some((node) => node.type === "ZONE" && node.code === "B")).toBe(true);
    expect(analysis.equipmentRows).toHaveLength(1);
    expect(analysis.equipmentRows[0].internalCode).toBe("MOB-001");
    expect(analysis.equipmentRows[0].geometry?.geometryStatus).toBe("READY");
    expect(analysis.equipmentRows[0].properties.Zone).toBe("B");
    expect(analysis.assetReferences.some((reference) => reference.resource === "types" && reference.code === "BUREAU")).toBe(true);
  });

  it("applies spatial type overrides and keeps aggregated geometry on derived nodes", async () => {
    const createPreparedJob = vi.fn().mockResolvedValue({ id: "job-1", targetDomain: "spatial-nodes" });
    const service = new Ifc4AssistantService(
      buildPrismaMock() as never,
      { createPreparedJob } as never,
      { log: vi.fn() } as never,
      buildGeometryWorkerMock() as never
    );
    const analysis = await service.analyze(
      { organizationId: "org-1" } as never,
      {
        originalname: "sample.ifc",
        buffer: Buffer.from(IFC_SAMPLE, "utf8")
      }
    );
    const zone = analysis.spatialNodes.find((node) => node.type === "ZONE" && node.code === "B");

    await service.createSpatialJob(
      { organizationId: "org-1" } as never,
      {
        originalname: "sample.ifc",
        mimetype: "application/octet-stream",
        buffer: Buffer.from(IFC_SAMPLE, "utf8")
      },
      {
        spatialOverrides: JSON.stringify([{ path: zone?.path, type: "ROOM" }])
      }
    );

    const preparedInput = createPreparedJob.mock.calls[0][1];
    const overriddenRow = preparedInput.rawRows.find((row: { values: Record<string, string | null> }) => row.values.path === zone?.path);
    expect(overriddenRow.values.type).toBe("ROOM");
    expect(overriddenRow.values.geometrySource).toMatch(/^ifcopenshell-python/);
  });

  it("reports a ready child as not importable when its parent geometry is missing", async () => {
    const geometryWorker = buildGeometryWorkerMock();
    geometryWorker.extract.mockResolvedValueOnce({
      ...await geometryWorker.extract(),
      spatialObjects: [
        {
          globalId: "SITEGUID",
          ifcEntityId: 1,
          ifcClass: "IfcSite",
          name: "Site principal",
          description: null,
          parentGlobalId: null,
          storeyGlobalId: null,
          bbox: null,
          center: null,
          size: null,
          hasGeometry: false,
          geometryError: "No shape"
        },
        {
          globalId: "BLDGID",
          ifcEntityId: 2,
          ifcClass: "IfcBuilding",
          name: "Batiment A",
          description: null,
          parentGlobalId: "SITEGUID",
          storeyGlobalId: null,
          bbox: { min: [0, 0, 0], max: [10, 10, 3] },
          center: [5, 5, 1.5],
          size: [10, 10, 3],
          hasGeometry: true,
          geometryError: null
        }
      ],
      products: []
    });
    const service = new Ifc4AssistantService(
      buildPrismaMock() as never,
      { createPreparedJob: vi.fn() } as never,
      { log: vi.fn() } as never,
      geometryWorker as never
    );
    const analysis = await service.analyze(
      { organizationId: "org-1" } as never,
      { originalname: "sample.ifc", buffer: Buffer.from(IFC_SAMPLE, "utf8") }
    );

    const diagnostics = await (service as unknown as {
      buildGeometryDiagnostics: (organizationId: string, analysis: typeof analysis) => Promise<{
        items: Array<{ path: string | null; status: string; reasonCode: string | null; importable: boolean }>;
      }>;
    }).buildGeometryDiagnostics("org-1", analysis);

    const building = diagnostics.items.find((item) => item.path === "SITE-PRINCIPAL/BATIMENT-A");
    expect(building?.status).toBe("PARENT_INVALID");
    expect(building?.reasonCode).toBe("PARENT_GEOMETRY_INVALID");
    expect(building?.importable).toBe(false);
  });

  it("creates a partial spatial job with only importable rows when requested", async () => {
    const createPreparedJob = vi.fn().mockResolvedValue({ id: "job-1", targetDomain: "spatial-nodes" });
    const geometryWorker = buildGeometryWorkerMock();
    geometryWorker.extract.mockResolvedValueOnce({
      ...await geometryWorker.extract(),
      spatialObjects: [
        {
          globalId: "SITEGUID",
          ifcEntityId: 1,
          ifcClass: "IfcSite",
          name: "Site principal",
          description: null,
          parentGlobalId: null,
          storeyGlobalId: null,
          bbox: { min: [0, 0, 0], max: [10, 10, 3] },
          center: [5, 5, 1.5],
          size: [10, 10, 3],
          hasGeometry: true,
          geometryError: null
        },
        {
          globalId: "BLDGID",
          ifcEntityId: 2,
          ifcClass: "IfcBuilding",
          name: "Batiment A",
          description: null,
          parentGlobalId: "SITEGUID",
          storeyGlobalId: null,
          bbox: null,
          center: null,
          size: null,
          hasGeometry: false,
          geometryError: "No shape"
        }
      ],
      products: []
    });
    const service = new Ifc4AssistantService(
      buildPrismaMock() as never,
      { createPreparedJob } as never,
      { log: vi.fn() } as never,
      geometryWorker as never
    );

    await service.createSpatialJob(
      { organizationId: "org-1" } as never,
      {
        originalname: "sample.ifc",
        mimetype: "application/octet-stream",
        buffer: Buffer.from(IFC_SAMPLE, "utf8")
      },
      { importPolicy: "IMPORT_READY_ONLY" }
    );

    const preparedInput = createPreparedJob.mock.calls[0][1];
    expect(preparedInput.rawRows.some((row: { values: Record<string, string | null> }) => row.values.path === "SITE-PRINCIPAL")).toBe(true);
    expect(preparedInput.rawRows.some((row: { values: Record<string, string | null> }) => row.values.path === "SITE-PRINCIPAL/BATIMENT-A")).toBe(false);
    expect(preparedInput.options.ifcGeometryExcludedDiagnostics.some((item: { path: string }) => item.path === "SITE-PRINCIPAL/BATIMENT-A")).toBe(true);
  });
});
