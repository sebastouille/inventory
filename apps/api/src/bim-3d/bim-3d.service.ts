import { BadRequestException, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  Bim3dMapBuildSummary,
  Bim3dMapSummary,
  Bim3dScene
} from "@inventory/shared";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma.service";
import { Bim3dRepository } from "./bim-3d.repository";
import { buildIfcOpenShellBim3dScene } from "./bim-3d-ifc-scene";
import { buildPersistedGeometryBim3dScene } from "./bim-3d-scene";
import type { BuildBim3dMapDto } from "./dto/build-bim-3d-map.dto";
import { persistBim3dScene, persistBim3dSourceFile, readBim3dScene, resolveBim3dRuntimePath } from "./bim-3d-storage";
import { IfcGeometryWorker } from "./ifc-geometry-worker";

type Bim3dMapRecord = Awaited<ReturnType<Bim3dRepository["listMaps"]>>[number];
type Bim3dBuildRecord = Awaited<ReturnType<Bim3dRepository["listBuilds"]>>[number];
type SpatialNodeRecord = Awaited<ReturnType<Bim3dRepository["listSpatialNodes"]>>[number];
type EquipmentRecord = Awaited<ReturnType<Bim3dRepository["listEquipments"]>>[number];

interface UploadedIfcFile {
  originalname: string;
  buffer: Buffer;
  size: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function summaryNumber(summary: Prisma.JsonValue | null, key: "nodesCount" | "equipmentsCount") {
  if (isRecord(summary) && typeof summary[key] === "number") {
    return summary[key];
  }
  return 0;
}

function extractSourceGlobalId(value: Prisma.JsonValue | null, fallback: string | null) {
  if (isRecord(value)) {
    const direct = value.GlobalId ?? value.globalId ?? value.sourceGlobalId;
    if (typeof direct === "string" && direct.trim()) {
      return direct.trim();
    }
  }
  return fallback;
}

function vectorFromGeometry(record: {
  worldCenterX?: number | null;
  worldCenterY?: number | null;
  worldCenterZ?: number | null;
  worldSizeX?: number | null;
  worldSizeY?: number | null;
  worldSizeZ?: number | null;
}) {
  if (
    record.worldCenterX == null ||
    record.worldCenterY == null ||
    record.worldCenterZ == null ||
    record.worldSizeX == null ||
    record.worldSizeY == null ||
    record.worldSizeZ == null
  ) {
    return {
      center: null,
      size: null
    };
  }
  return {
    center: { x: record.worldCenterX, y: record.worldCenterY, z: record.worldCenterZ },
    size: { x: record.worldSizeX, y: record.worldSizeY, z: record.worldSizeZ }
  };
}

function mapSummary(map: Bim3dMapRecord): Bim3dMapSummary {
  return {
    id: map.id,
    name: map.name,
    status: map.status,
    mode: map.mode,
    importJobId: map.importJobId ?? null,
    sourceFilename: isRecord(map.summary) && typeof map.summary.sourceFilename === "string" ? map.summary.sourceFilename : null,
    sceneFileRef: map.sceneFileRef ?? null,
    nodesCount: summaryNumber(map.summary, "nodesCount"),
    equipmentsCount: summaryNumber(map.summary, "equipmentsCount"),
    errorMessage: map.errorMessage ?? null,
    createdAt: map.createdAt.toISOString(),
    updatedAt: map.updatedAt.toISOString(),
    archivedAt: map.archivedAt?.toISOString() ?? null
  };
}

function mapBuild(build: Bim3dBuildRecord): Bim3dMapBuildSummary {
  return {
    id: build.id,
    mapId: build.mapId,
    status: build.status,
    mode: build.mode,
    sceneFileRef: build.sceneFileRef ?? null,
    startedAt: build.startedAt.toISOString(),
    completedAt: build.completedAt?.toISOString() ?? null,
    durationMs: build.durationMs ?? null,
    errorMessage: build.errorMessage ?? null,
    nodesCount: summaryNumber(build.summary, "nodesCount"),
    equipmentsCount: summaryNumber(build.summary, "equipmentsCount")
  };
}

@Injectable()
export class Bim3dService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: Bim3dRepository,
    private readonly auditService: AuditService,
    private readonly ifcGeometryWorker: IfcGeometryWorker
  ) {}

  async listMaps(organizationId: string) {
    const maps = await this.repository.listMaps(organizationId);
    return maps.map(mapSummary);
  }

  async getMap(organizationId: string, mapId: string) {
    const map = await this.repository.findMap(organizationId, mapId);
    if (!map) {
      throw new NotFoundException("BIM 3D map not found");
    }
    return mapSummary(map);
  }

  async getScene(organizationId: string, mapId: string): Promise<Bim3dScene> {
    const map = await this.repository.findMap(organizationId, mapId);
    if (!map) {
      throw new NotFoundException("BIM 3D map not found");
    }
    if (!map.sceneFileRef || map.status !== "READY") {
      throw new BadRequestException("BIM 3D scene is not ready");
    }
    return readBim3dScene(map.sceneFileRef);
  }

  async history(organizationId: string, mapId: string) {
    const map = await this.repository.findMap(organizationId, mapId);
    if (!map) {
      throw new NotFoundException("BIM 3D map not found");
    }
    const builds = await this.repository.listBuilds(organizationId, mapId);
    return builds.map(mapBuild);
  }

  private mapSpatialNode(node: SpatialNodeRecord) {
    const geometry = vectorFromGeometry(node);
    return {
      id: node.id,
      type: node.type,
      code: node.code,
      label: node.label,
      path: node.path,
      parentId: node.parentId ?? null,
      sourceGlobalId: extractSourceGlobalId(node.sourceMetadata, node.externalRef ?? null),
      isIfcSource: node.externalSource === "IFC4" || Boolean(node.sourceClass?.toLowerCase().startsWith("ifc")),
      equipmentsCount: node._count.currentEquipments,
      geometrySource: node.geometrySource,
      geometryMetadata: node.geometryMetadata,
      worldCenter: geometry.center,
      worldSize: geometry.size
    };
  }

  private mapEquipment(equipment: EquipmentRecord) {
    const geometry = vectorFromGeometry(equipment);
    const familyLabel = equipment.equipmentType.subfamily.family.label;
    const typeLabel = equipment.equipmentType.label;
    return {
      id: equipment.id,
      internalCode: equipment.internalCode,
      label: `${equipment.internalCode} - ${typeLabel}`,
      spatialNodeId: equipment.currentSpatialNodeId ?? null,
      spatialPath: equipment.currentSpatialNode?.path ?? null,
      sourceGlobalId: equipment.externalRef ?? null,
      lastInventoryAt: equipment.lastInventoryAt?.toISOString() ?? null,
      statusLabel: equipment.equipmentStatus.label,
      familyLabel,
      typeLabel,
      geometrySource: equipment.geometrySource,
      geometryMetadata: equipment.geometryMetadata,
      worldCenter: geometry.center,
      worldSize: geometry.size
    };
  }

  async buildMap(auth: AuthenticatedUser, dto: BuildBim3dMapDto) {
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException("BIM 3D map name is required");
    }

    const importJob = dto.importJobId
      ? await this.repository.findImportJob(auth.organizationId, dto.importJobId)
      : null;
    if (dto.importJobId && !importJob) {
      throw new NotFoundException("Import job not found");
    }

    const includeEquipments = dto.includeEquipments ?? true;
    const startedAt = Date.now();
    const map = await this.repository.createMap({
      organizationId: auth.organizationId,
      importJobId: dto.importJobId ?? null,
      name,
      mode: dto.mode ?? "simplified",
      status: "BUILDING",
      createdById: auth.sub
    });
    const build = await this.repository.createBuild({
      organizationId: auth.organizationId,
      mapId: map.id,
      importJobId: dto.importJobId ?? null,
      mode: dto.mode ?? "simplified",
      status: "BUILDING",
      createdById: auth.sub
    });

    try {
      const [nodes, equipments] = await Promise.all([
        this.repository.listSpatialNodes(auth.organizationId, dto.maxNodeDepth),
        includeEquipments ? this.repository.listEquipments(auth.organizationId) : Promise.resolve([])
      ]);
      const mappedNodes = nodes.map((node) => this.mapSpatialNode(node));
      const mappedEquipments = equipments.map((equipment) => this.mapEquipment(equipment));
      this.assertPersistedGeometryReady(mappedNodes, mappedEquipments);
      const generatedAt = new Date().toISOString();
      const scene = buildPersistedGeometryBim3dScene({
        mapId: map.id,
        organizationId: auth.organizationId,
        name,
        generatedAt,
        importJobId: dto.importJobId ?? null,
        sourceFilename: importJob?.originalFilename ?? null,
        nodes: mappedNodes,
        equipments: mappedEquipments
      });
      const persisted = await persistBim3dScene(auth.organizationId, map.id, scene);
      const summary = {
        nodesCount: scene.metadata.nodesCount,
        equipmentsCount: scene.metadata.equipmentsCount,
        mode: scene.limits.mode,
        sourceFilename: importJob?.originalFilename ?? null,
        generatedAt
      } satisfies Prisma.InputJsonObject;
      const durationMs = Date.now() - startedAt;
      const updated = await this.prisma.$transaction(async (tx) => {
        const readyMap = await this.repository.updateMap(tx, map.id, {
          status: "READY",
          sceneFileRef: persisted.relativePath,
          summary,
          errorMessage: null
        });
        await this.repository.updateBuild(tx, build.id, {
          status: "READY",
          sceneFileRef: persisted.relativePath,
          completedAt: new Date(),
          durationMs,
          summary,
          errorMessage: null
        });
        await this.auditService.log({
          db: tx,
          organizationId: auth.organizationId,
          userId: auth.sub,
          action: "bim3d.map.built",
          entityType: "bim_3d_map",
          entityId: map.id,
          metadata: summary
        });
        return readyMap;
      });
      return mapSummary(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : "BIM 3D map build failed";
      await this.prisma.$transaction(async (tx) => {
        await this.repository.updateMap(tx, map.id, {
          status: "FAILED",
          errorMessage: message
        });
        await this.repository.updateBuild(tx, build.id, {
          status: "FAILED",
          completedAt: new Date(),
          durationMs: Date.now() - startedAt,
          errorMessage: message
        });
        await this.auditService.log({
          db: tx,
          organizationId: auth.organizationId,
          userId: auth.sub,
          action: "bim3d.map.build_failed",
          entityType: "bim_3d_map",
          entityId: map.id,
          metadata: {
            message
          }
        });
      });
      throw error;
    }
  }

  private assertPersistedGeometryReady(
    nodes: Array<{ id: string; path: string; geometrySource?: string | null; worldCenter?: unknown; worldSize?: unknown }>,
    equipments: Array<{ id: string; internalCode: string; geometrySource?: string | null; worldCenter?: unknown; worldSize?: unknown }>
  ) {
    const missingNodes = nodes.filter((node) => !node.geometrySource || !node.worldCenter || !node.worldSize);
    const missingEquipments = equipments.filter((equipment) => !equipment.geometrySource || !equipment.worldCenter || !equipment.worldSize);
    if (nodes.length + equipments.length > 0 && missingNodes.length === nodes.length && missingEquipments.length === equipments.length) {
      throw new UnprocessableEntityException({
        code: "BIM3D_GEOMETRY_MISSING",
        message: "Aucune geometrie IFC persistante n est disponible pour generer la carte 3D",
        hint: "Relancer l import IFC4 avec extraction geometrique"
      });
    }
    if (missingNodes.length > 0 || missingEquipments.length > 0) {
      throw new UnprocessableEntityException({
        code: "BIM3D_PARTIAL_GEOMETRY",
        message: "Des objets importes n ont pas de geometrie IFC persistante",
        missingNodes: missingNodes.length,
        missingEquipments: missingEquipments.length,
        examples: [
          ...missingNodes.slice(0, 10).map((node) => ({ type: "spatial_node", id: node.id, label: node.path })),
          ...missingEquipments.slice(0, 10).map((equipment) => ({ type: "equipment", id: equipment.id, label: equipment.internalCode }))
        ]
      });
    }
  }

  private parseMultipartBoolean(value: string | undefined, fallback: boolean) {
    if (value === undefined || value === null || value === "") {
      return fallback;
    }
    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
  }

  private async loadSceneInputs(auth: AuthenticatedUser, maxNodeDepth?: number | null, includeEquipments = true) {
    const [nodes, equipments] = await Promise.all([
      this.repository.listSpatialNodes(auth.organizationId, maxNodeDepth),
      includeEquipments ? this.repository.listEquipments(auth.organizationId) : Promise.resolve([])
    ]);
    return {
      nodes: nodes.map((node) => this.mapSpatialNode(node)),
      equipments: equipments.map((equipment) => this.mapEquipment(equipment))
    };
  }

  async buildIfcMap(auth: AuthenticatedUser, file: UploadedIfcFile | undefined, body: Record<string, string | undefined>) {
    if (!file) {
      throw new BadRequestException("IFC file is required");
    }
    if (!file.originalname.toLowerCase().endsWith(".ifc")) {
      throw new BadRequestException("Only .ifc files are supported");
    }
    if (file.size > 150 * 1024 * 1024) {
      throw new BadRequestException("IFC file is too large");
    }

    const name = (body.name ?? `Carte IFC ${new Date().toLocaleDateString("fr-FR")}`).trim();
    if (!name) {
      throw new BadRequestException("BIM 3D map name is required");
    }
    const includeEquipments = this.parseMultipartBoolean(body.includeEquipments, true);
    const includeFloorGuides = this.parseMultipartBoolean(body.includeFloorGuides, true);
    const startedAt = Date.now();

    const map = await this.repository.createMap({
      organizationId: auth.organizationId,
      importJobId: null,
      name,
      mode: "ifcopenshell",
      status: "BUILDING",
      createdById: auth.sub
    });
    const build = await this.repository.createBuild({
      organizationId: auth.organizationId,
      mapId: map.id,
      importJobId: null,
      mode: "ifcopenshell",
      status: "BUILDING",
      createdById: auth.sub
    });

    const generatedAt = new Date().toISOString();
    const sourceFile = await persistBim3dSourceFile(auth.organizationId, map.id, file.originalname, file.buffer);

    try {
      const { nodes, equipments } = await this.loadSceneInputs(auth, null, includeEquipments);
      let extractionSummary: Prisma.InputJsonObject = {};
      let extraction;
      try {
        extraction = await this.ifcGeometryWorker.extract({
          sourcePath: sourceFile.absolutePath,
          outputPath: resolveBim3dRuntimePath(sourceFile.relativePath.replace(/source\.ifc$/i, "ifcopenshell-extract.v1.json")),
          timeoutMs: 120000
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "IfcOpenShell extraction failed";
        const lowerMessage = message.toLowerCase();
        throw new UnprocessableEntityException({
          code: lowerMessage.includes("no module named") || lowerMessage.includes("modulenotfounderror")
            ? "IFC_GEOMETRY_ENGINE_UNAVAILABLE"
            : "IFC_GEOMETRY_EXTRACTION_FAILED",
          message: "La geometrie IFC n a pas pu etre extraite",
          detail: message
        });
      }
      const scene = buildIfcOpenShellBim3dScene({
        mapId: map.id,
        organizationId: auth.organizationId,
        name,
        generatedAt,
        importJobId: null,
        sourceFilename: file.originalname,
        extraction,
        nodes,
        equipments,
        includeEquipments,
        includeFloorGuides
      });
      if (scene.metadata.geometrySource !== "ifcopenshell-bounding-boxes") {
        throw new UnprocessableEntityException({
          code: "BIM3D_PARTIAL_GEOMETRY",
          message: "Le fichier IFC contient des objets sans geometrie exploitable",
          fallbackCount: scene.metadata.fallbackCount ?? 0
        });
      }
      extractionSummary = {
        extractionEngine: "ifcopenshell-python",
        extractionWarnings: extraction.warnings,
        extractionStats: extraction.stats
      };

      const persisted = await persistBim3dScene(auth.organizationId, map.id, scene);
      const summary = {
        nodesCount: scene.metadata.nodesCount,
        equipmentsCount: scene.metadata.equipmentsCount,
        mode: scene.limits.mode,
        sourceFilename: file.originalname,
        sourceFileRef: sourceFile.relativePath,
        generatedAt,
        geometrySource: scene.metadata.geometrySource ?? scene.limits.mode,
        fallbackCount: scene.metadata.fallbackCount ?? 0,
        ...extractionSummary
      } satisfies Prisma.InputJsonObject;
      const durationMs = Date.now() - startedAt;
      const updated = await this.prisma.$transaction(async (tx) => {
        const readyMap = await this.repository.updateMap(tx, map.id, {
          status: "READY",
          sceneFileRef: persisted.relativePath,
          summary,
          errorMessage: null
        });
        await this.repository.updateBuild(tx, build.id, {
          status: "READY",
          sceneFileRef: persisted.relativePath,
          completedAt: new Date(),
          durationMs,
          summary,
          errorMessage: null
        });
        await this.auditService.log({
          db: tx,
          organizationId: auth.organizationId,
          userId: auth.sub,
          action: "bim3d.map.built_ifc",
          entityType: "bim_3d_map",
          entityId: map.id,
          metadata: summary
        });
        return readyMap;
      });
      return mapSummary(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : "BIM 3D IFC map build failed";
      await this.prisma.$transaction(async (tx) => {
        await this.repository.updateMap(tx, map.id, {
          status: "FAILED",
          errorMessage: message
        });
        await this.repository.updateBuild(tx, build.id, {
          status: "FAILED",
          completedAt: new Date(),
          durationMs: Date.now() - startedAt,
          errorMessage: message
        });
        await this.auditService.log({
          db: tx,
          organizationId: auth.organizationId,
          userId: auth.sub,
          action: "bim3d.map.build_failed",
          entityType: "bim_3d_map",
          entityId: map.id,
          metadata: {
            message,
            sourceFilename: file.originalname
          }
        });
      });
      throw error;
    }
  }

  async archive(auth: AuthenticatedUser, mapId: string) {
    const map = await this.repository.findMap(auth.organizationId, mapId);
    if (!map) {
      throw new NotFoundException("BIM 3D map not found");
    }
    const archived = await this.prisma.$transaction(async (tx) => {
      const updated = await this.repository.updateMap(tx, mapId, {
        status: "ARCHIVED",
        archivedAt: new Date()
      });
      await this.auditService.log({
        db: tx,
        organizationId: auth.organizationId,
        userId: auth.sub,
        action: "bim3d.map.archived",
        entityType: "bim_3d_map",
        entityId: mapId,
        metadata: {
          name: map.name
        }
      });
      return updated;
    });
    return mapSummary(archived);
  }
}
