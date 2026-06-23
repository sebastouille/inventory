import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";

type DbClient = PrismaService | Prisma.TransactionClient;

export const immobilizationInclude = {
  _count: {
    select: {
      equipments: true
    }
  }
} satisfies Prisma.ImmobilizationInclude;

export const immobilizationDetailInclude = {
  ...immobilizationInclude,
  equipments: {
    include: {
      equipmentType: true,
      equipmentStatus: true,
      currentSpatialNode: true
    },
    orderBy: {
      internalCode: "asc"
    }
  }
} satisfies Prisma.ImmobilizationInclude;

@Injectable()
export class ImmobilizationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByOrganization(organizationId: string) {
    return this.prisma.immobilization.findMany({
      where: { organizationId },
      include: immobilizationInclude,
      orderBy: { createdAt: "desc" }
    });
  }

  findById(organizationId: string, immobilizationId: string) {
    return this.prisma.immobilization.findFirst({
      where: {
        id: immobilizationId,
        organizationId
      },
      include: immobilizationDetailInclude
    });
  }

  findByCode(organizationId: string, code: string) {
    return this.prisma.immobilization.findFirst({
      where: {
        organizationId,
        code
      },
      include: immobilizationInclude
    });
  }

  create(
    db: DbClient,
    input: Prisma.ImmobilizationUncheckedCreateInput
  ) {
    return db.immobilization.create({
      data: input,
      include: immobilizationDetailInclude
    });
  }

  update(
    db: DbClient,
    immobilizationId: string,
    input: Prisma.ImmobilizationUncheckedUpdateInput
  ) {
    return db.immobilization.update({
      where: { id: immobilizationId },
      data: input,
      include: immobilizationDetailInclude
    });
  }
}
