import { describe, expect, it } from "vitest";
import { buildIfcOpenShellBim3dScene } from "./bim-3d-ifc-scene";
import type { IfcGeometryExtraction } from "./ifc-geometry-worker";

describe("bim 3d ifcopenshell scene", () => {
  const extraction: IfcGeometryExtraction = {
    version: "ifcopenshell-extract-v1",
    source: {
      filename: "sample.ifc",
      schema: "IFC4"
    },
    units: {
      lengthUnit: "METRE",
      scaleToMeters: 1
    },
    globalBbox: {
      min: [100, 0, 200],
      max: [112, 4, 210]
    },
    spatialObjects: [
      {
        globalId: "building-1",
        ifcEntityId: 1,
        ifcClass: "IfcBuilding",
        name: "Batiment A",
        description: null,
        parentGlobalId: null,
        storeyGlobalId: null,
        bbox: { min: [100, 0, 200], max: [112, 4, 210] },
        center: [106, 2, 205],
        size: [12, 4, 10],
        hasGeometry: true,
        geometryError: null
      },
      {
        globalId: "storey-1",
        ifcEntityId: 2,
        ifcClass: "IfcBuildingStorey",
        name: "RDC",
        description: null,
        parentGlobalId: "building-1",
        storeyGlobalId: null,
        bbox: { min: [100, 0, 200], max: [112, 0.2, 210] },
        center: [106, 0.1, 205],
        size: [12, 0.2, 10],
        hasGeometry: true,
        geometryError: null,
        elevation: 0
      }
    ],
    products: [
      {
        globalId: "asset-1",
        ifcEntityId: 10,
        ifcClass: "IfcFurniture",
        name: "Bureau-001",
        description: "Bureau de travail",
        parentGlobalId: null,
        storeyGlobalId: "storey-1",
        bbox: { min: [102, 0, 203], max: [104, 1, 205] },
        center: [103, 0.5, 204],
        size: [2, 1, 2],
        hasGeometry: true,
        geometryError: null
      }
    ],
    storeys: [],
    stats: {
      totalProducts: 1,
      withGeometry: 1,
      withoutGeometry: 0,
      errors: 0
    },
    warnings: []
  };

  extraction.storeys = [extraction.spatialObjects[1]!];

  it("builds a scene from IfcOpenShell bounding boxes and recenters coordinates", () => {
    const scene = buildIfcOpenShellBim3dScene({
      mapId: "map-1",
      organizationId: "org-1",
      name: "Carte IFC",
      generatedAt: "2026-06-22T00:00:00.000Z",
      importJobId: null,
      sourceFilename: "sample.ifc",
      extraction,
      nodes: [],
      equipments: [],
      includeEquipments: true,
      includeFloorGuides: true
    });

    expect(scene.metadata.extractionEngine).toBe("ifcopenshell-python");
    expect(scene.metadata.geometrySource).toBe("ifcopenshell-bounding-boxes");
    expect(scene.floorGuides).toHaveLength(1);
    expect(scene.nodes).toHaveLength(2);
    expect(scene.equipments).toHaveLength(1);
    expect(scene.equipments[0]?.position.x).toBeCloseTo(-3);
    expect(scene.equipments[0]?.position.z).toBeCloseTo(-1);
    expect(scene.equipments[0]?.size.x).toBeCloseTo(2);
  });

  it("keeps fallback objects in a mixed scene when IFC geometry is missing", () => {
    const mixedExtraction: IfcGeometryExtraction = {
      ...extraction,
      products: [
        {
          ...extraction.products[0]!,
          globalId: "asset-missing",
          bbox: null,
          center: null,
          size: null,
          hasGeometry: false,
          geometryError: "NO_VERTICES"
        }
      ],
      stats: {
        totalProducts: 1,
        withGeometry: 0,
        withoutGeometry: 1,
        errors: 1
      }
    };
    const scene = buildIfcOpenShellBim3dScene({
      mapId: "map-2",
      organizationId: "org-1",
      name: "Carte mixte",
      generatedAt: "2026-06-22T00:00:00.000Z",
      importJobId: null,
      sourceFilename: "sample.ifc",
      extraction: mixedExtraction,
      nodes: [],
      equipments: [],
      includeEquipments: true,
      includeFloorGuides: true
    });

    expect(scene.metadata.geometrySource).toBe("mixed-ifc-fallback");
    expect(scene.equipments[0]?.geometrySource).toBe("mixed-ifc-fallback");
    expect(scene.equipments[0]?.fallbackReason).toBe("NO_VERTICES");
  });
});
