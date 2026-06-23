import { Body, Controller, Get, Param, Patch, Post, Query, Res, StreamableFile, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "../swagger-compat";
import type { Response } from "express";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { JwtGuard } from "../auth/jwt.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import { AssetsService } from "./assets.service";
import { CreateAssetDto } from "./dto/create-asset.dto";
import { ListAssetsDto } from "./dto/list-assets.dto";
import { UpdateAssetDto } from "./dto/update-asset.dto";

@ApiTags("assets")
@ApiBearerAuth()
@UseGuards(JwtGuard, PermissionsGuard)
@Controller("assets")
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @RequirePermissions("assets.read")
  @Get()
  list(@CurrentAuth() auth: AuthenticatedUser, @Query() query: ListAssetsDto) {
    return this.assetsService.list(auth.organizationId, query);
  }

  @RequirePermissions("assets.read")
  @Get("export")
  async export(
    @CurrentAuth() auth: AuthenticatedUser,
    @Query() query: ListAssetsDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.assetsService.export(auth.organizationId, query);
    response.setHeader("Content-Type", "application/vnd.oasis.opendocument.spreadsheet");
    response.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    return new StreamableFile(result.buffer);
  }

  @RequirePermissions("assets.read")
  @Get("assignment-users")
  assignmentUsers(@CurrentAuth() auth: AuthenticatedUser) {
    return this.assetsService.listAssignableUsers(auth.organizationId);
  }

  @RequirePermissions("assets.create")
  @Post()
  create(@CurrentAuth() auth: AuthenticatedUser, @Body() dto: CreateAssetDto) {
    return this.assetsService.create(auth, dto);
  }

  @RequirePermissions("assets.read")
  @Get(":assetId")
  detail(@CurrentAuth() auth: AuthenticatedUser, @Param("assetId") assetId: string) {
    return this.assetsService.getDetail(auth.organizationId, assetId);
  }

  @RequirePermissions("assets.update")
  @Patch(":assetId")
  update(@CurrentAuth() auth: AuthenticatedUser, @Param("assetId") assetId: string, @Body() dto: UpdateAssetDto) {
    return this.assetsService.update(auth, assetId, dto);
  }

  @RequirePermissions("assets.archive")
  @Post(":assetId/archive")
  archive(@CurrentAuth() auth: AuthenticatedUser, @Param("assetId") assetId: string) {
    return this.assetsService.archive(auth, assetId);
  }

  @RequirePermissions("assets.history.read")
  @Get(":assetId/history")
  history(@CurrentAuth() auth: AuthenticatedUser, @Param("assetId") assetId: string) {
    return this.assetsService.history(auth.organizationId, assetId);
  }
}
