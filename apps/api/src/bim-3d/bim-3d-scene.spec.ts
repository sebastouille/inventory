import { describe, expect, it } from "vitest";
import { buildSimplifiedBim3dScene, getInventoryAgeBucket } from "./bim-3d-scene";

describe("bim 3d scene", () => {
  const referenceDate = new Date("2026-06-22T00:00:00.000Z");

  it("maps inventory age to heatmap buckets", () => {
    expect(getInventoryAgeBucket("2026-06-01T00:00:00.000Z", referenceDate)).toBe("FRESH");
    expect(getInventoryAgeBucket("2026-04-01T00:00:00.000Z", referenceDate)).toBe("RECENT");
    expect(getInventoryAgeBucket("2026-01-15T00:00:00.000Z", referenceDate)).toBe("WARNING");
    expect(getInventoryAgeBucket("2025-08-01T00:00:00.000Z", referenceDate)).toBe("STALE");
    expect(getInventoryAgeBucket("2024-01-01T00:00:00.000Z", referenceDate)).toBe("CRITICAL");
    expect(getInventoryAgeBucket(null, referenceDate)).toBe("UNKNOWN");
  });

  it("builds a deterministic simplified scene with node summaries", () => {
    const scene = buildSimplifiedBim3dScene({
      mapId: "map-1",
      organizationId: "org-1",
      name: "Carte test",
      generatedAt: referenceDate.toISOString(),
      importJobId: null,
      sourceFilename: null,
      nodes: [
        {
          id: "site-1",
          type: "SITE",
          code: "HQ",
          label: "Site",
          path: "HQ",
          parentId: null,
          sourceGlobalId: null,
          isIfcSource: false,
          equipmentsCount: 1
        },
        {
          id: "room-1",
          type: "ROOM",
          code: "B001",
          label: "Bureau 001",
          path: "HQ/B001",
          parentId: "site-1",
          sourceGlobalId: "ifc-room-1",
          isIfcSource: true,
          equipmentsCount: 1
        }
      ],
      equipments: [
        {
          id: "asset-1",
          internalCode: "AST-001",
          label: "AST-001 - Laptop",
          spatialNodeId: "room-1",
          spatialPath: "HQ/B001",
          sourceGlobalId: "ifc-asset-1",
          lastInventoryAt: "2024-01-01T00:00:00.000Z",
          statusLabel: "En service",
          familyLabel: "Ordinateur",
          typeLabel: "Laptop"
        }
      ]
    });

    expect(scene.metadata.nodesCount).toBe(2);
    expect(scene.metadata.equipmentsCount).toBe(1);
    expect(scene.limits.mode).toBe("ifc-simplified");
    expect(scene.equipments[0]?.ageBucket).toBe("CRITICAL");
    expect(scene.nodes.find((node) => node.id === "site-1")?.ageSummary.critical).toBe(1);
    expect(scene.nodes.find((node) => node.id === "room-1")?.bbox.min.x).toBeLessThan(
      scene.nodes.find((node) => node.id === "room-1")?.bbox.max.x ?? 0
    );
  });

  it("keeps spatial fallback mode when nodes are not sourced from IFC", () => {
    const scene = buildSimplifiedBim3dScene({
      mapId: "map-2",
      organizationId: "org-1",
      name: "Carte fallback",
      generatedAt: referenceDate.toISOString(),
      importJobId: null,
      sourceFilename: null,
      nodes: [
        {
          id: "site-1",
          type: "SITE",
          code: "HQ",
          label: "Site",
          path: "HQ",
          parentId: null,
          sourceGlobalId: "LEGACY-HQ",
          isIfcSource: false,
          equipmentsCount: 0
        }
      ],
      equipments: []
    });

    expect(scene.limits.mode).toBe("spatial-fallback");
  });
});
