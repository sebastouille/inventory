import type {
  Bim3dAgeBucket,
  Bim3dAgeSummary,
  Bim3dBoundingBox,
  Bim3dFloorGuide,
  Bim3dScene,
  Bim3dSceneEquipment,
  Bim3dSceneNode,
  Bim3dVector3,
  SpatialNodeType
} from "@inventory/shared";
import type { Bim3dEquipmentInput, Bim3dSpatialNodeInput } from "./bim-3d-scene";
import { BIM3D_HEATMAP_COLORS, getInventoryAgeBucket } from "./bim-3d-scene";
import type { IfcExtractBoundingBox, IfcExtractObject, IfcGeometryExtraction } from "./ifc-geometry-worker";

interface BuildIfcSceneInput {
  mapId: string;
  organizationId: string;
  name: string;
  generatedAt: string;
  importJobId: string | null;
  sourceFilename: string | null;
  extraction: IfcGeometryExtraction;
  nodes: Bim3dSpatialNodeInput[];
  equipments: Bim3dEquipmentInput[];
  includeEquipments: boolean;
  includeFloorGuides: boolean;
}

const NODE_COLORS: Record<SpatialNodeType, string> = {
  SITE: "#0f766e",
  BUILDING: "#0369a1",
  FLOOR: "#0891b2",
  ZONE: "#f59e0b",
  ROOM: "#2563eb",
  LOCATION: "#64748b"
};

const AGE_SUMMARY_KEYS = {
  FRESH: "fresh",
  RECENT: "recent",
  WARNING: "warning",
  STALE: "stale",
  CRITICAL: "critical",
  UNKNOWN: "unknown"
} as const satisfies Record<Bim3dAgeBucket, keyof Bim3dAgeSummary>;

function emptyAgeSummary(): Bim3dAgeSummary {
  return {
    fresh: 0,
    recent: 0,
    warning: 0,
    stale: 0,
    critical: 0,
    unknown: 0
  };
}

function toVector(value: [number, number, number]): Bim3dVector3 {
  return { x: value[0], y: value[1], z: value[2] };
}

function toBox(value: IfcExtractBoundingBox | null): Bim3dBoundingBox | null {
  if (!value) return null;
  return {
    min: toVector(value.min),
    max: toVector(value.max)
  };
}

function mergeBox(left: Bim3dBoundingBox | null, right: Bim3dBoundingBox | null): Bim3dBoundingBox | null {
  if (!left) return right;
  if (!right) return left;
  return {
    min: {
      x: Math.min(left.min.x, right.min.x),
      y: Math.min(left.min.y, right.min.y),
      z: Math.min(left.min.z, right.min.z)
    },
    max: {
      x: Math.max(left.max.x, right.max.x),
      y: Math.max(left.max.y, right.max.y),
      z: Math.max(left.max.z, right.max.z)
    }
  };
}

function boxCenter(box: Bim3dBoundingBox): Bim3dVector3 {
  return {
    x: (box.min.x + box.max.x) / 2,
    y: (box.min.y + box.max.y) / 2,
    z: (box.min.z + box.max.z) / 2
  };
}

function boxSize(box: Bim3dBoundingBox): Bim3dVector3 {
  return {
    x: Math.max(0.2, box.max.x - box.min.x),
    y: Math.max(0.2, box.max.y - box.min.y),
    z: Math.max(0.2, box.max.z - box.min.z)
  };
}

function subtractOrigin(vector: Bim3dVector3, origin: Bim3dVector3): Bim3dVector3 {
  return {
    x: vector.x - origin.x,
    y: vector.y - origin.y,
    z: vector.z - origin.z
  };
}

function recenterBox(box: Bim3dBoundingBox, origin: Bim3dVector3): Bim3dBoundingBox {
  return {
    min: subtractOrigin(box.min, origin),
    max: subtractOrigin(box.max, origin)
  };
}

function codeFromText(value: string | null | undefined, fallback: string) {
  const normalized = (value ?? "").trim().replace(/\s+/g, "-").toUpperCase();
  return normalized.slice(0, 48) || fallback;
}

function spatialTypeFromIfc(ifcClass: string): SpatialNodeType {
  if (ifcClass === "IfcSite") return "SITE";
  if (ifcClass === "IfcBuilding") return "BUILDING";
  if (ifcClass === "IfcBuildingStorey") return "FLOOR";
  if (ifcClass === "IfcSpace") return "ROOM";
  return "LOCATION";
}

function stableIfcId(prefix: string, item: IfcExtractObject) {
  return `${prefix}:${item.globalId ?? item.ifcEntityId ?? item.name ?? "unknown"}`;
}

function fallbackBox(parentBox: Bim3dBoundingBox | null, index: number): Bim3dBoundingBox {
  if (!parentBox) {
    const x = (index % 10) * 2.5;
    const z = Math.floor(index / 10) * 2.5;
    return { min: { x, y: 0, z }, max: { x: x + 1.2, y: 1.2, z: z + 1.2 } };
  }
  const parentSize = boxSize(parentBox);
  const columns = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, index + 1))));
  const column = index % columns;
  const row = Math.floor(index / columns);
  const cellX = parentSize.x / columns;
  const cellZ = parentSize.z / columns;
  const size = Math.max(0.4, Math.min(1.4, Math.min(cellX, cellZ) * 0.28));
  const center = {
    x: parentBox.min.x + cellX * (column + 0.5),
    y: parentBox.min.y + Math.min(1.1, parentSize.y / 2),
    z: parentBox.min.z + cellZ * (row + 0.5)
  };
  return {
    min: { x: center.x - size / 2, y: center.y - size / 2, z: center.z - size / 2 },
    max: { x: center.x + size / 2, y: center.y + size / 2, z: center.z + size / 2 }
  };
}

export function buildIfcOpenShellBim3dScene(input: BuildIfcSceneInput): Bim3dScene {
  const dbNodeByGlobalId = new Map(input.nodes.filter((node) => node.sourceGlobalId).map((node) => [node.sourceGlobalId as string, node]));
  const dbEquipmentByGlobalId = new Map(
    input.equipments.filter((equipment) => equipment.sourceGlobalId).map((equipment) => [equipment.sourceGlobalId as string, equipment])
  );

  const rawBoxes = new Map<string, Bim3dBoundingBox>();
  const spatialByGlobalId = new Map<string, IfcExtractObject>();
  for (const spatial of input.extraction.spatialObjects) {
    if (!spatial.globalId) continue;
    spatialByGlobalId.set(spatial.globalId, spatial);
    const box = toBox(spatial.bbox);
    if (box) rawBoxes.set(spatial.globalId, box);
  }

  for (let pass = 0; pass < 4; pass += 1) {
    for (const spatial of input.extraction.spatialObjects) {
      if (!spatial.globalId || rawBoxes.has(spatial.globalId)) continue;
      let aggregate: Bim3dBoundingBox | null = null;
      for (const child of input.extraction.spatialObjects) {
        if (child.parentGlobalId === spatial.globalId && child.globalId) {
          aggregate = mergeBox(aggregate, rawBoxes.get(child.globalId) ?? null);
        }
      }
      for (const product of input.extraction.products) {
        if (product.storeyGlobalId === spatial.globalId || product.parentGlobalId === spatial.globalId) {
          aggregate = mergeBox(aggregate, toBox(product.bbox));
        }
      }
      if (aggregate) rawBoxes.set(spatial.globalId, aggregate);
    }
  }

  let globalBox = toBox(input.extraction.globalBbox);
  for (const box of rawBoxes.values()) {
    globalBox = mergeBox(globalBox, box);
  }
  const origin = globalBox
    ? { x: boxCenter(globalBox).x, y: globalBox.min.y, z: boxCenter(globalBox).z }
    : { x: 0, y: 0, z: 0 };

  const nodeIdByGlobalId = new Map<string, string>();
  const nodeById = new Map<string, Bim3dSceneNode>();
  const ageSummaries = new Map<string, Bim3dAgeSummary>();

  for (const spatial of input.extraction.spatialObjects) {
    const dbNode = spatial.globalId ? dbNodeByGlobalId.get(spatial.globalId) : null;
    const id = dbNode?.id ?? stableIfcId("ifc-node", spatial);
    if (spatial.globalId) {
      nodeIdByGlobalId.set(spatial.globalId, id);
    }
  }

  for (const spatial of input.extraction.spatialObjects) {
    const dbNode = spatial.globalId ? dbNodeByGlobalId.get(spatial.globalId) : null;
    const id = dbNode?.id ?? stableIfcId("ifc-node", spatial);
    const worldBox = spatial.globalId ? rawBoxes.get(spatial.globalId) ?? null : toBox(spatial.bbox);
    const bbox = worldBox ? recenterBox(worldBox, origin) : fallbackBox(null, nodeById.size);
    const parentId = spatial.parentGlobalId ? nodeIdByGlobalId.get(spatial.parentGlobalId) ?? null : dbNode?.parentId ?? null;
    const type = dbNode?.type ?? spatialTypeFromIfc(spatial.ifcClass);
    const code = dbNode?.code ?? codeFromText(spatial.name, `${type}-${nodeById.size + 1}`);
    const label = dbNode?.label ?? spatial.name ?? spatial.description ?? spatial.ifcClass;
    const path = dbNode?.path ?? [parentId ? nodeById.get(parentId)?.path : null, code].filter(Boolean).join("/");
    const floorGuideId = spatial.ifcClass === "IfcBuildingStorey" ? id : null;
    const node: Bim3dSceneNode = {
      id,
      type,
      code,
      label,
      path,
      parentId,
      sourceGlobalId: spatial.globalId,
      bbox,
      equipmentsCount: 0,
      ageSummary: emptyAgeSummary(),
      geometrySource: worldBox ? "ifcopenshell-bounding-boxes" : "mixed-ifc-fallback",
      ifcEntityId: spatial.ifcEntityId,
      worldBbox: worldBox,
      localBbox: worldBox,
      floorGuideId,
      fallbackReason: worldBox ? null : spatial.geometryError ?? "IFC geometry unavailable"
    };
    nodeById.set(id, node);
    ageSummaries.set(id, node.ageSummary);
  }

  const floorGuideByGlobalId = new Map<string, string>();
  const floorGuides: Bim3dFloorGuide[] = [];
  if (input.includeFloorGuides) {
    for (const storey of input.extraction.storeys) {
      if (!storey.globalId) continue;
      const nodeId = nodeIdByGlobalId.get(storey.globalId) ?? null;
      const worldBox = rawBoxes.get(storey.globalId) ?? toBox(storey.bbox);
      if (!worldBox) continue;
      const bbox = recenterBox(worldBox, origin);
      const id = `floor-guide:${storey.globalId}`;
      floorGuideByGlobalId.set(storey.globalId, id);
      floorGuides.push({
        id,
        label: storey.name ?? storey.description ?? "Etage IFC",
        spatialNodeId: nodeId,
        elevation: bbox.min.y,
        bbox,
        sourceGlobalId: storey.globalId,
        geometrySource: "ifcopenshell-bounding-boxes",
        labelPosition: {
          x: bbox.min.x,
          y: bbox.max.y + 0.9,
          z: bbox.min.z
        },
        derived: false
      });
    }
  }

  const fallbackBySpatialNodeId = new Map<string, number>();
  const sceneEquipments: Bim3dSceneEquipment[] = input.includeEquipments
    ? input.extraction.products.map((product, index) => {
        const dbEquipment = product.globalId ? dbEquipmentByGlobalId.get(product.globalId) : null;
        const spatialGlobalId = product.storeyGlobalId ?? product.parentGlobalId;
        const spatialNodeId = spatialGlobalId ? nodeIdByGlobalId.get(spatialGlobalId) ?? null : null;
        const parentBox = spatialNodeId ? nodeById.get(spatialNodeId)?.bbox ?? null : null;
        const worldBox = toBox(product.bbox);
        const bbox = worldBox ? recenterBox(worldBox, origin) : fallbackBox(parentBox, fallbackBySpatialNodeId.get(spatialNodeId ?? "none") ?? index);
        fallbackBySpatialNodeId.set(spatialNodeId ?? "none", (fallbackBySpatialNodeId.get(spatialNodeId ?? "none") ?? 0) + 1);
        const size = boxSize(bbox);
        const position = boxCenter(bbox);
        const bucket = getInventoryAgeBucket(dbEquipment?.lastInventoryAt ?? null, new Date(input.generatedAt));
        if (spatialNodeId) {
          incrementNodeSummary(spatialNodeId, bucket, nodeById, ageSummaries);
          incrementNodeCount(spatialNodeId, nodeById);
        }
        return {
          id: dbEquipment?.id ?? stableIfcId("ifc-equipment", product),
          internalCode: dbEquipment?.internalCode ?? product.name ?? product.globalId ?? `IFC-${index + 1}`,
          label: dbEquipment?.label ?? product.description ?? product.name ?? product.ifcClass,
          spatialNodeId,
          spatialPath: spatialNodeId ? nodeById.get(spatialNodeId)?.path ?? null : null,
          sourceGlobalId: product.globalId,
          position,
          size,
          lastInventoryAt: dbEquipment?.lastInventoryAt ?? null,
          ageBucket: bucket,
          statusLabel: dbEquipment?.statusLabel ?? "Import IFC",
          familyLabel: dbEquipment?.familyLabel ?? "IFC4",
          typeLabel: dbEquipment?.typeLabel ?? product.ifcClass,
          geometrySource: worldBox ? "ifcopenshell-bounding-boxes" : "mixed-ifc-fallback",
          ifcEntityId: product.ifcEntityId,
          worldBbox: worldBox,
          localBbox: worldBox,
          floorGuideId: spatialGlobalId ? floorGuideByGlobalId.get(spatialGlobalId) ?? null : null,
          fallbackReason: worldBox ? null : product.geometryError ?? "IFC geometry unavailable"
        };
      })
    : [];

  const fallbackCount =
    [...nodeById.values()].filter((node) => node.geometrySource !== "ifcopenshell-bounding-boxes").length +
    sceneEquipments.filter((equipment) => equipment.geometrySource !== "ifcopenshell-bounding-boxes").length;
  const geometrySource = fallbackCount > 0 ? "mixed-ifc-fallback" : "ifcopenshell-bounding-boxes";
  const sceneNodes = [...nodeById.values()].sort((left, right) => left.path.localeCompare(right.path));

  return {
    version: "1.0",
    metadata: {
      mapId: input.mapId,
      organizationId: input.organizationId,
      name: input.name,
      generatedAt: input.generatedAt,
      importJobId: input.importJobId,
      sourceFilename: input.sourceFilename,
      nodesCount: sceneNodes.length,
      equipmentsCount: sceneEquipments.length,
      geometrySource,
      extractionEngine: "ifcopenshell-python",
      globalBbox: globalBox,
      sceneOrigin: origin,
      unitScale: input.extraction.units.scaleToMeters,
      geometryStats: input.extraction.stats,
      fallbackCount
    },
    nodes: sceneNodes,
    equipments: sceneEquipments,
    floorGuides,
    materials: {
      node: NODE_COLORS,
      equipment: "#38bdf8",
      selected: "#f97316",
      heatmap: BIM3D_HEATMAP_COLORS
    },
    limits: {
      desktopMaxNodes: 500,
      desktopMaxEquipments: 5000,
      mobileMaxNodes: 100,
      mobileMaxEquipments: 1000,
      mode: geometrySource
    }
  };
}

function incrementNodeSummary(
  nodeId: string,
  bucket: Bim3dAgeBucket,
  nodeById: Map<string, Bim3dSceneNode>,
  summaries: Map<string, Bim3dAgeSummary>
) {
  let currentId: string | null = nodeId;
  while (currentId) {
    const summary = summaries.get(currentId);
    if (summary) {
      summary[AGE_SUMMARY_KEYS[bucket]] += 1;
    }
    currentId = nodeById.get(currentId)?.parentId ?? null;
  }
}

function incrementNodeCount(nodeId: string, nodeById: Map<string, Bim3dSceneNode>) {
  let currentId: string | null = nodeId;
  while (currentId) {
    const node = nodeById.get(currentId);
    if (!node) return;
    node.equipmentsCount += 1;
    currentId = node.parentId;
  }
}
