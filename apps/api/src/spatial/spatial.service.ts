import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { IamAccessScopeType, Prisma, SpatialNodeType, SpatialSourceKind } from "@prisma/client";
import type {
  ImportJobPurgeCreatedDataResult,
  OrganizationSpatialDisplaySettings,
  ImportJobReport,
  ImportMappingInput,
  ImportReportMode,
  ImportRowReport,
  ImportRowStatus,
  ImportSourceSnapshot,
  ImportTargetDomain,
  SpatialNodeDetail,
  SpatialNodeListItem,
  SpatialNodeTreeItem,
  SpatialNodeType as SharedSpatialNodeType
} from "@inventory/shared";
import { buildDefaultOrganizationSettings } from "@inventory/shared";
import type { AuthenticatedUser } from "../auth/auth.types";
import { AuditService } from "../audit/audit.service";
import { normalizeImportRows } from "../imports/imports-engine";
import { readRawRows } from "../imports/imports-storage";
import { matchesSearchTerm, normalizeSearchTerm, paginateItems, sortItems } from "../common/listing";
import { PrismaService } from "../prisma.service";
import { resolveSpatialScopePolicy } from "../organizations/organization-settings";
import { CreateSpatialNodeDto } from "./dto/create-spatial-node.dto";
import { ListSpatialNodesDto } from "./dto/list-spatial-nodes.dto";
import { UpdateSpatialNodeDto } from "./dto/update-spatial-node.dto";

type DbClient = PrismaService | Prisma.TransactionClient;

type SpatialNodeRecord = Prisma.SpatialNodeGetPayload<{
  include: {
    parent: true;
    children: true;
    currentEquipments: {
      select: {
        id: true;
      };
    };
  };
}>;

type SpatialNodeBasic = Prisma.SpatialNodeGetPayload<{
  include: {
    parent: true;
  };
}>;

type PreparedSpatialRow = {
  rowIndex: number;
  normalizedValues: Record<string, string | number | boolean | null>;
  messages: string[];
  resolvedTargetKey: string | null;
  type: SharedSpatialNodeType | null;
  code: string | null;
  label: string | null;
  description: string | null;
  path: string | null;
  parentPath: string | null;
  externalRef: string | null;
  sourceClass: string | null;
  sourceMetadata: Prisma.InputJsonValue | null;
  geometrySource: string | null;
  geometryMetadata: Prisma.InputJsonValue | null;
  worldCenterX: number | null;
  worldCenterY: number | null;
  worldCenterZ: number | null;
  worldSizeX: number | null;
  worldSizeY: number | null;
  worldSizeZ: number | null;
  isActive: boolean;
  depth: number | null;
};

type ExecutionCandidate = PreparedSpatialRow & {
  parentId: string | null;
  operation: "CREATE" | "UPDATE" | "NO_OP" | "REJECT";
  existingId: string | null;
};

type SpatialPathResolution = {
  type: SharedSpatialNodeType;
  code: string;
  label: string;
  path: string;
  parentPath: string | null;
  depth: number;
};

const JSON_NULL = Prisma.JsonNull;

const ALLOWED_PARENT_TYPES: Record<SharedSpatialNodeType, SharedSpatialNodeType[]> = {
  SITE: [],
  BUILDING: ["SITE"],
  FLOOR: ["BUILDING"],
  ZONE: ["BUILDING", "FLOOR"],
  ROOM: ["BUILDING", "FLOOR", "ZONE"],
  LOCATION: []
};

function normalizeAscii(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
}

function normalizePath(value: string) {
  return value
    .split("/")
    .map((segment) => normalizeAscii(segment))
    .filter((segment) => segment.length > 0)
    .join("/");
}

function normalizeLabel(value: string | null) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalString(value: string | number | boolean | null | undefined) {
  if (value == null) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function deriveParentPath(path: string) {
  const chunks = path.split("/");
  if (chunks.length <= 1) {
    return null;
  }
  return chunks.slice(0, -1).join("/");
}

function pathDepth(path: string) {
  return Math.max(0, path.split("/").filter(Boolean).length - 1);
}

function toJsonInput(value: Prisma.InputJsonValue | Record<string, unknown> | null | undefined) {
  if (value == null) {
    return JSON_NULL;
  }
  return value as Prisma.InputJsonValue;
}

function parseOptionalNumber(value: string | number | boolean | null | undefined) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function jsonCompareValue(value: unknown) {
  if (value == null || value === Prisma.JsonNull) {
    return "null";
  }
  return JSON.stringify(value);
}

function nullableNumberCompare(left: number | null, right: number | null) {
  return left === right || (left == null && right == null);
}

@Injectable()
export class SpatialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  private mapListItem(node: SpatialNodeRecord): SpatialNodeListItem {
    return {
      id: node.id,
      organizationId: node.organizationId,
      type: node.type,
      code: node.code,
      label: node.label,
      description: node.description ?? null,
      path: node.path,
      depth: node.depth,
      sortOrder: node.sortOrder,
      parentId: node.parentId ?? null,
      parentPath: node.parent?.path ?? null,
      parentLabel: node.parent?.label ?? null,
      legacyLocationId: node.legacyLocationId ?? null,
      externalSource: node.externalSource ?? null,
      externalRef: node.externalRef ?? null,
      sourceClass: node.sourceClass ?? null,
      sourceMetadata:
        node.sourceMetadata && typeof node.sourceMetadata === "object"
          ? (node.sourceMetadata as Record<string, unknown>)
          : null,
      importProfileId: node.importProfileId ?? null,
      lastImportJobId: node.lastImportJobId ?? null,
      isActive: node.isActive,
      createdAt: node.createdAt.toISOString(),
      updatedAt: node.updatedAt.toISOString(),
      childrenCount: node.children.length,
      equipmentCount: node.currentEquipments.length
    };
  }

  private buildTree(nodes: SpatialNodeRecord[], parentId: string | null = null): SpatialNodeTreeItem[] {
    return nodes
      .filter((node) => (node.parentId ?? null) === parentId)
      .sort((left, right) => left.path.localeCompare(right.path))
      .map((node) => ({
        id: node.id,
        type: node.type,
        code: node.code,
        label: node.label,
        path: node.path,
        depth: node.depth,
        isActive: node.isActive,
        externalSource: node.externalSource ?? null,
        externalRef: node.externalRef ?? null,
        sourceClass: node.sourceClass ?? null,
        sourceMetadata:
          node.sourceMetadata && typeof node.sourceMetadata === "object"
            ? (node.sourceMetadata as Record<string, unknown>)
            : null,
        children: this.buildTree(nodes, node.id)
      }));
  }

  private parseSourceMetadata(value: string | number | boolean | null) {
    const normalized = normalizeOptionalString(value);
    if (!normalized) {
      return null;
    }
    try {
      return JSON.parse(normalized) as Prisma.InputJsonValue;
    } catch {
      return {
        rawValue: normalized
      } as Prisma.InputJsonValue;
    }
  }

  private validateParentChild(parentType: SharedSpatialNodeType | null, childType: SharedSpatialNodeType | null) {
    if (!childType) {
      return false;
    }
    if (childType === "SITE") {
      return parentType == null;
    }
    if (!parentType) {
      return false;
    }
    return ALLOWED_PARENT_TYPES[childType].includes(parentType);
  }

  private normalizeCode(code: string) {
    const normalized = normalizeAscii(code);
    if (!normalized) {
      throw new BadRequestException("Code spatial invalide");
    }
    return normalized;
  }

  private normalizeLabelInput(label: string) {
    const normalized = normalizeLabel(label);
    if (!normalized) {
      throw new BadRequestException("Libelle spatial invalide");
    }
    return normalized;
  }

  private async getNodeOrThrow(organizationId: string, nodeId: string) {
    const node = await this.prisma.spatialNode.findFirst({
      where: {
        id: nodeId,
        organizationId
      },
      include: {
        parent: true,
        children: true,
        currentEquipments: {
          select: {
            id: true
          }
        }
      }
    });
    if (!node) {
      throw new NotFoundException("Noeud spatial introuvable");
    }
    return node;
  }

  private async getNodeWithDescendants(organizationId: string, nodeId: string) {
    const node = await this.getNodeOrThrow(organizationId, nodeId);
    const descendants = await this.prisma.spatialNode.findMany({
      where: {
        organizationId,
        path: {
          startsWith: `${node.path}/`
        }
      },
      orderBy: {
        depth: "asc"
      }
    });
    return {
      node,
      descendants
    };
  }

  private async resolveParentForMutation(
    organizationId: string,
    type: SharedSpatialNodeType,
    parentId: string | null | undefined,
    currentNodePath?: string
  ) {
    if (type === "SITE") {
      if (parentId) {
        throw new BadRequestException("Un noeud SITE ne peut pas avoir de parent");
      }
      return null;
    }

    if (!parentId) {
      throw new BadRequestException("Parent spatial obligatoire pour ce type");
    }

    const parent = await this.prisma.spatialNode.findFirst({
      where: {
        id: parentId,
        organizationId
      }
    });
    if (!parent) {
      throw new BadRequestException("Parent spatial inconnu");
    }

    if (currentNodePath && (parent.path === currentNodePath || parent.path.startsWith(`${currentNodePath}/`))) {
      throw new BadRequestException("Un noeud ne peut pas etre rattache a lui-meme ou a un descendant");
    }

    if (!this.validateParentChild(parent.type as SharedSpatialNodeType, type)) {
      throw new BadRequestException("Parent spatial incompatible avec le type de noeud");
    }

    return parent;
  }

  private buildNodePath(type: SharedSpatialNodeType, code: string, parentPath: string | null) {
    if (type === "SITE") {
      return code;
    }
    if (!parentPath) {
      throw new BadRequestException("Chemin parent manquant");
    }
    return `${parentPath}/${code}`;
  }

  private resolvePathForPersistence(input: {
    type: SharedSpatialNodeType;
    code: string;
    label: string;
    path?: string | null;
    parentPath?: string | null;
  }): SpatialPathResolution {
    const type = input.type;
    const code = this.normalizeCode(input.code);
    const label = this.normalizeLabelInput(input.label);
    const normalizedPath = normalizeOptionalString(input.path) ? normalizePath(String(input.path)) : null;
    const normalizedParentPath = normalizeOptionalString(input.parentPath)
      ? normalizePath(String(input.parentPath))
      : null;
    const resolvedParentPath =
      type === "SITE" ? null : normalizedParentPath ?? (normalizedPath ? deriveParentPath(normalizedPath) : null);
    const path = normalizedPath ?? this.buildNodePath(type, code, resolvedParentPath);

    if (type === "SITE" && resolvedParentPath) {
      throw new BadRequestException("Un noeud SITE ne peut pas avoir de parent");
    }

    return {
      type,
      code,
      label,
      path,
      parentPath: resolvedParentPath,
      depth: pathDepth(path)
    };
  }

  private validateImportHierarchy(parentType: SharedSpatialNodeType | null, childType: SharedSpatialNodeType) {
    if (!this.validateParentChild(parentType, childType)) {
      throw new BadRequestException("Parent spatial incompatible avec le type de noeud");
    }
  }

  private async ensureNoPathConflicts(
    db: DbClient,
    organizationId: string,
    targetPaths: string[],
    excludedIds: string[] = []
  ) {
    const conflicts = await db.spatialNode.findMany({
      where: {
        organizationId,
        path: {
          in: targetPaths
        },
        ...(excludedIds.length > 0 ? { id: { notIn: excludedIds } } : {})
      },
      select: {
        id: true,
        path: true
      }
    });

    if (conflicts.length > 0) {
      throw new ConflictException(`Conflit de chemin spatial: ${conflicts[0]?.path ?? "inconnu"}`);
    }
  }

  private async syncScopesForSpatialNodes(db: DbClient, organizationId: string, spatialNodeIds: string[]) {
    if (spatialNodeIds.length === 0) {
      return;
    }

    const nodes = await db.spatialNode.findMany({
      where: {
        organizationId,
        id: { in: spatialNodeIds }
      },
      orderBy: [{ depth: "asc" }, { path: "asc" }]
    });
    if (nodes.length === 0) {
      return;
    }

    const scopes = await db.iamAccessScope.findMany({
      where: {
        organizationId
      }
    });
    const scopeBySpatialNodeId = new Map(scopes.filter((scope) => scope.spatialNodeId).map((scope) => [scope.spatialNodeId as string, scope]));
    const scopeByLegacyKey = new Map(scopes.map((scope) => [`${scope.type}::${scope.code}`, scope]));

    for (const node of nodes) {
      const parentScopeId = node.parentId ? scopeBySpatialNodeId.get(node.parentId)?.id ?? null : null;
      const existing =
        scopeBySpatialNodeId.get(node.id) ??
        scopeByLegacyKey.get(`${node.type}::${node.code}`) ??
        null;

      if (existing) {
        const updated = await db.iamAccessScope.update({
          where: {
            id: existing.id
          },
          data: {
            type: node.type as IamAccessScopeType,
            code: node.code,
            label: node.label,
            parentScopeId,
            spatialNodeId: node.id,
            externalRef: node.externalRef,
            isActive: node.isActive
          }
        });
        scopeBySpatialNodeId.set(node.id, updated);
        scopeByLegacyKey.set(`${updated.type}::${updated.code}`, updated);
      } else {
        const created = await db.iamAccessScope.create({
          data: {
            organizationId,
            type: node.type as IamAccessScopeType,
            code: node.code,
            label: node.label,
            parentScopeId,
            spatialNodeId: node.id,
            externalRef: node.externalRef,
            isActive: node.isActive
          }
        });
        scopeBySpatialNodeId.set(node.id, created);
        scopeByLegacyKey.set(`${created.type}::${created.code}`, created);
      }
    }
  }

  private async syncScopesForSubtree(db: DbClient, organizationId: string, rootNodePath: string) {
    const nodes = await db.spatialNode.findMany({
      where: {
        organizationId,
        OR: [
          { path: rootNodePath },
          { path: { startsWith: `${rootNodePath}/` } }
        ]
      },
      orderBy: [{ depth: "asc" }, { path: "asc" }],
      select: {
        id: true
      }
    });
    await this.syncScopesForSpatialNodes(
      db,
      organizationId,
      nodes.map((node) => node.id)
    );
  }

  async list(organizationId: string, query: ListSpatialNodesDto) {
    const nodes = await this.prisma.spatialNode.findMany({
      where: {
        organizationId
      },
      include: {
        parent: true,
        children: true,
        currentEquipments: {
          select: {
            id: true
          }
        }
      }
    });

    const ancestorPath = query.ancestorId
      ? (
          await this.prisma.spatialNode.findFirst({
            where: {
              id: query.ancestorId,
              organizationId
            },
            select: {
              path: true
            }
          })
        )?.path ?? null
      : null;

    const search = normalizeSearchTerm(query.q);
    const filtered = nodes
      .filter((node) => {
        if (query.type && node.type !== query.type) {
          return false;
        }
        if (query.parentId && (node.parentId ?? null) !== query.parentId) {
          return false;
        }
        if (query.isActive && String(node.isActive) !== query.isActive) {
          return false;
        }
        if (ancestorPath && node.path !== ancestorPath && !node.path.startsWith(`${ancestorPath}/`)) {
          return false;
        }
        return matchesSearchTerm(search, [node.code, node.label, node.externalRef, node.sourceClass]);
      })
      .map((node) => this.mapListItem(node));

    const sorted = sortItems(
      filtered,
      {
        path: (item: SpatialNodeListItem) => item.path,
        code: (item: SpatialNodeListItem) => item.code,
        label: (item: SpatialNodeListItem) => item.label,
        type: (item: SpatialNodeListItem) => item.type,
        createdAt: (item: SpatialNodeListItem) => item.createdAt,
        updatedAt: (item: SpatialNodeListItem) => item.updatedAt
      }[query.sort ?? "path"],
      query.direction ?? "asc"
    );

    return paginateItems(sorted, query.page, query.pageSize);
  }

  async getTree(organizationId: string, ancestorId?: string | null) {
    const nodes = await this.prisma.spatialNode.findMany({
      where: {
        organizationId
      },
      include: {
        parent: true,
        children: true,
        currentEquipments: {
          select: {
            id: true
          }
        }
      }
    });

    if (!ancestorId) {
      return this.buildTree(nodes);
    }

    const root = nodes.find((node) => node.id === ancestorId);
    if (!root) {
      throw new NotFoundException("Noeud spatial introuvable");
    }
    const subtree = nodes.filter((node) => node.path === root.path || node.path.startsWith(`${root.path}/`));
    return this.buildTree(subtree, root.parentId ?? null).filter((item) => item.id === root.id);
  }

  async getDetail(organizationId: string, nodeId: string): Promise<SpatialNodeDetail> {
    const node = await this.prisma.spatialNode.findFirst({
      where: {
        id: nodeId,
        organizationId
      },
      include: {
        parent: true,
        currentEquipments: {
          select: {
            id: true
          }
        },
        children: {
          include: {
            parent: true,
            children: true,
            currentEquipments: {
              select: {
                id: true
              }
            }
          }
        }
      }
    });
    if (!node) {
      throw new NotFoundException("Noeud spatial introuvable");
    }
    return {
      ...this.mapListItem(node),
      children: node.children.map((child) => this.mapListItem(child))
    };
  }

  async getSummary(organizationId: string) {
    const [total, roots, recentImports, byType, scopesCount] = await Promise.all([
      this.prisma.spatialNode.count({ where: { organizationId } }),
      this.prisma.spatialNode.count({ where: { organizationId, parentId: null } }),
      this.prisma.spatialNode.findMany({
        where: { organizationId },
        take: 5,
        orderBy: { updatedAt: "desc" },
        include: {
          parent: true,
          children: true,
          currentEquipments: {
            select: {
              id: true
            }
          }
        }
      }),
      this.prisma.spatialNode.groupBy({
        by: ["type"],
        where: { organizationId },
        _count: true
      }),
      this.prisma.iamAccessScope.count({
        where: {
          organizationId,
          spatialNodeId: {
            not: null
          }
        }
      })
    ]);

    return {
      total,
      roots,
      scopesCount,
      lastUpdatedAt: recentImports[0]?.updatedAt.toISOString() ?? null,
      recentNodes: recentImports.map((node) => this.mapListItem(node)),
      countsByType: byType.map((item) => ({
        type: item.type,
        count: item._count
      }))
    };
  }

  async getDisplaySettings(organizationId: string): Promise<OrganizationSpatialDisplaySettings> {
    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { settings: true }
    });

    const defaults = buildDefaultOrganizationSettings().spatialDisplay;
    const raw = organization.settings;
    if (!raw || typeof raw !== "object") {
      return defaults;
    }

    const spatialDisplay = (raw as Record<string, unknown>).spatialDisplay;
    if (!spatialDisplay || typeof spatialDisplay !== "object") {
      return defaults;
    }

    const nodeTypesValue = (spatialDisplay as Record<string, unknown>).nodeTypes;
    if (!nodeTypesValue || typeof nodeTypesValue !== "object") {
      return defaults;
    }
    const nodeTypes = nodeTypesValue as Record<string, unknown>;

    return {
      nodeTypes: {
        SITE: this.readDisplayType(nodeTypes, "SITE", defaults),
        BUILDING: this.readDisplayType(nodeTypes, "BUILDING", defaults),
        FLOOR: this.readDisplayType(nodeTypes, "FLOOR", defaults),
        ZONE: this.readDisplayType(nodeTypes, "ZONE", defaults),
        ROOM: this.readDisplayType(nodeTypes, "ROOM", defaults),
        LOCATION: this.readDisplayType(nodeTypes, "LOCATION", defaults)
      }
    };
  }

  async create(auth: AuthenticatedUser, dto: CreateSpatialNodeDto) {
    const type = dto.type;
    if (type === "LOCATION") {
      throw new BadRequestException("Le type LOCATION est reserve a la migration legacy");
    }
    const parent = await this.resolveParentForMutation(auth.organizationId, type, dto.parentId ?? null);
    const resolved = this.resolvePathForPersistence({
      type,
      code: dto.code,
      label: dto.label,
      parentPath: parent?.path ?? null
    });

    const created = await this.prisma.$transaction(async (tx) => {
      await this.ensureNoPathConflicts(tx, auth.organizationId, [resolved.path]);
      const node = await tx.spatialNode.create({
        data: {
          organizationId: auth.organizationId,
          type: type as SpatialNodeType,
          code: resolved.code,
          label: resolved.label,
          description: normalizeLabel(dto.description ?? null),
          path: resolved.path,
          depth: resolved.depth,
          sortOrder: 0,
          parentId: parent?.id ?? null,
          externalSource: dto.externalRef || dto.sourceClass ? SpatialSourceKind.CSV : null,
          externalRef: normalizeOptionalString(dto.externalRef),
          sourceClass: normalizeOptionalString(dto.sourceClass),
          sourceMetadata: toJsonInput(dto.sourceMetadata ?? null),
          isActive: dto.isActive ?? true
        },
        include: {
          parent: true,
          children: true,
          currentEquipments: {
            select: {
              id: true
            }
          }
        }
      });
      await this.syncScopesForSpatialNodes(tx, auth.organizationId, [node.id]);
      await this.auditService.log({
        db: tx,
        organizationId: auth.organizationId,
        userId: auth.sub,
        action: "spatial.node.created",
        entityType: "spatial_node",
        entityId: node.id,
        metadata: {
          type,
          path: resolved.path
        }
      });
      return node;
    });

    return this.mapListItem(created);
  }

  async update(auth: AuthenticatedUser, nodeId: string, dto: UpdateSpatialNodeDto) {
    const { node, descendants } = await this.getNodeWithDescendants(auth.organizationId, nodeId);
    const nextType = dto.type;
    if (node.type !== "LOCATION" && nextType === "LOCATION") {
      throw new BadRequestException("Le type LOCATION est reserve a la migration legacy");
    }
    if (node.type === "LOCATION" && nextType !== "LOCATION") {
      throw new BadRequestException("Un noeud LOCATION legacy ne peut pas changer de type");
    }

    const parent = await this.resolveParentForMutation(auth.organizationId, nextType, dto.parentId ?? null, node.path);
    const resolved = this.resolvePathForPersistence({
      type: nextType,
      code: dto.code,
      label: dto.label,
      parentPath: parent?.path ?? null
    });
    const subtreeNodes = [node, ...descendants];
    const targetPaths = subtreeNodes.map((item) =>
      item.id === node.id ? resolved.path : item.path.replace(`${node.path}/`, `${resolved.path}/`)
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.ensureNoPathConflicts(
        tx,
        auth.organizationId,
        targetPaths,
        subtreeNodes.map((item) => item.id)
      );

      const root = await tx.spatialNode.update({
        where: { id: node.id },
        data: {
          type: nextType as SpatialNodeType,
          code: resolved.code,
          label: resolved.label,
          description: normalizeLabel(dto.description ?? null),
          path: resolved.path,
          depth: resolved.depth,
          parentId: parent?.id ?? null,
          externalRef: normalizeOptionalString(dto.externalRef),
          sourceClass: normalizeOptionalString(dto.sourceClass),
          sourceMetadata: toJsonInput(dto.sourceMetadata ?? null),
          isActive: dto.isActive ?? node.isActive
        },
        include: {
          parent: true,
          children: true,
          currentEquipments: {
            select: {
              id: true
            }
          }
        }
      });

      for (const descendant of descendants) {
        const descendantPath = descendant.path.replace(`${node.path}/`, `${resolved.path}/`);
        await tx.spatialNode.update({
          where: { id: descendant.id },
          data: {
            path: descendantPath,
            depth: pathDepth(descendantPath)
          }
        });
      }

      await this.syncScopesForSubtree(tx, auth.organizationId, resolved.path);
      await this.auditService.log({
        db: tx,
        organizationId: auth.organizationId,
        userId: auth.sub,
        action: "spatial.node.updated",
        entityType: "spatial_node",
        entityId: node.id,
        metadata: {
          previousPath: node.path,
          nextPath: resolved.path
        }
      });
      return root;
    });

    return this.mapListItem(updated);
  }

  async archive(auth: AuthenticatedUser, nodeId: string) {
    const { node, descendants } = await this.getNodeWithDescendants(auth.organizationId, nodeId);
    await this.prisma.$transaction(async (tx) => {
      await tx.spatialNode.updateMany({
        where: {
          organizationId: auth.organizationId,
          OR: [
            { id: node.id },
            { path: { startsWith: `${node.path}/` } }
          ]
        },
        data: {
          isActive: false
        }
      });
      await this.syncScopesForSubtree(tx, auth.organizationId, node.path);
      await this.auditService.log({
        db: tx,
        organizationId: auth.organizationId,
        userId: auth.sub,
        action: "spatial.node.archived",
        entityType: "spatial_node",
        entityId: node.id,
        metadata: {
          path: node.path,
          descendants: descendants.length
        }
      });
    });

    return this.getDetail(auth.organizationId, nodeId);
  }

  private prepareRow(row: ReturnType<typeof normalizeImportRows>[number], allowLegacyLocationImport: boolean): PreparedSpatialRow {
    const typeValue = normalizeOptionalString(row.normalizedValues.type);
    const type = typeValue && ["SITE", "BUILDING", "FLOOR", "ZONE", "ROOM", "LOCATION"].includes(typeValue)
      ? (typeValue as SharedSpatialNodeType)
      : null;
    const code = normalizeOptionalString(row.normalizedValues.code);
    const normalizedCode = code ? normalizeAscii(code) : null;
    const label = normalizeLabel(normalizeOptionalString(row.normalizedValues.label));
    const description = normalizeLabel(normalizeOptionalString(row.normalizedValues.description));
    const explicitPath = normalizeOptionalString(row.normalizedValues.path);
    const normalizedPath = explicitPath ? normalizePath(explicitPath) : null;
    const explicitParentPath = normalizeOptionalString(row.normalizedValues.parentPath);
    const normalizedParentPath = explicitParentPath ? normalizePath(explicitParentPath) : null;

    let path = normalizedPath;
    if (!path && type === "SITE" && normalizedCode) {
      path = normalizedCode;
    }
    if (!path && normalizedParentPath && normalizedCode) {
      path = `${normalizedParentPath}/${normalizedCode}`;
    }

    const parentPath = type === "SITE" ? null : normalizedParentPath ?? (path ? deriveParentPath(path) : null);
    const depth = path ? pathDepth(path) : null;

    const messages = [...row.messages];
    if (!typeValue) {
      messages.push("TYPE_REQUIRED");
    } else if (!type) {
      messages.push("TYPE_INVALID");
    }
    if (!normalizedCode) {
      messages.push("CODE_REQUIRED");
    }
    if (!label) {
      messages.push("LABEL_REQUIRED");
    }
    if (!path) {
      messages.push("PATH_UNRESOLVABLE");
    }
    if (type === "SITE" && parentPath) {
      messages.push("SITE_PARENT_FORBIDDEN");
    }
    if (type === "LOCATION" && !allowLegacyLocationImport) {
      messages.push("LEGACY_LOCATION_IMPORT_FORBIDDEN");
    }

    return {
      rowIndex: row.rowIndex,
      normalizedValues: row.normalizedValues,
      messages,
      resolvedTargetKey: path ?? row.resolvedTargetKey,
      type,
      code: normalizedCode,
      label,
      description,
      path,
      parentPath,
      externalRef: normalizeOptionalString(row.normalizedValues.externalRef),
      sourceClass: normalizeOptionalString(row.normalizedValues.sourceClass),
      sourceMetadata: this.parseSourceMetadata(row.normalizedValues.sourceMetadata ?? null),
      geometrySource: normalizeOptionalString(row.normalizedValues.geometrySource),
      geometryMetadata: this.parseSourceMetadata(row.normalizedValues.geometryMetadata ?? null),
      worldCenterX: parseOptionalNumber(row.normalizedValues.worldCenterX),
      worldCenterY: parseOptionalNumber(row.normalizedValues.worldCenterY),
      worldCenterZ: parseOptionalNumber(row.normalizedValues.worldCenterZ),
      worldSizeX: parseOptionalNumber(row.normalizedValues.worldSizeX),
      worldSizeY: parseOptionalNumber(row.normalizedValues.worldSizeY),
      worldSizeZ: parseOptionalNumber(row.normalizedValues.worldSizeZ),
      isActive: typeof row.normalizedValues.isActive === "boolean" ? row.normalizedValues.isActive : true,
      depth
    };
  }

  private isSpatialImportNoOp(
    existing: Prisma.SpatialNodeGetPayload<{}>,
    row: PreparedSpatialRow,
    parentId: string | null
  ) {
    return (
      existing.type === row.type &&
      existing.code === row.code &&
      existing.label === row.label &&
      (existing.description ?? null) === row.description &&
      existing.path === row.path &&
      existing.parentId === parentId &&
      (existing.externalRef ?? null) === row.externalRef &&
      (existing.sourceClass ?? null) === row.sourceClass &&
      jsonCompareValue(existing.sourceMetadata) === jsonCompareValue(row.sourceMetadata) &&
      (existing.geometrySource ?? null) === row.geometrySource &&
      jsonCompareValue(existing.geometryMetadata) === jsonCompareValue(row.geometryMetadata) &&
      nullableNumberCompare(existing.worldCenterX, row.worldCenterX) &&
      nullableNumberCompare(existing.worldCenterY, row.worldCenterY) &&
      nullableNumberCompare(existing.worldCenterZ, row.worldCenterZ) &&
      nullableNumberCompare(existing.worldSizeX, row.worldSizeX) &&
      nullableNumberCompare(existing.worldSizeY, row.worldSizeY) &&
      nullableNumberCompare(existing.worldSizeZ, row.worldSizeZ) &&
      existing.isActive === row.isActive
    );
  }

  async buildImportReport(input: {
    organizationId: string;
    mode: ImportReportMode;
    sourceSnapshot: ImportSourceSnapshot;
    mappings: ImportMappingInput[];
    options?: Record<string, unknown> | null;
  }): Promise<ImportJobReport> {
    const allowLegacyLocationImport = input.options?.allowLegacyLocationImport === true;
    const normalizedRows = normalizeImportRows({
      targetDomain: "spatial-nodes",
      rawRows: await readRawRows(input.sourceSnapshot.rawRowsRef),
      mappings: input.mappings
    });

    const preparedRows = normalizedRows.map((row) => this.prepareRow(row, allowLegacyLocationImport));
    const duplicatePathCounts = new Map<string, number>();
    const duplicateParentCodeCounts = new Map<string, number>();
    for (const row of preparedRows) {
      if (row.path) {
        duplicatePathCounts.set(row.path, (duplicatePathCounts.get(row.path) ?? 0) + 1);
      }
      if (row.parentPath && row.code) {
        const key = `${row.parentPath}::${row.code}`;
        duplicateParentCodeCounts.set(key, (duplicateParentCodeCounts.get(key) ?? 0) + 1);
      }
    }

    const existingNodes = await this.prisma.spatialNode.findMany({
      where: {
        organizationId: input.organizationId
      }
    });
    const existingByPath = new Map(existingNodes.map((node) => [node.path, node]));
    const existingByParentAndCode = new Map(existingNodes.map((node) => [`${node.parentId ?? "ROOT"}::${node.code}`, node]));
    const stagedByPath = new Map<string, PreparedSpatialRow>();

    const orderedRows = [...preparedRows].sort((left, right) => {
      const leftDepth = left.depth ?? Number.MAX_SAFE_INTEGER;
      const rightDepth = right.depth ?? Number.MAX_SAFE_INTEGER;
      if (leftDepth === rightDepth) {
        return left.rowIndex - right.rowIndex;
      }
      return leftDepth - rightDepth;
    });

    const results = new Map<number, ExecutionCandidate>();
    for (const row of orderedRows) {
      const messages = [...row.messages];
      if (row.path && (duplicatePathCounts.get(row.path) ?? 0) > 1) {
        messages.push("DUPLICATE_PATH_IN_FILE");
      }
      if (row.parentPath && row.code && (duplicateParentCodeCounts.get(`${row.parentPath}::${row.code}`) ?? 0) > 1) {
        messages.push("DUPLICATE_CODE_UNDER_PARENT");
      }

      let parentId: string | null = null;
      let parentType: SharedSpatialNodeType | null = null;
      if (row.type !== "SITE") {
        if (!row.parentPath) {
          messages.push("PARENT_NOT_FOUND");
        } else {
          const stagedParent = stagedByPath.get(row.parentPath);
          const existingParent = existingByPath.get(row.parentPath);
          if (stagedParent) {
            parentType = stagedParent.type;
            const resolvedParent = results.get(stagedParent.rowIndex);
            if (!resolvedParent || resolvedParent.operation === "REJECT") {
              messages.push("PARENT_NOT_FOUND");
            } else {
              parentId = resolvedParent.existingId;
            }
          } else if (existingParent) {
            parentId = existingParent.id;
            parentType = existingParent.type as SharedSpatialNodeType;
          } else {
            messages.push("PARENT_NOT_FOUND");
          }
        }
      }

      if (!this.validateParentChild(parentType, row.type)) {
        if (!(row.type === "SITE" && parentType == null)) {
          messages.push("PARENT_CHILD_TYPE_MISMATCH");
        }
      }

      let operation: "CREATE" | "UPDATE" | "NO_OP" | "REJECT" = "CREATE";
      let existingId: string | null = null;
      if (messages.length > 0 || !row.path || !row.code || !row.label || row.depth == null || !row.type) {
        operation = "REJECT";
      } else {
        const existingByPathNode = existingByPath.get(row.path);
        if (existingByPathNode) {
          operation = this.isSpatialImportNoOp(existingByPathNode, row, parentId) ? "NO_OP" : "UPDATE";
          existingId = existingByPathNode.id;
        } else {
          const parentCodeKey = `${parentId ?? "ROOT"}::${row.code}`;
          const existingByParentCodeNode = existingByParentAndCode.get(parentCodeKey);
          if (existingByParentCodeNode) {
            messages.push("DUPLICATE_CODE_UNDER_PARENT");
            operation = "REJECT";
          }
        }
      }

      const candidate: ExecutionCandidate = {
        ...row,
        messages,
        parentId,
        operation,
        existingId
      };
      results.set(row.rowIndex, candidate);
      if (candidate.operation !== "REJECT" && candidate.path) {
        stagedByPath.set(candidate.path, row);
      }
    }

    const rows: ImportRowReport[] = preparedRows.map((row) => {
      const result = results.get(row.rowIndex)!;
      let status: ImportRowStatus;
      if (result.operation === "REJECT") {
        status = "REJECTED";
      } else if (result.operation === "NO_OP") {
        status = "NO_OP";
      } else if (input.mode === "EXECUTE") {
        status = result.operation === "CREATE" ? "CREATED" : "UPDATED";
      } else if (result.messages.length > 0) {
        status = "WARNING";
      } else {
        status = "VALID";
      }

      const operationMessage = result.operation === "REJECT" ? [] : [`OPERATION_${result.operation}`];
      return {
        rowIndex: row.rowIndex,
        status,
        resolvedTargetKey: result.path,
        normalizedValues: {
          ...row.normalizedValues,
          type: result.type,
          code: result.code,
          label: result.label,
          path: result.path,
          parentPath: result.parentPath,
          sourceClass: result.sourceClass,
          sourceMetadata: result.sourceMetadata ? JSON.stringify(result.sourceMetadata) : null,
          geometrySource: result.geometrySource,
          geometryMetadata: result.geometryMetadata ? JSON.stringify(result.geometryMetadata) : null,
          worldCenterX: result.worldCenterX,
          worldCenterY: result.worldCenterY,
          worldCenterZ: result.worldCenterZ,
          worldSizeX: result.worldSizeX,
          worldSizeY: result.worldSizeY,
          worldSizeZ: result.worldSizeZ
        },
        messages: [...result.messages, ...operationMessage]
      };
    });

    const successfulRows = rows.filter((row) => row.status !== "REJECTED");
    const writableRows = rows.filter((row) => !["REJECTED", "NO_OP", "SKIPPED"].includes(row.status));
    return {
      mode: input.mode,
      targetDomain: "spatial-nodes" as ImportTargetDomain,
      headers: input.sourceSnapshot.headers,
      mappings: input.mappings,
      summary: {
        rowsRead: rows.length,
        rowsValid: successfulRows.length,
        rowsRejected: rows.filter((row) => row.status === "REJECTED").length,
        rowsWithWarnings: rows.filter((row) => row.status === "WARNING").length,
        simulatedWrites: input.mode === "EXECUTE" ? 0 : writableRows.length,
        appliedWrites: 0,
        executionMode: input.mode,
        targetDomain: "spatial-nodes"
      },
      rows
    };
  }

  private readDisplayType(
    nodeTypes: Record<string, unknown>,
    type: SharedSpatialNodeType,
    defaults: OrganizationSpatialDisplaySettings
  ) {
    const fallback = defaults.nodeTypes[type];
    const candidate = nodeTypes[type];
    if (!candidate || typeof candidate !== "object") {
      return fallback;
    }

    const candidateRecord = candidate as Record<string, unknown>;
    const iconCandidate: string =
      typeof candidateRecord.icon === "string"
        ? candidateRecord.icon
        : fallback.icon;
    const colorCandidate: string =
      typeof candidateRecord.color === "string"
        ? candidateRecord.color
        : fallback.color;

    return {
      icon: ["globe", "building", "layers", "map", "door", "pin"].includes(iconCandidate)
        ? (iconCandidate as typeof fallback.icon)
        : fallback.icon,
      color: /^#[0-9A-Fa-f]{6}$/.test(colorCandidate) ? colorCandidate.toUpperCase() : fallback.color
    };
  }

  async executeImportReport(input: {
    db?: Prisma.TransactionClient;
    organizationId: string;
    report: ImportJobReport;
    importProfileId?: string | null;
    importJobId: string;
    sourceKind?: "CSV" | "XLSX" | null;
  }) {
    const executableRows = input.report.rows
      .filter((row) => !["REJECTED", "NO_OP", "SKIPPED"].includes(row.status) && typeof row.resolvedTargetKey === "string")
      .sort((left, right) => String(left.resolvedTargetKey).split("/").length - String(right.resolvedTargetKey).split("/").length);

    let appliedWrites = 0;
    const pathToId = new Map<string, string>();
    const pathToType = new Map<string, SharedSpatialNodeType>();
    const sourceKind =
      input.sourceKind === "CSV" ? SpatialSourceKind.CSV : input.sourceKind === "XLSX" ? SpatialSourceKind.XLSX : null;
    const run = async (tx: Prisma.TransactionClient) => {
      const existingNodes = await tx.spatialNode.findMany({
        where: {
          organizationId: input.organizationId
        }
      });
      for (const node of existingNodes) {
        pathToId.set(node.path, node.id);
        pathToType.set(node.path, node.type as SharedSpatialNodeType);
      }

      const touchedPaths = new Set<string>();
      for (const row of executableRows) {
        const values = row.normalizedValues;
        const type = normalizeOptionalString(values.type) as SharedSpatialNodeType | null;
        const path = normalizeOptionalString(values.path);
        const code = normalizeOptionalString(values.code);
        const label = normalizeOptionalString(values.label);
        if (!path || !code || !label || !type) {
          continue;
        }
        const resolved = this.resolvePathForPersistence({
          type,
          code,
          label,
          path,
          parentPath: normalizeOptionalString(values.parentPath)
        });
        const parentId = resolved.parentPath ? (pathToId.get(resolved.parentPath) ?? null) : null;
        const parentType = resolved.parentPath ? pathToType.get(resolved.parentPath) ?? null : null;
        if (resolved.type !== "SITE" && (!resolved.parentPath || !parentId)) {
          throw new BadRequestException("Parent spatial inconnu");
        }
        this.validateImportHierarchy(parentType, resolved.type);
        const sourceMetadataValue = normalizeOptionalString(values.sourceMetadata);
        const sourceMetadata = sourceMetadataValue ? this.parseSourceMetadata(sourceMetadataValue) : null;
        const geometryMetadataValue = normalizeOptionalString(values.geometryMetadata);
        const geometryMetadata = geometryMetadataValue ? this.parseSourceMetadata(geometryMetadataValue) : null;
        const geometrySource = normalizeOptionalString(values.geometrySource);
        const geometryData = geometrySource
          ? {
              geometrySource,
              geometryMetadata: toJsonInput(geometryMetadata),
              worldCenterX: parseOptionalNumber(values.worldCenterX),
              worldCenterY: parseOptionalNumber(values.worldCenterY),
              worldCenterZ: parseOptionalNumber(values.worldCenterZ),
              worldSizeX: parseOptionalNumber(values.worldSizeX),
              worldSizeY: parseOptionalNumber(values.worldSizeY),
              worldSizeZ: parseOptionalNumber(values.worldSizeZ),
              geometryUpdatedAt: new Date()
            }
          : {};
        const data = {
          organizationId: input.organizationId,
          type: resolved.type as SpatialNodeType,
          code: resolved.code,
          label: resolved.label,
          description: normalizeOptionalString(values.description),
          path: resolved.path,
          depth: resolved.depth,
          sortOrder: 0,
          parentId,
          externalSource: sourceKind,
          externalRef: normalizeOptionalString(values.externalRef),
          sourceClass: normalizeOptionalString(values.sourceClass),
          sourceMetadata: toJsonInput(sourceMetadata),
          ...geometryData,
          importProfileId: input.importProfileId ?? null,
          lastImportJobId: input.importJobId,
          isActive: typeof values.isActive === "boolean" ? values.isActive : true
        };

        const existing = await tx.spatialNode.findFirst({
          where: {
            organizationId: input.organizationId,
            path: resolved.path
          }
        });
        if (existing) {
          const updated = await tx.spatialNode.update({
            where: {
              id: existing.id
            },
            data
          });
          await tx.importJobWrite.create({
            data: {
              organizationId: input.organizationId,
              jobId: input.importJobId,
              targetDomain: "SPATIAL_NODES",
              targetEntityType: "spatial_node",
              targetEntityId: updated.id,
              operation: "UPDATED",
              targetPath: resolved.path,
              payload: {
                parentId,
                parentPath: resolved.parentPath,
                externalRef: data.externalRef,
                sourceClass: data.sourceClass
              }
            }
          });
          pathToId.set(resolved.path, existing.id);
          pathToType.set(resolved.path, resolved.type);
        } else {
          const created = await tx.spatialNode.create({
            data
          });
          await tx.importJobWrite.create({
            data: {
              organizationId: input.organizationId,
              jobId: input.importJobId,
              targetDomain: "SPATIAL_NODES",
              targetEntityType: "spatial_node",
              targetEntityId: created.id,
              operation: "CREATED",
              targetPath: resolved.path,
              payload: {
                parentId,
                parentPath: resolved.parentPath,
                externalRef: data.externalRef,
                sourceClass: data.sourceClass
              }
            }
          });
          pathToId.set(resolved.path, created.id);
          pathToType.set(resolved.path, resolved.type);
        }
        touchedPaths.add(resolved.path);
        appliedWrites += 1;
      }

      const touchedNodes = await tx.spatialNode.findMany({
        where: {
          organizationId: input.organizationId,
          path: {
            in: Array.from(touchedPaths)
          }
        },
        select: {
          id: true
        }
      });
      await this.syncScopesForSpatialNodes(
        tx,
        input.organizationId,
        touchedNodes.map((node) => node.id)
      );
    };

    if (input.db) {
      await run(input.db);
    } else {
      await this.prisma.$transaction(run);
    }

    return appliedWrites;
  }

  async purgeCreatedDataForImportJob(input: {
    organizationId: string;
    userId: string;
    jobId: string;
    writes: Array<{
      targetEntityId: string;
      operation: string;
      targetPath: string | null;
    }>;
  }): Promise<ImportJobPurgeCreatedDataResult> {
    const createdWrites = input.writes.filter((write) => write.operation === "CREATED");
    const updatedWrites = input.writes.filter((write) => write.operation === "UPDATED");
    const createdIds = createdWrites.map((write) => write.targetEntityId);
    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: {
        id: input.organizationId
      },
      select: {
        settings: true
      }
    });
    const spatialScopePolicy = resolveSpatialScopePolicy(
      organization.settings && typeof organization.settings === "object"
        ? (organization.settings as Record<string, unknown>).iam
        : null
    );
    const isOrganizationWide = spatialScopePolicy === "ORGANIZATION_WIDE";

    if (createdIds.length === 0) {
      return {
        status: "NO_OP",
        summary: {
          trackedCreated: 0,
          trackedUpdated: updatedWrites.length,
          alreadyMissing: 0,
          purgedNodes: 0,
          purgedScopes: 0,
          blockedNodes: 0
        },
        blocked: []
      };
    }

    const existingCreatedNodes = await this.prisma.spatialNode.findMany({
      where: {
        organizationId: input.organizationId,
        id: {
          in: createdIds
        }
      },
      orderBy: [{ depth: "desc" }, { path: "desc" }]
    });
    const existingCreatedIdSet = new Set(existingCreatedNodes.map((node) => node.id));
    const alreadyMissing = createdIds.filter((id) => !existingCreatedIdSet.has(id)).length;

    if (existingCreatedNodes.length === 0) {
      return {
        status: "NO_OP",
        summary: {
          trackedCreated: createdWrites.length,
          trackedUpdated: updatedWrites.length,
          alreadyMissing,
          purgedNodes: 0,
          purgedScopes: 0,
          blockedNodes: 0
        },
        blocked: []
      };
    }

    const blocked: ImportJobPurgeCreatedDataResult["blocked"] = [];
    for (const node of existingCreatedNodes) {
      const foreignDescendant = await this.prisma.spatialNode.findFirst({
        where: {
          organizationId: input.organizationId,
          path: {
            startsWith: `${node.path}/`
          },
          id: {
            notIn: createdIds
          }
        },
        select: {
          id: true
        }
      });
      if (foreignDescendant) {
        blocked.push({
          nodeId: node.id,
          path: node.path,
          reason: "HAS_FOREIGN_DESCENDANTS"
        });
        continue;
      }

      if (!isOrganizationWide) {
        const scope = await this.prisma.iamAccessScope.findFirst({
          where: {
            organizationId: input.organizationId,
            spatialNodeId: node.id
          },
          select: {
            id: true
          }
        });
        if (scope) {
          const assignments = await this.prisma.iamUserRole.count({
            where: {
              scopeId: scope.id
            }
          });
          if (assignments > 0) {
            blocked.push({
              nodeId: node.id,
              path: node.path,
              reason: "HAS_SCOPE_ASSIGNMENTS"
            });
          }
        }
      }
    }

    if (blocked.length > 0) {
      return {
        status: "BLOCKED",
        summary: {
          trackedCreated: createdWrites.length,
          trackedUpdated: updatedWrites.length,
          alreadyMissing,
          purgedNodes: 0,
          purgedScopes: 0,
          blockedNodes: blocked.length
        },
        blocked
      };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const scopes = await tx.iamAccessScope.findMany({
        where: {
          organizationId: input.organizationId,
          spatialNodeId: {
            in: existingCreatedNodes.map((node) => node.id)
          }
        },
        select: {
          id: true,
          spatialNodeId: true
        }
      });

      if (scopes.length > 0 && !isOrganizationWide) {
        const assignedScopeCount = await tx.iamUserRole.count({
          where: {
            scopeId: {
              in: scopes.map((scope) => scope.id)
            }
          }
        });
        if (assignedScopeCount > 0) {
          throw new BadRequestException("Purge bloquee par des affectations IAM actives");
        }
      }

      let purgedScopes = 0;
      if (scopes.length > 0) {
        const deletedScopes = await tx.iamAccessScope.deleteMany({
          where: {
            id: {
              in: scopes.map((scope) => scope.id)
            }
          }
        });
        purgedScopes = deletedScopes.count;
      }

      const deletedNodes = await tx.spatialNode.deleteMany({
        where: {
          organizationId: input.organizationId,
          id: {
            in: existingCreatedNodes.map((node) => node.id)
          }
        }
      });

      await this.auditService.log({
        db: tx,
        organizationId: input.organizationId,
        userId: input.userId,
        action: "imports.job.purged_created_data",
        entityType: "import_job",
        entityId: input.jobId,
        metadata: {
          trackedCreated: createdWrites.length,
          trackedUpdated: updatedWrites.length,
          alreadyMissing,
          purgedNodes: deletedNodes.count,
          purgedScopes
        }
      });

      return {
        purgedNodes: deletedNodes.count,
        purgedScopes
      };
    });

    return {
      status: result.purgedNodes > 0 ? "PURGED" : "NO_OP",
      summary: {
        trackedCreated: createdWrites.length,
        trackedUpdated: updatedWrites.length,
        alreadyMissing,
        purgedNodes: result.purgedNodes,
        purgedScopes: result.purgedScopes,
        blockedNodes: 0
      },
      blocked: []
    };
  }

  async backfillLegacyLocations(organizationId?: string) {
    const where = organizationId ? { organizationId } : {};
    const locations = await this.prisma.location.findMany({
      where
    });
    let createdCount = 0;
    const conflicts: Array<{ organizationId: string; locationId: string; code: string }> = [];

    for (const location of locations) {
      const existingByLegacyId = await this.prisma.spatialNode.findFirst({
        where: {
          legacyLocationId: location.id
        }
      });
      if (existingByLegacyId) {
        continue;
      }
      const resolved = this.resolvePathForPersistence({
        type: "LOCATION",
        code: location.code,
        label: location.name,
        path: location.code
      });
      const conflict = await this.prisma.spatialNode.findFirst({
        where: {
          organizationId: location.organizationId,
          path: resolved.path
        }
      });
      if (conflict) {
        conflicts.push({
          organizationId: location.organizationId,
          locationId: location.id,
          code: location.code
        });
        continue;
      }

      const createdNode = await this.prisma.spatialNode.create({
        data: {
          organizationId: location.organizationId,
          type: "LOCATION",
          code: resolved.code,
          label: resolved.label,
          description: location.description,
          path: resolved.path,
          depth: resolved.depth,
          sortOrder: 0,
          legacyLocationId: location.id,
          externalSource: "LEGACY",
          sourceClass: null,
          sourceMetadata: JSON_NULL,
          isActive: true
        }
      });
      await this.syncScopesForSpatialNodes(this.prisma, location.organizationId, [createdNode.id]);
      createdCount += 1;
    }

    return {
      createdCount,
      conflicts
    };
  }
}
