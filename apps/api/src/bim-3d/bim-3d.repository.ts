import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";

type DbClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class Bim3dRepository {
  constructor(private readonly prisma: PrismaService) {}

  listMaps(organizationId: string) {
    return this.prisma.bim3dMap.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" }
    });
  }

  findMap(organizationId: string, mapId: string) {
    return this.prisma.bim3dMap.findFirst({
      where: {
        id: mapId,
        organizationId
      }
    });
  }

  listBuilds(organizationId: string, mapId: string) {
    return this.prisma.bim3dMapBuild.findMany({
      where: {
        organizationId,
        mapId
      },
      orderBy: {
        startedAt: "desc"
      }
    });
  }

  findImportJob(organizationId: string, importJobId: string) {
    return this.prisma.importJob.findFirst({
      where: {
        id: importJobId,
        organizationId
      },
      select: {
        id: true,
        originalFilename: true
      }
    });
  }

  listSpatialNodes(organizationId: string, maxNodeDepth?: number | null) {
    return this.prisma.spatialNode.findMany({
      where: {
        organizationId,
        isActive: true,
        ...(maxNodeDepth ? { depth: { lte: maxNodeDepth } } : {})
      },
      select: {
        id: true,
        type: true,
        code: true,
        label: true,
        path: true,
        parentId: true,
        externalRef: true,
        externalSource: true,
        sourceClass: true,
        sourceMetadata: true,
        geometrySource: true,
        geometryMetadata: true,
        worldCenterX: true,
        worldCenterY: true,
        worldCenterZ: true,
        worldSizeX: true,
        worldSizeY: true,
        worldSizeZ: true,
        _count: {
          select: {
            currentEquipments: true
          }
        }
      },
      orderBy: {
        path: "asc"
      }
    });
  }

  listEquipments(organizationId: string) {
    return this.prisma.equipment.findMany({
      where: {
        organizationId,
        isDeleted: false
      },
      select: {
        id: true,
        internalCode: true,
        numPiece: true,
        externalRef: true,
        geometrySource: true,
        geometryMetadata: true,
        worldCenterX: true,
        worldCenterY: true,
        worldCenterZ: true,
        worldSizeX: true,
        worldSizeY: true,
        worldSizeZ: true,
        lastInventoryAt: true,
        currentSpatialNodeId: true,
        currentSpatialNode: {
          select: {
            path: true
          }
        },
        equipmentStatus: {
          select: {
            label: true
          }
        },
        equipmentType: {
          select: {
            label: true,
            subfamily: {
              select: {
                family: {
                  select: {
                    label: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        internalCode: "asc"
      }
    });
  }

  createMap(
    input: Prisma.Bim3dMapUncheckedCreateInput
  ) {
    return this.prisma.bim3dMap.create({
      data: input
    });
  }

  createBuild(input: Prisma.Bim3dMapBuildUncheckedCreateInput) {
    return this.prisma.bim3dMapBuild.create({
      data: input
    });
  }

  updateMap(db: DbClient, mapId: string, input: Prisma.Bim3dMapUncheckedUpdateInput) {
    return db.bim3dMap.update({
      where: { id: mapId },
      data: input
    });
  }

  updateBuild(db: DbClient, buildId: string, input: Prisma.Bim3dMapBuildUncheckedUpdateInput) {
    return db.bim3dMapBuild.update({
      where: { id: buildId },
      data: input
    });
  }
}
