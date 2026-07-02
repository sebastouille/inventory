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

const IFC_ROOM_NUMBER_EQUIPMENT_SAMPLE = `ISO-10303-21;
HEADER;
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCSITE('SITEGUID',$,'Site principal',$,$,$,$,$,$,$,$,$,$);
#2=IFCBUILDING('BLDGID',$,'Batiment A',$,$,$,$,$,$,$,$,$);
#3=IFCBUILDINGSTOREY('FLOORID',$,'R+5',$,$,$,$,$,$);
#4=IFCFURNITURE('FURNGUID',$,'Bureau 1',$,'Bureau',$,$,$,$);
#5=IFCSPACE('SPACEGUID',$,'014',$,$,$,$,$,$,$,$);
#6=IFCPROPERTYSINGLEVALUE('Zone',$,IFCLABEL('B'),$);
#7=IFCPROPERTYSINGLEVALUE('N de piece',$,IFCLABEL('B520'),$);
#8=IFCPROPERTYSINGLEVALUE('ID unique',$,IFCLABEL('MOB-001'),$);
#9=IFCPROPERTYSINGLEVALUE('Type de mobilier',$,IFCLABEL('Bureau'),$);
#10=IFCPROPERTYSET('PSET-EQ',$,'Infos equipement',$,(#7,#8,#9));
#11=IFCPROPERTYSET('PSET-ROOM',$,'Infos piece',$,(#6,#7));
#12=IFCRELDEFINESBYPROPERTIES('RELPROP-EQ',$,$,$,(#4),#10);
#13=IFCRELDEFINESBYPROPERTIES('RELPROP-ROOM',$,$,$,(#5),#11);
#14=IFCRELAGGREGATES('REL1',$,$,$,#1,(#2));
#15=IFCRELAGGREGATES('REL2',$,$,$,#2,(#3));
#16=IFCRELAGGREGATES('REL3',$,$,$,#3,(#5));
#17=IFCRELCONTAINEDINSPATIALSTRUCTURE('REL4',$,$,$,(#4),#3);
ENDSEC;
END-ISO-10303-21;`;

const IFC_DUPLICATE_ROOM_NUMBER_SAMPLE = `ISO-10303-21;
HEADER;
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCSITE('SITEGUID',$,'Site principal',$,$,$,$,$,$,$,$,$,$);
#2=IFCBUILDING('BLDGID',$,'Batiment A',$,$,$,$,$,$,$,$,$);
#3=IFCBUILDINGSTOREY('FLOORID',$,'R+5',$,$,$,$,$,$);
#4=IFCSPACE('SPACEGUID1',$,'014',$,$,$,$,$,$,$,$);
#5=IFCSPACE('SPACEGUID2',$,'015',$,$,$,$,$,$,$,$);
#6=IFCPROPERTYSINGLEVALUE('Zone',$,IFCLABEL('B'),$);
#7=IFCPROPERTYSINGLEVALUE('N de piece',$,IFCLABEL('B520'),$);
#8=IFCPROPERTYSET('PSET-ROOM',$,'Infos piece',$,(#6,#7));
#9=IFCRELDEFINESBYPROPERTIES('RELPROP-ROOM',$,$,$,(#4,#5),#8);
#10=IFCRELAGGREGATES('REL1',$,$,$,#1,(#2));
#11=IFCRELAGGREGATES('REL2',$,$,$,#2,(#3));
#12=IFCRELAGGREGATES('REL3',$,$,$,#3,(#4,#5));
ENDSEC;
END-ISO-10303-21;`;

const IFC_SPACE_ZONE_SAMPLE = `ISO-10303-21;
HEADER;
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCSITE('SITEGUID',$,'Site principal',$,$,$,$,$,$,$,$,$,$);
#2=IFCBUILDING('BLDGID',$,'Batiment A',$,$,$,$,$,$,$,$,$);
#3=IFCBUILDINGSTOREY('FLOORID',$,'RDC',$,$,$,$,$,$);
#4=IFCSPACE('SPACEGUID',$,'Bureau 101',$,$,$,$,$,$,$,$);
#5=IFCPROPERTYSINGLEVALUE('Zone',$,IFCLABEL('A'),$);
#6=IFCPROPERTYSET('PSETGUID',$,'Infos',$,(#5));
#7=IFCRELDEFINESBYPROPERTIES('RELPROP',$,$,$,(#4),#6);
#8=IFCRELAGGREGATES('REL1',$,$,$,#1,(#2));
#9=IFCRELAGGREGATES('REL2',$,$,$,#2,(#3));
#10=IFCRELAGGREGATES('REL3',$,$,$,#3,(#4));
ENDSEC;
END-ISO-10303-21;`;

const IFC_SPACE_ZONE_WITHOUT_STOREY_SAMPLE = `ISO-10303-21;
HEADER;
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCSITE('SITEGUID',$,'Site principal',$,$,$,$,$,$,$,$,$,$);
#2=IFCBUILDING('BLDGID',$,'Batiment A',$,$,$,$,$,$,$,$,$);
#4=IFCSPACE('SPACEGUID',$,'Bureau 101',$,$,$,$,$,$,$,$);
#5=IFCPROPERTYSINGLEVALUE('Zone',$,IFCLABEL('A'),$);
#6=IFCPROPERTYSET('PSETGUID',$,'Infos',$,(#5));
#7=IFCRELDEFINESBYPROPERTIES('RELPROP',$,$,$,(#4),#6);
#8=IFCRELAGGREGATES('REL1',$,$,$,#1,(#2));
#9=IFCRELAGGREGATES('REL2',$,$,$,#2,(#4));
ENDSEC;
END-ISO-10303-21;`;

describe("Ifc4AssistantService", () => {
  it("attaches IFC equipments to the room matching the room number property", async () => {
    const geometryWorker = buildGeometryWorkerMock();
    const baseExtraction = await geometryWorker.extract();
    geometryWorker.extract.mockResolvedValueOnce({
      ...baseExtraction,
      spatialObjects: [
        ...baseExtraction.spatialObjects,
        {
          globalId: "SPACEGUID",
          ifcEntityId: 5,
          ifcClass: "IfcSpace",
          name: "014",
          description: null,
          parentGlobalId: "FLOORID",
          storeyGlobalId: "FLOORID",
          bbox: { min: [1, 1, 0], max: [3, 3, 2.5] },
          center: [2, 2, 1.25],
          size: [2, 2, 2.5],
          hasGeometry: true,
          geometryError: null
        }
      ]
    });
    const service = new Ifc4AssistantService(
      buildPrismaMock() as never,
      { createPreparedJob: vi.fn() } as never,
      { log: vi.fn() } as never,
      geometryWorker as never
    );

    const analysis = await service.analyze(
      { organizationId: "org-1" } as never,
      {
        originalname: "sample.ifc",
        buffer: Buffer.from(IFC_ROOM_NUMBER_EQUIPMENT_SAMPLE, "utf8")
      }
    );

    expect(analysis.equipmentRows[0].numPiece).toBe("B520");
    expect(analysis.equipmentRows[0].currentSpatialPath).toBe("SITE-PRINCIPAL/BATIMENT-A/R+5/B/014");
  });

  it("reports duplicate room numbers inside the same building", async () => {
    const geometryWorker = buildGeometryWorkerMock();
    const baseExtraction = await geometryWorker.extract();
    geometryWorker.extract.mockResolvedValueOnce({
      ...baseExtraction,
      spatialObjects: [
        ...baseExtraction.spatialObjects,
        {
          globalId: "SPACEGUID1",
          ifcEntityId: 4,
          ifcClass: "IfcSpace",
          name: "014",
          description: null,
          parentGlobalId: "FLOORID",
          storeyGlobalId: "FLOORID",
          bbox: { min: [1, 1, 0], max: [2, 2, 2.5] },
          center: [1.5, 1.5, 1.25],
          size: [1, 1, 2.5],
          hasGeometry: true,
          geometryError: null
        },
        {
          globalId: "SPACEGUID2",
          ifcEntityId: 5,
          ifcClass: "IfcSpace",
          name: "015",
          description: null,
          parentGlobalId: "FLOORID",
          storeyGlobalId: "FLOORID",
          bbox: { min: [3, 3, 0], max: [4, 4, 2.5] },
          center: [3.5, 3.5, 1.25],
          size: [1, 1, 2.5],
          hasGeometry: true,
          geometryError: null
        }
      ]
    });
    const service = new Ifc4AssistantService(
      buildPrismaMock() as never,
      { createPreparedJob: vi.fn() } as never,
      { log: vi.fn() } as never,
      geometryWorker as never
    );

    const analysis = await service.analyze(
      { organizationId: "org-1" } as never,
      {
        originalname: "sample.ifc",
        buffer: Buffer.from(IFC_DUPLICATE_ROOM_NUMBER_SAMPLE, "utf8")
      }
    );

    const duplicateRooms = analysis.spatialNodes.filter((node) => node.geometry?.geometryMetadata?.reasonCode === "ROOM_NUMBER_DUPLICATE");
    expect(duplicateRooms).toHaveLength(2);
    expect(analysis.warnings).toContain("ROOM_NUMBER_DUPLICATE:B520");
  });

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

  it("keeps a mapped model even when the IFC manufacturer is empty", async () => {
    const service = new Ifc4AssistantService(
      buildPrismaMock() as never,
      { createPreparedJob: vi.fn() } as never,
      { log: vi.fn() } as never,
      buildGeometryWorkerMock() as never
    );
    const ifcWithModelOnly = IFC_SAMPLE.replace(
      "#9=IFCPROPERTYSET('PSETGUID',$,'Infos',$,(#5,#6,#7,#8));",
      "#14=IFCPROPERTYSINGLEVALUE('Modele/Gamme',$,IFCLABEL('BASIC'),$);\n#9=IFCPROPERTYSET('PSETGUID',$,'Infos',$,(#5,#6,#7,#8,#14));"
    );

    const analysis = await service.analyze(
      { organizationId: "org-1" } as never,
      {
        originalname: "sample.ifc",
        buffer: Buffer.from(ifcWithModelOnly, "utf8")
      }
    );

    expect(analysis.equipmentRows[0].equipmentModelCode).toBe("NON_DEFINI__BASIC");
    expect(analysis.assetReferences.some((reference) => reference.resource === "brands" && reference.code === "NON_DEFINI")).toBe(true);
    expect(analysis.assetReferences.some((reference) => reference.resource === "models" && reference.code === "NON_DEFINI__BASIC")).toBe(true);
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
      buildGeometryDiagnostics: (organizationId: string, analysis: unknown) => Promise<{
        items: Array<{ path: string | null; status: string; reasonCode: string | null; importable: boolean }>;
      }>;
    }).buildGeometryDiagnostics("org-1", analysis);

    const building = diagnostics.items.find((item) => item.path === "SITE-PRINCIPAL/BATIMENT-A");
    expect(building?.status).toBe("PARENT_INVALID");
    expect(building?.reasonCode).toBe("PARENT_GEOMETRY_INVALID");
    expect(building?.importable).toBe(false);
  });

  it("derives IFCBUILDINGSTOREY geometry from the parent building and keeps descendants importable", async () => {
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
          bbox: { min: [0, 0, 0], max: [20, 4, 20] },
          center: [10, 2, 10],
          size: [20, 4, 20],
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
          bbox: { min: [0, 0, 0], max: [20, 4, 20] },
          center: [10, 2, 10],
          size: [20, 4, 20],
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
          bbox: null,
          center: null,
          size: null,
          hasGeometry: false,
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
          bbox: { min: [1, 1, 2], max: [3, 2, 5] },
          center: [2, 1.5, 3.5],
          size: [2, 1, 3],
          hasGeometry: true,
          geometryError: null
        }
      ]
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

    const floor = analysis.spatialNodes.find((node) => node.sourceClass === "IFCBUILDINGSTOREY");
    expect(floor?.geometry?.geometryStatus).toBe("READY");
    expect(floor?.geometry?.geometrySource).toBe("ifc-storey-derived-from-building");
    expect(floor?.geometry?.geometryMessage).toContain("batiment parent");
    expect(floor?.geometry?.worldSize?.x).toBeCloseTo(20);
    expect(floor?.geometry?.worldSize?.y).toBeCloseTo(0.08);
    expect(floor?.geometry?.worldSize?.z).toBeCloseTo(20);

    const diagnostics = await (service as unknown as {
      buildGeometryDiagnostics: (organizationId: string, analysis: unknown) => Promise<{
        summary: { derivedStoreys: number };
        items: Array<{ path: string | null; status: string; reasonCode: string | null; importable: boolean }>;
      }>;
    }).buildGeometryDiagnostics("org-1", analysis);

    const floorDiagnostic = diagnostics.items.find((item) => item.path === floor?.path);
    const childDiagnostic = diagnostics.items.find((item) => item.path?.startsWith(`${floor?.path}/`));
    expect(diagnostics.summary.derivedStoreys).toBe(1);
    expect(floorDiagnostic?.status).toBe("DERIVED");
    expect(floorDiagnostic?.reasonCode).toBe("STOREY_GEOMETRY_DERIVED");
    expect(floorDiagnostic?.importable).toBe(true);
    expect(childDiagnostic?.reasonCode).not.toBe("PARENT_GEOMETRY_INVALID");
  });

  it("derives IFC_PROPERTY_ZONE geometry from IFCSPACE children and keeps spaces importable", async () => {
    const geometryWorker = buildGeometryWorkerMock();
    geometryWorker.extract.mockResolvedValueOnce({
      version: "ifcopenshell-extract-v1",
      source: { filename: "spaces.ifc", schema: "IFC4" },
      units: { lengthUnit: "METRE", scaleToMeters: 1 },
      globalBbox: { min: [0, 0, 0], max: [20, 4, 20] },
      spatialObjects: [
        {
          globalId: "SITEGUID",
          ifcEntityId: 1,
          ifcClass: "IfcSite",
          name: "Site principal",
          description: null,
          parentGlobalId: null,
          storeyGlobalId: null,
          bbox: { min: [0, 0, 0], max: [20, 4, 20] },
          center: [10, 2, 10],
          size: [20, 4, 20],
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
          bbox: { min: [0, 0, 0], max: [20, 4, 20] },
          center: [10, 2, 10],
          size: [20, 4, 20],
          hasGeometry: true,
          geometryError: null
        },
        {
          globalId: "FLOORID",
          ifcEntityId: 3,
          ifcClass: "IfcBuildingStorey",
          name: "RDC",
          description: null,
          parentGlobalId: "BLDGID",
          storeyGlobalId: null,
          bbox: { min: [0, 0, 0], max: [20, 0.08, 20] },
          center: [10, 0.04, 10],
          size: [20, 0.08, 20],
          hasGeometry: true,
          geometryError: null
        },
        {
          globalId: "SPACEGUID",
          ifcEntityId: 4,
          ifcClass: "IfcSpace",
          name: "Bureau 101",
          description: null,
          parentGlobalId: "FLOORID",
          storeyGlobalId: "FLOORID",
          bbox: { min: [2, 0, 3], max: [7, 2.8, 8] },
          center: [4.5, 1.4, 5.5],
          size: [5, 2.8, 5],
          hasGeometry: true,
          geometryError: null
        }
      ],
      products: [],
      storeys: [],
      stats: { totalProducts: 0, withGeometry: 0, withoutGeometry: 0, errors: 0 },
      warnings: []
    });
    const service = new Ifc4AssistantService(
      buildPrismaMock() as never,
      { createPreparedJob: vi.fn() } as never,
      { log: vi.fn() } as never,
      geometryWorker as never
    );

    const analysis = await service.analyze(
      { organizationId: "org-1" } as never,
      { originalname: "spaces.ifc", buffer: Buffer.from(IFC_SPACE_ZONE_SAMPLE, "utf8") }
    );

    const zone = analysis.spatialNodes.find((node) => node.sourceClass === "IFC_PROPERTY_ZONE" && node.code === "A");
    const space = analysis.spatialNodes.find((node) => node.sourceClass === "IFCSPACE");
    const floor = analysis.spatialNodes.find((node) => node.sourceClass === "IFCBUILDINGSTOREY");
    expect(zone?.geometry?.geometryStatus).toBe("READY");
    expect(zone?.geometry?.geometrySource).toBe("ifc-zone-derived-from-spaces");
    expect(zone?.geometry?.geometryMessage).toContain("espaces enfants");
    expect(zone?.geometry?.worldSize?.x).toBeCloseTo(5);
    expect(zone?.geometry?.worldSize?.y).toBeCloseTo(2.8);
    expect(zone?.geometry?.worldSize?.z).toBeCloseTo(5);
    expect(zone?.parentPath).toBe(floor?.path);
    expect(zone?.sourceMetadata?.parentSource).toBe("ifc-building-storey-relation");
    expect(space?.parentPath).toBe(zone?.path);

    const diagnostics = await (service as unknown as {
      buildGeometryDiagnostics: (organizationId: string, analysis: unknown) => Promise<{
        summary: { derivedZones: number };
        items: Array<{ path: string | null; status: string; reasonCode: string | null; importable: boolean }>;
      }>;
    }).buildGeometryDiagnostics("org-1", analysis);

    const zoneDiagnostic = diagnostics.items.find((item) => item.path === zone?.path);
    const spaceDiagnostic = diagnostics.items.find((item) => item.path === space?.path);
    expect(diagnostics.summary.derivedZones).toBe(1);
    expect(zoneDiagnostic?.status).toBe("DERIVED");
    expect(zoneDiagnostic?.reasonCode).toBe("ZONE_GEOMETRY_DERIVED");
    expect(zoneDiagnostic?.importable).toBe(true);
    expect(spaceDiagnostic?.reasonCode).not.toBe("PARENT_GEOMETRY_INVALID");
    expect(spaceDiagnostic?.importable).toBe(true);
  });

  it("rejects IFCSPACE zone attachment in strict mode when no IFCBUILDINGSTOREY relation exists", async () => {
    const geometryWorker = buildGeometryWorkerMock();
    geometryWorker.extract.mockResolvedValueOnce({
      version: "ifcopenshell-extract-v1",
      source: { filename: "spaces-no-storey.ifc", schema: "IFC4" },
      units: { lengthUnit: "METRE", scaleToMeters: 1 },
      globalBbox: { min: [0, 0, 0], max: [20, 4, 20] },
      spatialObjects: [
        {
          globalId: "SITEGUID",
          ifcEntityId: 1,
          ifcClass: "IfcSite",
          name: "Site principal",
          description: null,
          parentGlobalId: null,
          storeyGlobalId: null,
          bbox: { min: [0, 0, 0], max: [20, 4, 20] },
          center: [10, 2, 10],
          size: [20, 4, 20],
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
          bbox: { min: [0, 0, 0], max: [20, 4, 20] },
          center: [10, 2, 10],
          size: [20, 4, 20],
          hasGeometry: true,
          geometryError: null
        },
        {
          globalId: "SPACEGUID",
          ifcEntityId: 4,
          ifcClass: "IfcSpace",
          name: "Bureau 101",
          description: null,
          parentGlobalId: "BLDGID",
          storeyGlobalId: null,
          bbox: { min: [2, 0, 3], max: [7, 2.8, 8] },
          center: [4.5, 1.4, 5.5],
          size: [5, 2.8, 5],
          hasGeometry: true,
          geometryError: null
        }
      ],
      products: [],
      storeys: [],
      stats: { totalProducts: 0, withGeometry: 0, withoutGeometry: 0, errors: 0 },
      warnings: []
    });
    const service = new Ifc4AssistantService(
      buildPrismaMock() as never,
      { createPreparedJob: vi.fn() } as never,
      { log: vi.fn() } as never,
      geometryWorker as never
    );

    const analysis = await service.analyze(
      { organizationId: "org-1" } as never,
      { originalname: "spaces-no-storey.ifc", buffer: Buffer.from(IFC_SPACE_ZONE_WITHOUT_STOREY_SAMPLE, "utf8") },
      { importPolicy: "STRICT_ALL_READY" }
    );

    const zone = analysis.spatialNodes.find((node) => node.sourceClass === "IFC_PROPERTY_ZONE" && node.code === "A");
    const space = analysis.spatialNodes.find((node) => node.sourceClass === "IFCSPACE");
    expect(zone).toBeUndefined();
    expect(space?.geometry?.geometryStatus).toBe("ERROR");
    expect(space?.geometry?.geometryMetadata?.reasonCode).toBe("IFC_STOREY_RELATION_MISSING");

    const diagnostics = await (service as unknown as {
      buildGeometryDiagnostics: (organizationId: string, analysis: unknown) => Promise<{
        items: Array<{ path: string | null; status: string; reasonCode: string | null; importable: boolean; messages: string[] }>;
      }>;
    }).buildGeometryDiagnostics("org-1", analysis);

    const spaceDiagnostic = diagnostics.items.find((item) => item.path === space?.path);
    expect(spaceDiagnostic?.status).toBe("ERROR");
    expect(spaceDiagnostic?.reasonCode).toBe("GEOMETRY_ERROR");
    expect(spaceDiagnostic?.importable).toBe(false);
    expect(spaceDiagnostic?.messages.join(" ")).toContain("IFCBUILDINGSTOREY");
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
