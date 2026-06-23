import { Body, Controller, Get, Post, Query, Res, StreamableFile, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "../swagger-compat";
import type { Response } from "express";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { RequirePermissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import { JwtGuard } from "../auth/jwt.guard";
import { ListQueryDto } from "../common/list-query.dto";
import { CreateStockMovementDto } from "./create-stock-movement.dto";
import { StockMovementsService } from "./stock-movements.service";

@ApiTags("stock-movements")
@ApiBearerAuth()
@UseGuards(JwtGuard, PermissionsGuard)
@Controller("stock-movements")
export class StockMovementsController {
  constructor(private readonly stockMovementsService: StockMovementsService) {}

  @RequirePermissions("movements.read")
  @Get()
  list(@CurrentAuth() auth: AuthenticatedUser, @Query() query: ListQueryDto) {
    return this.stockMovementsService.list(auth.organizationId, query);
  }

  @RequirePermissions("movements.read")
  @Get("export")
  async export(
    @CurrentAuth() auth: AuthenticatedUser,
    @Query() query: ListQueryDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.stockMovementsService.export(auth.organizationId, query);
    response.setHeader("Content-Type", "application/vnd.oasis.opendocument.spreadsheet");
    response.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    return new StreamableFile(result.buffer);
  }

  @RequirePermissions("movements.create")
  @Post()
  create(@CurrentAuth() auth: AuthenticatedUser, @Body() dto: CreateStockMovementDto) {
    return this.stockMovementsService.create(auth, dto);
  }
}
