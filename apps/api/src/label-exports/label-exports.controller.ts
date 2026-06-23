import { Body, Controller, Post, Res, StreamableFile, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "../swagger-compat";
import type { Response } from "express";
import type { LabelExportEquipmentQuery, LabelExportSpatialNodeQuery } from "@inventory/shared";
import { CurrentAuth } from "../auth/current-auth.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { JwtGuard } from "../auth/jwt.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { LabelExportsService } from "./label-exports.service";

@ApiTags("label-exports")
@ApiBearerAuth()
@UseGuards(JwtGuard, PermissionsGuard)
@Controller("label-exports")
export class LabelExportsController {
  constructor(private readonly labelExportsService: LabelExportsService) {}

  @RequirePermissions("labels.read")
  @Post("equipments/preview")
  previewEquipments(@CurrentAuth() auth: AuthenticatedUser, @Body() input: LabelExportEquipmentQuery) {
    return this.labelExportsService.previewEquipments(auth.organizationId, input);
  }

  @RequirePermissions("labels.export")
  @Post("equipments/export")
  async exportEquipments(
    @CurrentAuth() auth: AuthenticatedUser,
    @Body() input: LabelExportEquipmentQuery,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.labelExportsService.exportEquipments(auth.organizationId, input);
    response.setHeader("Content-Type", result.contentType);
    response.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    return new StreamableFile(result.buffer);
  }

  @RequirePermissions("labels.read")
  @Post("spatial-nodes/preview")
  previewSpatialNodes(@CurrentAuth() auth: AuthenticatedUser, @Body() input: LabelExportSpatialNodeQuery) {
    return this.labelExportsService.previewSpatialNodes(auth.organizationId, input);
  }

  @RequirePermissions("labels.export")
  @Post("spatial-nodes/export")
  async exportSpatialNodes(
    @CurrentAuth() auth: AuthenticatedUser,
    @Body() input: LabelExportSpatialNodeQuery,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.labelExportsService.exportSpatialNodes(auth.organizationId, input);
    response.setHeader("Content-Type", result.contentType);
    response.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    return new StreamableFile(result.buffer);
  }
}
