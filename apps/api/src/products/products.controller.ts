import { Controller, Get, Query, Res, StreamableFile, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "../swagger-compat";
import type { Response } from "express";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { RequirePermissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import { JwtGuard } from "../auth/jwt.guard";
import { ListQueryDto } from "../common/list-query.dto";
import { ProductsService } from "./products.service";

@ApiTags("products")
@ApiBearerAuth()
@UseGuards(JwtGuard, PermissionsGuard)
@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @RequirePermissions("products.read")
  @Get()
  list(@CurrentAuth() auth: AuthenticatedUser, @Query() query: ListQueryDto) {
    return this.productsService.list(auth.organizationId, query);
  }

  @RequirePermissions("products.read")
  @Get("export")
  async export(
    @CurrentAuth() auth: AuthenticatedUser,
    @Query() query: ListQueryDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.productsService.export(auth.organizationId, query);
    response.setHeader("Content-Type", "application/vnd.oasis.opendocument.spreadsheet");
    response.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    return new StreamableFile(result.buffer);
  }
}
