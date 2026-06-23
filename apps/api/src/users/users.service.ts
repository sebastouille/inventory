import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string) {
    const users = await this.prisma.user.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      include: {
        roleAssignments: {
          include: {
            role: true
          }
        }
      }
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      createdAt: user.createdAt,
      roles: Array.from(
        new Map(
          user.roleAssignments.map((assignment) => [
            assignment.role.id,
            {
              id: assignment.role.id,
              code: assignment.role.code,
              label: assignment.role.label
            }
          ])
        ).values()
      )
    }));
  }
}
