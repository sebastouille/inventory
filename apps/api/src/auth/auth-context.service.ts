import { Injectable, UnauthorizedException } from "@nestjs/common";
import {
  type IamPermissionCode,
  type IamRoleAssignmentSummary,
  type IamRoleSummary
} from "@inventory/shared";
import { PrismaService } from "../prisma.service";
import type { AuthenticatedUser, JwtTokenPayload } from "./auth.types";
import { normalizeOrganizationSettings, resolveSpatialScopePolicy } from "../organizations/organization-settings";

@Injectable()
export class AuthContextService {
  constructor(private readonly prisma: PrismaService) {}

  async loadFromToken(payload: JwtTokenPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        organizationId: payload.organizationId
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            settings: true
          }
        },
        roleAssignments: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                }
              }
            },
            scope: {
              include: {
                spatialNode: true
              }
            }
          }
        }
      }
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException("User not found");
    }

    const roleMap = new Map<string, IamRoleSummary>();
    const permissions = new Set<IamPermissionCode>();
    const scopeAssignments: IamRoleAssignmentSummary[] = [];

    for (const assignment of user.roleAssignments) {
      roleMap.set(assignment.role.id, {
        id: assignment.role.id,
        code: assignment.role.code as IamRoleSummary["code"],
        label: assignment.role.label,
        description: assignment.role.description,
        isSystem: assignment.role.isSystem
      });

      for (const rolePermission of assignment.role.permissions) {
        permissions.add(rolePermission.permission.code as IamPermissionCode);
      }

      scopeAssignments.push({
        id: assignment.id,
        roleId: assignment.role.id,
        roleCode: assignment.role.code as IamRoleAssignmentSummary["roleCode"],
        roleLabel: assignment.role.label,
        scopeId: assignment.scope?.id ?? null,
        scopeLabel: assignment.scope?.label ?? null,
        scopeType: assignment.scope?.type ?? null,
        scopePath: assignment.scope?.spatialNode?.path ?? null,
        scopeSpatialNodeId: assignment.scope?.spatialNodeId ?? null
      });
    }

    const roles = Array.from(roleMap.values()).sort((left, right) => left.label.localeCompare(right.label));
    const organizationSettings = normalizeOrganizationSettings(user.organization.settings);
    const spatialScopePolicy = resolveSpatialScopePolicy(organizationSettings.iam);

    return {
      id: user.id,
      sub: user.id,
      organizationId: user.organizationId,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      organization: {
        id: user.organization.id,
        name: user.organization.name,
        slug: user.organization.slug
      },
      roles,
      permissions: Array.from(permissions).sort(),
      scopeAssignments,
      organizationSettings,
      spatialScopePolicy,
      isOrganizationWideSpatialAccess: spatialScopePolicy === "ORGANIZATION_WIDE",
      primaryRoleLabel: roles[0]?.label ?? null
    };
  }
}
