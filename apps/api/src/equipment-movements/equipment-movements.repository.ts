import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";

export type DbClient = PrismaService | Prisma.TransactionClient;

export const equipmentMovementInclude = {
  equipment: {
    select: {
      id: true,
      internalCode: true
    }
  },
  createdBy: {
    select: {
      id: true,
      email: true,
      name: true
    }
  }
} satisfies Prisma.EquipmentMovementInclude;

@Injectable()
export class EquipmentMovementsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByOrganization(organizationId: string) {
    return this.prisma.equipmentMovement.findMany({
      where: { organizationId },
      include: equipmentMovementInclude,
      orderBy: { createdAt: "desc" }
    });
  }

  findById(organizationId: string, movementId: string) {
    return this.prisma.equipmentMovement.findFirst({
      where: {
        id: movementId,
        organizationId
      },
      include: equipmentMovementInclude
    });
  }

  createMany(db: DbClient, rows: Prisma.EquipmentMovementCreateManyInput[]) {
    if (rows.length === 0) {
      return Promise.resolve({ count: 0 });
    }
    return db.equipmentMovement.createMany({
      data: rows
    });
  }
}
