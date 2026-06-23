import { Controller, Get, Query, Res, StreamableFile, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "../swagger-compat";
import type { Response } from "express";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { RequirePermissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import { JwtGuard } from "../auth/jwt.guard";
import { ListQueryDto } from "../common/list-query.dto";
import { SuppliersService } from "./suppliers.service";

@ApiTags("suppliers")
@ApiBearerAuth()
@UseGuards(JwtGuard, PermissionsGuard)
@Controller("suppliers")
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @RequirePermissions("suppliers.read")
  @Get()
  list(@CurrentAuth() auth: AuthenticatedUser, @Query() query: ListQueryDto) {
    return this.suppliersService.list(auth.organizationId, query);
  }

  @RequirePermissions("suppliers.read")
  @Get("export")
  async export(
    @CurrentAuth() auth: AuthenticatedUser,
    @Query() query: ListQueryDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.suppliersService.export(auth.organizationId, query);
    response.setHeader("Content-Type", "application/vnd.oasis.opendocument.spreadsheet");
    response.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    return new StreamableFile(result.buffer);
  }
}
