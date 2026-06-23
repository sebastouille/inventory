import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "../swagger-compat";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { JwtGuard } from "../auth/jwt.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import { AssetReferencesService } from "./asset-references.service";
import { CreateAttachmentRuleDto } from "./dto/create-attachment-rule.dto";
import { CreateEquipmentReferenceDto } from "./dto/create-equipment-reference.dto";
import { ListAssetReferencesDto } from "./dto/list-asset-references.dto";
import { UpdateAttachmentRuleDto } from "./dto/update-attachment-rule.dto";
import { UpdateEquipmentReferenceDto } from "./dto/update-equipment-reference.dto";

@ApiTags("asset-references")
@ApiBearerAuth()
@UseGuards(JwtGuard, PermissionsGuard)
@Controller("assets/references")
export class AssetReferencesController {
  constructor(private readonly assetReferencesService: AssetReferencesService) {}

  @RequirePermissions("asset-references.read")
  @Get(":resource")
  list(
    @CurrentAuth() auth: AuthenticatedUser,
    @Param("resource") resource: string,
    @Query() query: ListAssetReferencesDto
  ) {
    return this.assetReferencesService.list(auth.organizationId, resource, query);
  }

  @RequirePermissions("asset-references.manage")
  @Post("attachment-rules")
  createAttachmentRule(@CurrentAuth() auth: AuthenticatedUser, @Body() dto: CreateAttachmentRuleDto) {
    return this.assetReferencesService.createAttachmentRule(auth, dto);
  }

  @RequirePermissions("asset-references.manage")
  @Patch("attachment-rules/:id")
  updateAttachmentRule(
    @CurrentAuth() auth: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateAttachmentRuleDto
  ) {
    return this.assetReferencesService.updateAttachmentRule(auth, id, dto);
  }

  @RequirePermissions("asset-references.manage")
  @Post("attachment-rules/:id/archive")
  archiveAttachmentRule(@CurrentAuth() auth: AuthenticatedUser, @Param("id") id: string) {
    return this.assetReferencesService.archiveAttachmentRule(auth, id);
  }

  @RequirePermissions("asset-references.manage")
  @Post(":resource")
  create(
    @CurrentAuth() auth: AuthenticatedUser,
    @Param("resource") resource: string,
    @Body() dto: CreateEquipmentReferenceDto
  ) {
    return this.assetReferencesService.createReference(auth, resource, dto);
  }

  @RequirePermissions("asset-references.manage")
  @Patch(":resource/:id")
  update(
    @CurrentAuth() auth: AuthenticatedUser,
    @Param("resource") resource: string,
    @Param("id") id: string,
    @Body() dto: UpdateEquipmentReferenceDto
  ) {
    return this.assetReferencesService.updateReference(auth, resource, id, dto);
  }

  @RequirePermissions("asset-references.manage")
  @Post(":resource/:id/archive")
  archive(@CurrentAuth() auth: AuthenticatedUser, @Param("resource") resource: string, @Param("id") id: string) {
    return this.assetReferencesService.archiveReference(auth, resource, id);
  }
}
