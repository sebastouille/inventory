import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";

type DbClient = PrismaService | Prisma.TransactionClient;

export const equipmentInclude = {
  equipmentType: {
    include: {
      subfamily: {
        include: {
          family: true
        }
      }
    }
  },
  equipmentModel: {
    include: {
      brand: true
    }
  },
  equipmentStatus: true,
  ownerEntity: true,
  immobilization: {
    include: {
      _count: {
        select: {
          equipments: true
        }
      }
    }
  },
  currentSpatialNode: true,
  assignments: {
    include: {
      targetUser: true,
      targetLocation: true,
      targetEquipment: {
        include: {
          equipmentModel: {
            include: {
              brand: true
            }
          },
          equipmentType: {
            include: {
              subfamily: {
                include: {
                  family: true
                }
              }
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  }
} satisfies Prisma.EquipmentInclude;

@Injectable()
export class AssetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByOrganization(organizationId: string) {
    return this.prisma.equipment.findMany({
      where: { organizationId },
      include: equipmentInclude,
      orderBy: { createdAt: "desc" }
    });
  }

  findById(organizationId: string, assetId: string) {
    return this.prisma.equipment.findFirst({
      where: {
        id: assetId,
        organizationId
      },
      include: equipmentInclude
    });
  }

  findByIdWithClient(db: DbClient, organizationId: string, assetId: string) {
    return db.equipment.findFirst({
      where: {
        id: assetId,
        organizationId
      },
      include: equipmentInclude
    });
  }

  findByIds(organizationId: string, assetIds: string[]) {
    return this.prisma.equipment.findMany({
      where: {
        organizationId,
        id: { in: assetIds }
      },
      include: {
        equipmentType: {
          include: {
            subfamily: {
              include: {
                family: true
              }
            }
          }
        }
      }
    });
  }

  listAssignableUsers(organizationId: string) {
    return this.prisma.user.findMany({
      where: {
        organizationId,
        isActive: true
      },
      select: {
        id: true,
        email: true,
        name: true
      },
      orderBy: [{ name: "asc" }, { email: "asc" }]
    });
  }

  findActiveAttachmentRule(organizationId: string, sourceFamilyId: string, targetFamilyId: string) {
    return this.prisma.equipmentFamilyAttachmentRule.findFirst({
      where: {
        organizationId,
        sourceFamilyId,
        targetFamilyId,
        isActive: true
      }
    });
  }

  findEquipmentType(organizationId: string, equipmentTypeId: string) {
    return this.prisma.equipmentType.findFirst({
      where: {
        id: equipmentTypeId,
        organizationId
      },
      include: {
        subfamily: {
          include: {
            family: true
          }
        }
      }
    });
  }

  findEquipmentModel(organizationId: string, equipmentModelId: string) {
    return this.prisma.equipmentModel.findFirst({
      where: {
        id: equipmentModelId,
        organizationId
      },
      include: {
        brand: true
      }
    });
  }

  findEquipmentStatus(organizationId: string, equipmentStatusId: string) {
    return this.prisma.equipmentStatus.findFirst({
      where: {
        id: equipmentStatusId,
        organizationId
      }
    });
  }

  findOwnerEntity(organizationId: string, ownerEntityId: string) {
    return this.prisma.ownerEntity.findFirst({
      where: {
        id: ownerEntityId,
        organizationId
      }
    });
  }

  findLocationsByIds(organizationId: string, locationIds: string[]) {
    return this.prisma.location.findMany({
      where: {
        organizationId,
        id: { in: locationIds }
      }
    });
  }

  findSpatialNodeById(organizationId: string, spatialNodeId: string) {
    return this.prisma.spatialNode.findFirst({
      where: {
        id: spatialNodeId,
        organizationId
      }
    });
  }

  findImmobilizationById(organizationId: string, immobilizationId: string) {
    return this.prisma.immobilization.findFirst({
      where: {
        id: immobilizationId,
        organizationId
      }
    });
  }

  findImmobilizationByCode(organizationId: string, code: string) {
    return this.prisma.immobilization.findFirst({
      where: {
        organizationId,
        code
      }
    });
  }

  findUsersByIds(organizationId: string, userIds: string[]) {
    return this.prisma.user.findMany({
      where: {
        organizationId,
        id: { in: userIds },
        isActive: true
      }
    });
  }

  async createAsset(
    db: DbClient,
    input: {
      organizationId: string;
      internalCode: string;
      numPiece?: string | null;
      externalRef?: string | null;
      serialNumber?: string | null;
      equipmentTypeId: string;
      equipmentModelId?: string | null;
      equipmentStatusId: string;
      ownerEntityId: string;
      currentSpatialNodeId?: string | null;
      immobilizationId?: string | null;
      technicalCharacteristics?: string | null;
      notes?: string | null;
      receivedAt?: Date | null;
      commissionedAt?: Date | null;
      lastInventoryAt?: Date | null;
    }
  ) {
    return db.equipment.create({
      data: {
        organizationId: input.organizationId,
        internalCode: input.internalCode,
        numPiece: input.numPiece ?? null,
        externalRef: input.externalRef ?? null,
        serialNumber: input.serialNumber ?? null,
        equipmentTypeId: input.equipmentTypeId,
        equipmentModelId: input.equipmentModelId ?? null,
        equipmentStatusId: input.equipmentStatusId,
        ownerEntityId: input.ownerEntityId,
        currentSpatialNodeId: input.currentSpatialNodeId ?? null,
        immobilizationId: input.immobilizationId ?? null,
        technicalCharacteristics: input.technicalCharacteristics ?? null,
        notes: input.notes ?? null,
        receivedAt: input.receivedAt ?? null,
        commissionedAt: input.commissionedAt ?? null,
        lastInventoryAt: input.lastInventoryAt ?? null
      }
    });
  }

  updateAsset(
    db: DbClient,
    organizationId: string,
    assetId: string,
    input: {
      internalCode: string;
      numPiece?: string | null;
      externalRef?: string | null;
      serialNumber?: string | null;
      equipmentTypeId: string;
      equipmentModelId?: string | null;
      equipmentStatusId: string;
      ownerEntityId: string;
      currentSpatialNodeId?: string | null;
      immobilizationId?: string | null;
      technicalCharacteristics?: string | null;
      notes?: string | null;
      receivedAt?: Date | null;
      commissionedAt?: Date | null;
      lastInventoryAt?: Date | null;
    }
  ) {
    return db.equipment.update({
      where: {
        id: assetId
      },
      data: {
        organizationId,
        internalCode: input.internalCode,
        numPiece: input.numPiece ?? null,
        externalRef: input.externalRef ?? null,
        serialNumber: input.serialNumber ?? null,
        equipmentTypeId: input.equipmentTypeId,
        equipmentModelId: input.equipmentModelId ?? null,
        equipmentStatusId: input.equipmentStatusId,
        ownerEntityId: input.ownerEntityId,
        currentSpatialNodeId: input.currentSpatialNodeId ?? null,
        immobilizationId: input.immobilizationId ?? null,
        technicalCharacteristics: input.technicalCharacteristics ?? null,
        notes: input.notes ?? null,
        receivedAt: input.receivedAt ?? null,
        commissionedAt: input.commissionedAt ?? null,
        lastInventoryAt: input.lastInventoryAt ?? null
      }
    });
  }

  async replaceAssignments(
    db: DbClient,
    organizationId: string,
    assetId: string,
    assignments: Array<{
      assignmentType: "PERSON" | "LOCATION" | "ASSET";
      targetUserId?: string | null;
      targetPersonName?: string | null;
      targetLocationId?: string | null;
      targetEquipmentId?: string | null;
      startsAt?: Date;
      endsAt?: Date | null;
      notes?: string | null;
    }>
  ) {
    await db.equipmentAssignment.updateMany({
      where: {
        organizationId,
        equipmentId: assetId,
        endsAt: null
      },
      data: {
        endsAt: new Date()
      }
    });

    if (assignments.length === 0) {
      return;
    }

    await db.equipmentAssignment.createMany({
      data: assignments.map((assignment) => ({
        organizationId,
        equipmentId: assetId,
        assignmentType: assignment.assignmentType,
        targetUserId: assignment.targetUserId ?? null,
        targetPersonName: assignment.targetPersonName ?? null,
        targetLocationId: assignment.targetLocationId ?? null,
        targetEquipmentId: assignment.targetEquipmentId ?? null,
        startsAt: assignment.startsAt ?? new Date(),
        endsAt: assignment.endsAt ?? null,
        notes: assignment.notes ?? null
      }))
    });
  }

  archiveAsset(db: DbClient, assetId: string) {
    return db.equipment.update({
      where: { id: assetId },
      data: {
        isDeleted: true,
        deletedAt: new Date()
      }
    });
  }

  listHistory(organizationId: string, assetId: string) {
    return this.prisma.auditLog.findMany({
      where: {
        organizationId,
        entityId: assetId,
        entityType: {
          in: ["equipment", "equipment_assignment"]
        }
      },
      include: {
        user: {
          select: {
            email: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });
  }
}
