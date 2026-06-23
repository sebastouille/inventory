import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "../swagger-compat";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { JwtGuard } from "../auth/jwt.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CreateImmobilizationDto } from "./dto/create-immobilization.dto";
import { ListImmobilizationsDto } from "./dto/list-immobilizations.dto";
import { UpdateImmobilizationDto } from "./dto/update-immobilization.dto";
import { ImmobilizationsService } from "./immobilizations.service";

@ApiTags("immobilizations")
@ApiBearerAuth()
@UseGuards(JwtGuard, PermissionsGuard)
@Controller("immobilizations")
export class ImmobilizationsController {
  constructor(private readonly immobilizationsService: ImmobilizationsService) {}

  @RequirePermissions("assets.read")
  @Get()
  list(@CurrentAuth() auth: AuthenticatedUser, @Query() query: ListImmobilizationsDto) {
    return this.immobilizationsService.list(auth.organizationId, query);
  }

  @RequirePermissions("assets.read")
  @Get(":immobilizationId")
  detail(@CurrentAuth() auth: AuthenticatedUser, @Param("immobilizationId") immobilizationId: string) {
    return this.immobilizationsService.getDetail(auth.organizationId, immobilizationId);
  }

  @RequirePermissions("assets.update")
  @Post()
  create(@CurrentAuth() auth: AuthenticatedUser, @Body() dto: CreateImmobilizationDto) {
    return this.immobilizationsService.create(auth, dto);
  }

  @RequirePermissions("assets.update")
  @Patch(":immobilizationId")
  update(
    @CurrentAuth() auth: AuthenticatedUser,
    @Param("immobilizationId") immobilizationId: string,
    @Body() dto: UpdateImmobilizationDto
  ) {
    return this.immobilizationsService.update(auth, immobilizationId, dto);
  }

  @RequirePermissions("assets.update")
  @Post(":immobilizationId/archive")
  archive(@CurrentAuth() auth: AuthenticatedUser, @Param("immobilizationId") immobilizationId: string) {
    return this.immobilizationsService.archive(auth, immobilizationId);
  }
}
