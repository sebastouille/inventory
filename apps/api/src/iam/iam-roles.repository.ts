import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class IamRolesRepository {
  constructor(private readonly prisma: PrismaService) {}

  listRoles() {
    return this.prisma.iamRole.findMany({
      orderBy: { label: "asc" },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });
  }

  listPermissions() {
    return this.prisma.iamPermission.findMany({
      orderBy: [{ domain: "asc" }, { code: "asc" }]
    });
  }

  findByIds(ids: string[]) {
    return this.prisma.iamRole.findMany({
      where: {
        id: { in: ids }
      }
    });
  }
}
