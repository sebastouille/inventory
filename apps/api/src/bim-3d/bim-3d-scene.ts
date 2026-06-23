import type {
  Bim3dAgeBucket,
  Bim3dAgeSummary,
  Bim3dBoundingBox,
  Bim3dScene,
  Bim3dSceneEquipment,
  Bim3dSceneNode,
  SpatialNodeType
} from "@inventory/shared";

export interface Bim3dSpatialNodeInput {
  id: string;
  type: SpatialNodeType;
  code: string;
  label: string;
  path: string;
  parentId: string | null;
  sourceGlobalId: string | null;
  isIfcSource: boolean;
  equipmentsCount: number;
  geometrySource?: string | null;
  geometryMetadata?: unknown;
  worldCenter?: { x: number; y: number; z: number } | null;
  worldSize?: { x: number; y: number; z: number } | null;
}

export interface Bim3dEquipmentInput {
  id: string;
  internalCode: string;
  label: string;
  spatialNodeId: string | null;
  spatialPath: string | null;
  sourceGlobalId: string | null;
  lastInventoryAt: string | null;
  statusLabel: string;
  familyLabel: string;
  typeLabel: string;
  geometrySource?: string | null;
  geometryMetadata?: unknown;
  worldCenter?: { x: number; y: number; z: number } | null;
  worldSize?: { x: number; y: number; z: number } | null;
}

export interface BuildBim3dSceneInput {
  mapId: string;
  organizationId: string;
  name: string;
  generatedAt: string;
  importJobId: string | null;
  sourceFilename: string | null;
  nodes: Bim3dSpatialNodeInput[];
  equipments: Bim3dEquipmentInput[];
}

const AGE_SUMMARY_KEYS = {
  FRESH: "fresh",
  RECENT: "recent",
  WARNING: "warning",
  STALE: "stale",
  CRITICAL: "critical",
  UNKNOWN: "unknown"
} as const satisfies Record<Bim3dAgeBucket, keyof Bim3dAgeSummary>;

const NODE_COLORS: Record<SpatialNodeType, string> = {
  SITE: "#0f766e",
  BUILDING: "#0369a1",
  FLOOR: "#0891b2",
  ZONE: "#f59e0b",
  ROOM: "#2563eb",
  LOCATION: "#64748b"
};

export const BIM3D_HEATMAP_COLORS: Record<Bim3dAgeBucket, string> = {
  FRESH: "#16a34a",
  RECENT: "#84cc16",
  WARNING: "#facc15",
  STALE: "#f97316",
  CRITICAL: "#dc2626",
  UNKNOWN: "#94a3b8"
};

export function getInventoryAgeBucket(lastInventoryAt: string | Date | null | undefined, referenceDate = new Date()): Bim3dAgeBucket {
  if (!lastInventoryAt) {
    return "UNKNOWN";
  }

  const date = lastInventoryAt instanceof Date ? lastInventoryAt : new Date(lastInventoryAt);
  if (Number.isNaN(date.getTime())) {
    return "UNKNOWN";
  }

  const ageDays = Math.max(0, Math.floor((referenceDate.getTime() - date.getTime()) / 86_400_000));
  if (ageDays <= 31) {
    return "FRESH";
  }
  if (ageDays <= 92) {
    return "RECENT";
  }
  if (ageDays <= 183) {
    return "WARNING";
  }
  if (ageDays <= 365) {
    return "STALE";
  }
  return "CRITICAL";
}

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

function incrementAgeSummary(summary: Bim3dAgeSummary, bucket: Bim3dAgeBucket) {
  summary[AGE_SUMMARY_KEYS[bucket]] += 1;
}

function getSize(box: Bim3dBoundingBox) {
  return {
    x: Math.max(1, box.max.x - box.min.x),
    y: Math.max(0.2, box.max.y - box.min.y),
    z: Math.max(1, box.max.z - box.min.z)
  };
}

function childHeight(type: SpatialNodeType) {
  if (type === "BUILDING") return 10;
  if (type === "FLOOR") return 0.35;
  if (type === "ZONE") return 0.8;
  if (type === "ROOM" || type === "LOCATION") return 2.2;
  return 2;
}

function layoutNodes(nodes: Bim3dSpatialNodeInput[]) {
  const children = new Map<string | null, Bim3dSpatialNodeInput[]>();
  for (const node of nodes) {
    const key = node.parentId ?? null;
    children.set(key, [...(children.get(key) ?? []), node]);
  }
  for (const list of children.values()) {
    list.sort((left, right) => left.path.localeCompare(right.path));
  }

  const boxes = new Map<string, Bim3dBoundingBox>();
  const roots = children.get(null) ?? [];
  roots.forEach((root, index) => {
    const originX = index * 96;
    const rootBox: Bim3dBoundingBox = {
      min: { x: originX - 40, y: 0, z: -28 },
      max: { x: originX + 40, y: 4, z: 28 }
    };
    boxes.set(root.id, rootBox);
    assignChildren(root, rootBox, 1);
  });

  function assignChildren(parent: Bim3dSpatialNodeInput, parentBox: Bim3dBoundingBox, depth: number) {
    const list = children.get(parent.id) ?? [];
    if (list.length === 0) {
      return;
    }

    const parentSize = getSize(parentBox);
    const floorChildrenOnly = list.every((child) => child.type === "FLOOR");
    if (floorChildrenOnly) {
      list.forEach((child, index) => {
        const y = parentBox.min.y + 1.1 + index * 2.8;
        const box: Bim3dBoundingBox = {
          min: { x: parentBox.min.x + 3, y, z: parentBox.min.z + 3 },
          max: { x: parentBox.max.x - 3, y: y + childHeight(child.type), z: parentBox.max.z - 3 }
        };
        boxes.set(child.id, box);
        assignChildren(child, box, depth + 1);
      });
      return;
    }

    const columns = Math.ceil(Math.sqrt(list.length));
    const rows = Math.ceil(list.length / columns);
    const cellX = parentSize.x / columns;
    const cellZ = parentSize.z / rows;
    list.forEach((child, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const padding = Math.max(0.6, Math.min(cellX, cellZ) * 0.08);
      const minX = parentBox.min.x + column * cellX + padding;
      const maxX = parentBox.min.x + (column + 1) * cellX - padding;
      const minZ = parentBox.min.z + row * cellZ + padding;
      const maxZ = parentBox.min.z + (row + 1) * cellZ - padding;
      const y = parentBox.min.y + Math.min(1.1 + depth * 0.35, 4);
      const box: Bim3dBoundingBox = {
        min: { x: minX, y, z: minZ },
        max: { x: maxX, y: y + childHeight(child.type), z: maxZ }
      };
      boxes.set(child.id, box);
      assignChildren(child, box, depth + 1);
    });
  }

  return boxes;
}

function fallbackEquipmentBox(index: number): Bim3dBoundingBox {
  const columns = 12;
  const column = index % columns;
  const row = Math.floor(index / columns);
  const x = column * 3;
  const z = row * 3;
  return {
    min: { x: x - 1, y: 0, z: z - 1 },
    max: { x: x + 1, y: 2, z: z + 1 }
  };
}

function layoutEquipments(equipments: Bim3dEquipmentInput[], nodeBoxes: Map<string, Bim3dBoundingBox>) {
  const byNode = new Map<string, Bim3dEquipmentInput[]>();
  const withoutNode: Bim3dEquipmentInput[] = [];
  for (const equipment of equipments) {
    if (equipment.spatialNodeId && nodeBoxes.has(equipment.spatialNodeId)) {
      byNode.set(equipment.spatialNodeId, [...(byNode.get(equipment.spatialNodeId) ?? []), equipment]);
    } else {
      withoutNode.push(equipment);
    }
  }

  const positions = new Map<string, { position: { x: number; y: number; z: number }; size: { x: number; y: number; z: number } }>();

  for (const [nodeId, list] of byNode.entries()) {
    const box = nodeBoxes.get(nodeId);
    if (!box) continue;
    const size = getSize(box);
    const columns = Math.ceil(Math.sqrt(list.length));
    const rows = Math.ceil(list.length / columns);
    const cellX = size.x / columns;
    const cellZ = size.z / rows;
    const cubeSize = Math.max(0.45, Math.min(1.4, Math.min(cellX, cellZ) * 0.32));
    list.forEach((equipment, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      positions.set(equipment.id, {
        position: {
          x: box.min.x + cellX * (column + 0.5),
          y: Math.min(box.max.y + 0.65, box.min.y + 1.2),
          z: box.min.z + cellZ * (row + 0.5)
        },
        size: { x: cubeSize, y: cubeSize, z: cubeSize }
      });
    });
  }

  withoutNode.forEach((equipment, index) => {
    const box = fallbackEquipmentBox(index);
    positions.set(equipment.id, {
      position: {
        x: (box.min.x + box.max.x) / 2,
        y: 1,
        z: (box.min.z + box.max.z) / 2
      },
      size: { x: 1, y: 1, z: 1 }
    });
  });

  return positions;
}

function addEquipmentToNodeSummaries(
  equipment: Bim3dEquipmentInput,
  bucket: Bim3dAgeBucket,
  nodeById: Map<string, Bim3dSpatialNodeInput>,
  summaries: Map<string, Bim3dAgeSummary>
) {
  let currentId = equipment.spatialNodeId;
  while (currentId) {
    const summary = summaries.get(currentId);
    if (summary) {
      incrementAgeSummary(summary, bucket);
    }
    currentId = nodeById.get(currentId)?.parentId ?? null;
  }
}

export function buildSimplifiedBim3dScene(input: BuildBim3dSceneInput): Bim3dScene {
  const nodes = [...input.nodes].sort((left, right) => left.path.localeCompare(right.path));
  const equipments = [...input.equipments].sort((left, right) => left.internalCode.localeCompare(right.internalCode));
  const nodeBoxes = layoutNodes(nodes);
  const equipmentPositions = layoutEquipments(equipments, nodeBoxes);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const nodeAgeSummaries = new Map(nodes.map((node) => [node.id, emptyAgeSummary()]));

  const sceneEquipments: Bim3dSceneEquipment[] = equipments.map((equipment) => {
    const bucket = getInventoryAgeBucket(equipment.lastInventoryAt, new Date(input.generatedAt));
    addEquipmentToNodeSummaries(equipment, bucket, nodeById, nodeAgeSummaries);
    const placement = equipmentPositions.get(equipment.id) ?? {
      position: { x: 0, y: 1, z: 0 },
      size: { x: 1, y: 1, z: 1 }
    };
    const {
      geometrySource: _geometrySource,
      geometryMetadata: _geometryMetadata,
      worldCenter: _worldCenter,
      worldSize: _worldSize,
      ...baseEquipment
    } = equipment;
    return {
      ...baseEquipment,
      ageBucket: bucket,
      position: placement.position,
      size: placement.size
    };
  });

  const sceneNodes: Bim3dSceneNode[] = nodes.map((inputNode) => {
    const {
      isIfcSource: _isIfcSource,
      geometrySource: _geometrySource,
      geometryMetadata: _geometryMetadata,
      worldCenter: _worldCenter,
      worldSize: _worldSize,
      ...node
    } = inputNode;
    return {
      ...node,
      bbox: nodeBoxes.get(node.id) ?? fallbackEquipmentBox(0),
      ageSummary: nodeAgeSummaries.get(node.id) ?? emptyAgeSummary()
    };
  });

  const hasIfcSource = nodes.some((node) => node.isIfcSource);
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
      equipmentsCount: sceneEquipments.length
    },
    nodes: sceneNodes,
    equipments: sceneEquipments,
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
      mode: hasIfcSource ? "ifc-simplified" : "spatial-fallback"
    }
  };
}

function boxFromCenterAndSize(
  center: { x: number; y: number; z: number },
  size: { x: number; y: number; z: number }
): Bim3dBoundingBox {
  return {
    min: {
      x: center.x - size.x / 2,
      y: center.y - size.y / 2,
      z: center.z - size.z / 2
    },
    max: {
      x: center.x + size.x / 2,
      y: center.y + size.y / 2,
      z: center.z + size.z / 2
    }
  };
}

function hasPersistedGeometry(item: { geometrySource?: string | null; worldCenter?: unknown; worldSize?: unknown }) {
  return Boolean(item.geometrySource && item.worldCenter && item.worldSize);
}

export function buildPersistedGeometryBim3dScene(input: BuildBim3dSceneInput): Bim3dScene {
  const nodes = [...input.nodes].sort((left, right) => left.path.localeCompare(right.path));
  const equipments = [...input.equipments].sort((left, right) => left.internalCode.localeCompare(right.internalCode));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const nodeAgeSummaries = new Map(nodes.map((node) => [node.id, emptyAgeSummary()]));

  const sceneEquipments: Bim3dSceneEquipment[] = equipments.filter(hasPersistedGeometry).map((equipment) => {
    const bucket = getInventoryAgeBucket(equipment.lastInventoryAt, new Date(input.generatedAt));
    addEquipmentToNodeSummaries(equipment, bucket, nodeById, nodeAgeSummaries);
    return {
      ...equipment,
      ageBucket: bucket,
      position: equipment.worldCenter!,
      size: equipment.worldSize!,
      geometrySource: "ifc-persisted-geometry",
      geometryMetadata: equipment.geometryMetadata && typeof equipment.geometryMetadata === "object"
        ? (equipment.geometryMetadata as Record<string, unknown>)
        : null
    };
  });

  const sceneNodes: Bim3dSceneNode[] = nodes.filter(hasPersistedGeometry).map(({ isIfcSource: _isIfcSource, ...node }) => ({
    ...node,
    bbox: boxFromCenterAndSize(node.worldCenter!, node.worldSize!),
    ageSummary: nodeAgeSummaries.get(node.id) ?? emptyAgeSummary(),
    geometrySource: "ifc-persisted-geometry",
    geometryMetadata: node.geometryMetadata && typeof node.geometryMetadata === "object"
      ? (node.geometryMetadata as Record<string, unknown>)
      : null
  }));

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
      geometrySource: "ifc-persisted-geometry",
      extractionEngine: "spatial-layout",
      fallbackCount: 0
    },
    nodes: sceneNodes,
    equipments: sceneEquipments,
    floorGuides: sceneNodes
      .filter((node) => node.type === "FLOOR")
      .map((node) => ({
        id: `floor-guide:${node.id}`,
        label: node.label,
        spatialNodeId: node.id,
        elevation: node.bbox.min.y,
        bbox: node.bbox,
        sourceGlobalId: node.sourceGlobalId
      })),
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
      mode: "ifc-persisted-geometry"
    }
  };
}
