import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  IamRoleDetail,
  IamPermissionSummary,
  IamRoleAssignmentSummary,
  IamRoleSummary,
  IamScopeSummary,
  IamUserDetail,
  IamUserListItem,
  ResetUserPasswordInput
} from "@inventory/shared";
import { PrismaService } from "../prisma.service";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { assertPasswordPolicy } from "../auth/password-policy";
import { hashPassword } from "../auth/password";
import { buildOdsExport } from "../common/ods-export";
import { matchesSearchTerm, normalizeSearchTerm, paginateItems, sortItems } from "../common/listing";
import { CreateUserDto, UserRoleAssignmentDto } from "./dto/create-user.dto";
import { ListIamRolesDto } from "./dto/list-iam-roles.dto";
import { ListIamUsersDto } from "./dto/list-iam-users.dto";
import { ReplaceUserRolesDto } from "./dto/replace-user-roles.dto";
import { ResetUserPasswordDto } from "./dto/reset-user-password.dto";
import { IamRolesRepository } from "./iam-roles.repository";
import { IamScopesRepository } from "./iam-scopes.repository";
import { IamUsersRepository } from "./iam-users.repository";

type UserWithAssignments = Awaited<ReturnType<IamUsersRepository["findById"]>>;

@Injectable()
export class IamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly usersRepository: IamUsersRepository,
    private readonly rolesRepository: IamRolesRepository,
    private readonly scopesRepository: IamScopesRepository
  ) {}

  private dedupeAssignments(assignments: UserRoleAssignmentDto[]) {
    const seen = new Set<string>();
    for (const assignment of assignments) {
      const key = `${assignment.roleId}:${assignment.scopeId ?? "global"}`;
      if (seen.has(key)) {
        throw new BadRequestException("Role duplique sur le meme perimetre");
      }
      seen.add(key);
    }
  }

  private async validateAssignments(
    organizationId: string,
    assignments: UserRoleAssignmentDto[]
  ) {
    this.dedupeAssignments(assignments);

    const uniqueRoleIds = Array.from(new Set(assignments.map((assignment) => assignment.roleId)));
    const roles = await this.rolesRepository.findByIds(uniqueRoleIds);
    if (roles.length !== uniqueRoleIds.length) {
      throw new BadRequestException("Role inconnu dans les habilitations");
    }

    const scopeIds = Array.from(
      new Set(
        assignments
          .map((assignment) => assignment.scopeId ?? null)
          .filter((scopeId): scopeId is string => Boolean(scopeId))
      )
    );

    if (scopeIds.length > 0) {
      const scopes = await this.scopesRepository.findByIds(organizationId, scopeIds);
      if (scopes.length !== scopeIds.length) {
        throw new BadRequestException("Perimetre inconnu dans les habilitations");
      }
    }
  }

  private mapRoles(user: NonNullable<UserWithAssignments>): IamRoleSummary[] {
    const roles = new Map<string, IamRoleSummary>();
    for (const assignment of user.roleAssignments) {
      roles.set(assignment.role.id, {
        id: assignment.role.id,
        code: assignment.role.code as IamRoleSummary["code"],
        label: assignment.role.label,
        description: assignment.role.description,
        isSystem: assignment.role.isSystem
      });
    }
    return Array.from(roles.values()).sort((left, right) => left.label.localeCompare(right.label));
  }

  private mapScopeAssignments(user: NonNullable<UserWithAssignments>): IamRoleAssignmentSummary[] {
    return user.roleAssignments
      .map((assignment) => ({
        id: assignment.id,
        roleId: assignment.role.id,
        roleCode: assignment.role.code as IamRoleAssignmentSummary["roleCode"],
        roleLabel: assignment.role.label,
        scopeId: assignment.scope?.id ?? null,
        scopeLabel: assignment.scope?.label ?? null,
        scopeType: assignment.scope?.type ?? null,
        scopePath: assignment.scope?.spatialNode?.path ?? null,
        scopeSpatialNodeId: assignment.scope?.spatialNodeId ?? null
      }))
      .sort((left, right) => `${left.roleLabel}:${left.scopeLabel ?? ""}`.localeCompare(`${right.roleLabel}:${right.scopeLabel ?? ""}`));
  }

  private mapUserListItem(user: NonNullable<UserWithAssignments>): IamUserListItem {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt.toISOString(),
      roles: this.mapRoles(user)
    };
  }

  private mapUserDetail(user: NonNullable<UserWithAssignments>): IamUserDetail {
    return {
      ...this.mapUserListItem(user),
      scopeAssignments: this.mapScopeAssignments(user)
    };
  }

  private async getUserListItems(organizationId: string, query: ListIamUsersDto) {
    const users = await this.usersRepository.listByOrganization(organizationId);
    const search = normalizeSearchTerm(query.q);
    const filtered = users
      .filter((user) => {
        if (query.isActive && String(user.isActive) !== query.isActive) {
          return false;
        }
        if (query.roleId && !user.roleAssignments.some((assignment) => assignment.roleId === query.roleId)) {
          return false;
        }
        return matchesSearchTerm(search, [user.name, user.email]);
      })
      .map((user) => this.mapUserListItem(user));

    return sortItems(
      filtered,
      {
        email: (item: IamUserListItem) => item.email,
        createdAt: (item: IamUserListItem) => item.createdAt,
        name: (item: IamUserListItem) => item.name ?? ""
      }[query.sort ?? "createdAt"],
      query.direction ?? "asc"
    );
  }

  async listUsers(organizationId: string, query: ListIamUsersDto) {
    const items = await this.getUserListItems(organizationId, query);
    return paginateItems(items, query.page, query.pageSize);
  }

  async exportUsers(organizationId: string, query: ListIamUsersDto) {
    const items = await this.getUserListItems(organizationId, query);
    const buffer = buildOdsExport(
      "Utilisateurs",
      items.map((item) => ({
        Nom: item.name ?? "",
        Email: item.email,
        Actif: item.isActive ? "Oui" : "Non",
        Roles: item.roles.map((role) => role.label).join(", "),
        CreeLe: item.createdAt
      }))
    );

    return {
      buffer,
      filename: "utilisateurs.ods"
    };
  }

  async createUser(auth: AuthenticatedUser, dto: CreateUserDto) {
    assertPasswordPolicy(dto.password, "Mot de passe initial");
    await this.validateAssignments(auth.organizationId, dto.roleAssignments);
    const existingUser = await this.usersRepository.findByEmail(auth.organizationId, dto.email);
    if (existingUser) {
      throw new ConflictException("Email already in use");
    }

    const createdUser = await this.prisma.$transaction(async (tx) => {
      const user = await this.usersRepository.createWithAssignments(tx, {
        organizationId: auth.organizationId,
        email: dto.email,
        passwordHash: hashPassword(dto.password),
        name: dto.name ?? null,
        isActive: dto.isActive ?? true,
        assignedById: auth.sub,
        roleAssignments: dto.roleAssignments
      });

      await this.auditService.log({
        db: tx,
        organizationId: auth.organizationId,
        userId: auth.sub,
        action: "iam.user.created",
        entityType: "User",
        entityId: user?.id,
        metadata: {
          email: dto.email,
          roleAssignments: dto.roleAssignments as unknown as Prisma.InputJsonValue
        }
      });

      return user;
    });

    if (!createdUser) {
      throw new NotFoundException("Created user not found");
    }

    return this.mapUserDetail(createdUser);
  }

  async getUserDetail(organizationId: string, userId: string) {
    const user = await this.usersRepository.findById(organizationId, userId);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return this.mapUserDetail(user);
  }

  async replaceUserRoles(auth: AuthenticatedUser, userId: string, dto: ReplaceUserRolesDto) {
    await this.validateAssignments(auth.organizationId, dto.roleAssignments);
    const current = await this.usersRepository.findById(auth.organizationId, userId);
    if (!current) {
      throw new NotFoundException("User not found");
    }

    const before = this.mapScopeAssignments(current);
    const updated = await this.prisma.$transaction(async (tx) => {
      const nextUser = await this.usersRepository.replaceAssignments(tx, {
        organizationId: auth.organizationId,
        userId,
        assignedById: auth.sub,
        roleAssignments: dto.roleAssignments
      });

      await this.auditService.log({
        db: tx,
        organizationId: auth.organizationId,
        userId: auth.sub,
        action: "iam.user.roles.updated",
        entityType: "User",
        entityId: userId,
        metadata: {
          before: before as unknown as Prisma.InputJsonValue,
          after: dto.roleAssignments as unknown as Prisma.InputJsonValue
        }
      });

      return nextUser;
    });

    if (!updated) {
      throw new NotFoundException("Updated user not found");
    }

    return this.mapUserDetail(updated);
  }

  async resetUserPassword(auth: AuthenticatedUser, userId: string, dto: ResetUserPasswordDto | ResetUserPasswordInput) {
    assertPasswordPolicy(dto.temporaryPassword, "Mot de passe temporaire");

    const current = await this.usersRepository.findById(auth.organizationId, userId);
    if (!current) {
      throw new NotFoundException("User not found");
    }

    const nextPasswordHash = hashPassword(dto.temporaryPassword);
    if (nextPasswordHash === current.passwordHash) {
      throw new BadRequestException("Le mot de passe temporaire doit etre different du mot de passe actuel");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextUser = await this.usersRepository.updatePassword(tx, {
        organizationId: auth.organizationId,
        userId,
        passwordHash: nextPasswordHash,
        mustChangePassword: true
      });

      await this.auditService.log({
        db: tx,
        organizationId: auth.organizationId,
        userId: auth.sub,
        action: "iam.user.password.reset",
        entityType: "User",
        entityId: userId,
        metadata: {
          targetEmail: current.email
        }
      });

      return nextUser;
    });

    if (!updated) {
      throw new NotFoundException("Updated user not found");
    }

    return this.mapUserDetail(updated);
  }

  private async getRoleListItems(query: ListIamRolesDto): Promise<IamRoleDetail[]> {
    const roles = await this.rolesRepository.listRoles();
    const mapped = roles.map((role) => ({
      id: role.id,
      code: role.code as IamRoleDetail["code"],
      label: role.label,
      description: role.description,
      isSystem: role.isSystem,
      permissions: role.permissions
        .map((item) => ({
          id: item.permission.id,
          code: item.permission.code as IamPermissionSummary["code"],
          label: item.permission.label,
          description: item.permission.description,
          domain: item.permission.domain
        }))
        .sort((left, right) => left.code.localeCompare(right.code))
    }));

    const search = normalizeSearchTerm(query.q);
    const filtered = mapped.filter((role) => matchesSearchTerm(search, [role.label, role.code]));

    return sortItems(
      filtered,
      {
        code: (item: IamRoleDetail) => item.code,
        label: (item: IamRoleDetail) => item.label
      }[query.sort ?? "label"],
      query.direction ?? "asc"
    );
  }

  async listRoles(query: ListIamRolesDto) {
    const items = await this.getRoleListItems(query);
    return paginateItems(items, query.page, query.pageSize);
  }

  async exportRoles(query: ListIamRolesDto) {
    const items = await this.getRoleListItems(query);
    const buffer = buildOdsExport(
      "Roles",
      items.map((item) => ({
        Code: item.code,
        Libelle: item.label,
        Description: item.description,
        Permissions: item.permissions.map((permission) => permission.code).join(", ")
      }))
    );

    return {
      buffer,
      filename: "roles.ods"
    };
  }

  async listPermissions(): Promise<IamPermissionSummary[]> {
    const permissions = await this.rolesRepository.listPermissions();
    return permissions.map((permission) => ({
      id: permission.id,
      code: permission.code as IamPermissionSummary["code"],
      label: permission.label,
      description: permission.description,
      domain: permission.domain
    }));
  }

  async listScopes(organizationId: string): Promise<IamScopeSummary[]> {
    const scopes = await this.scopesRepository.listByOrganization(organizationId);
    return scopes.map((scope) => ({
      id: scope.id,
      type: scope.type,
      code: scope.code,
      label: scope.label,
      parentScopeId: scope.parentScopeId,
      path: scope.spatialNode?.path ?? null,
      spatialNodeId: scope.spatialNodeId ?? null,
      externalRef: scope.externalRef,
      isActive: scope.isActive
    }));
  }
}
