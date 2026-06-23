import { Body, Controller, Get, Param, Post, Put, Query, Res, StreamableFile, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "../swagger-compat";
import type { Response } from "express";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { JwtGuard } from "../auth/jwt.guard";
import { PermissionsGuard } from "../auth/permissions.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CreateUserDto } from "./dto/create-user.dto";
import { ListIamRolesDto } from "./dto/list-iam-roles.dto";
import { ListIamUsersDto } from "./dto/list-iam-users.dto";
import { ReplaceUserRolesDto } from "./dto/replace-user-roles.dto";
import { ResetUserPasswordDto } from "./dto/reset-user-password.dto";
import { IamService } from "./iam.service";

@ApiTags("iam")
@ApiBearerAuth()
@UseGuards(JwtGuard, PermissionsGuard)
@Controller("iam")
export class IamController {
  constructor(private readonly iamService: IamService) {}

  @RequirePermissions("iam.users.read")
  @Get("users")
  listUsers(@CurrentAuth() auth: AuthenticatedUser, @Query() query: ListIamUsersDto) {
    return this.iamService.listUsers(auth.organizationId, query);
  }

  @RequirePermissions("iam.users.read")
  @Get("users/export")
  async exportUsers(
    @CurrentAuth() auth: AuthenticatedUser,
    @Query() query: ListIamUsersDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.iamService.exportUsers(auth.organizationId, query);
    response.setHeader("Content-Type", "application/vnd.oasis.opendocument.spreadsheet");
    response.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    return new StreamableFile(result.buffer);
  }

  @RequirePermissions("iam.users.create")
  @Post("users")
  createUser(@CurrentAuth() auth: AuthenticatedUser, @Body() dto: CreateUserDto) {
    return this.iamService.createUser(auth, dto);
  }

  @RequirePermissions("iam.users.read")
  @Get("users/:id")
  getUserDetail(@CurrentAuth() auth: AuthenticatedUser, @Param("id") id: string) {
    return this.iamService.getUserDetail(auth.organizationId, id);
  }

  @RequirePermissions("iam.users.update")
  @Put("users/:id/roles")
  replaceUserRoles(
    @CurrentAuth() auth: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ReplaceUserRolesDto
  ) {
    return this.iamService.replaceUserRoles(auth, id, dto);
  }

  @RequirePermissions("iam.users.update")
  @Post("users/:id/reset-password")
  resetUserPassword(
    @CurrentAuth() auth: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ResetUserPasswordDto
  ) {
    return this.iamService.resetUserPassword(auth, id, dto);
  }

  @RequirePermissions("iam.roles.read")
  @Get("roles")
  listRoles(@Query() query: ListIamRolesDto) {
    return this.iamService.listRoles(query);
  }

  @RequirePermissions("iam.roles.read")
  @Get("roles/export")
  async exportRoles(@Query() query: ListIamRolesDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.iamService.exportRoles(query);
    response.setHeader("Content-Type", "application/vnd.oasis.opendocument.spreadsheet");
    response.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    return new StreamableFile(result.buffer);
  }

  @RequirePermissions("iam.permissions.read")
  @Get("permissions")
  listPermissions() {
    return this.iamService.listPermissions();
  }

  @RequirePermissions("iam.scopes.read")
  @Get("scopes")
  listScopes(@CurrentAuth() auth: AuthenticatedUser) {
    return this.iamService.listScopes(auth.organizationId);
  }
}
