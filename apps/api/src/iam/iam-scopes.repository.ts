import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class IamScopesRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByOrganization(organizationId: string) {
    return this.prisma.iamAccessScope.findMany({
      where: { organizationId },
      include: {
        spatialNode: true
      },
      orderBy: [{ type: "asc" }, { label: "asc" }]
    });
  }

  findByIds(organizationId: string, ids: string[]) {
    return this.prisma.iamAccessScope.findMany({
      where: {
        organizationId,
        id: { in: ids }
      }
    });
  }
}
