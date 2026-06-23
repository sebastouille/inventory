import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";

type DbClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class IamUsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  private findByIdWithDb(db: DbClient, organizationId: string, userId: string) {
    return db.user.findFirst({
      where: {
        id: userId,
        organizationId
      },
      include: {
        roleAssignments: {
          include: {
            role: true,
            scope: {
              include: {
                spatialNode: true
              }
            }
          }
        }
      }
    });
  }

  listByOrganization(organizationId: string) {
    return this.prisma.user.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      include: {
        roleAssignments: {
          include: {
            role: true,
            scope: {
              include: {
                spatialNode: true
              }
            }
          }
        }
      }
    });
  }

  findById(organizationId: string, userId: string) {
    return this.findByIdWithDb(this.prisma, organizationId, userId);
  }

  findByEmail(organizationId: string, email: string) {
    return this.prisma.user.findUnique({
      where: {
        organizationId_email: {
          organizationId,
          email
        }
      }
    });
  }

  async createWithAssignments(
    db: DbClient,
    input: {
      organizationId: string;
      email: string;
      passwordHash: string;
      name?: string | null;
      isActive: boolean;
      assignedById: string;
      roleAssignments: { roleId: string; scopeId?: string | null }[];
    }
  ) {
    const user = await db.user.create({
      data: {
        organizationId: input.organizationId,
        email: input.email,
        passwordHash: input.passwordHash,
        name: input.name,
        isActive: input.isActive
      }
    });

    await db.iamUserRole.createMany({
      data: input.roleAssignments.map((assignment) => ({
        userId: user.id,
        roleId: assignment.roleId,
        scopeId: assignment.scopeId ?? null,
        assignedById: input.assignedById
      }))
    });

    return this.findByIdWithDb(db, input.organizationId, user.id);
  }

  async replaceAssignments(
    db: DbClient,
    input: {
      organizationId: string;
      userId: string;
      assignedById: string;
      roleAssignments: { roleId: string; scopeId?: string | null }[];
    }
  ) {
    await db.iamUserRole.deleteMany({
      where: { userId: input.userId }
    });

    await db.iamUserRole.createMany({
      data: input.roleAssignments.map((assignment) => ({
        userId: input.userId,
        roleId: assignment.roleId,
        scopeId: assignment.scopeId ?? null,
        assignedById: input.assignedById
      }))
    });

    return this.findByIdWithDb(db, input.organizationId, input.userId);
  }

  async updatePassword(
    db: DbClient,
    input: {
      organizationId: string;
      userId: string;
      passwordHash: string;
      mustChangePassword: boolean;
    }
  ) {
    await db.user.update({
      where: { id: input.userId },
      data: {
        passwordHash: input.passwordHash,
        mustChangePassword: input.mustChangePassword
      }
    });

    return this.findByIdWithDb(db, input.organizationId, input.userId);
  }
}
