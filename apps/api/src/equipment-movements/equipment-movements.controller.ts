import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "../swagger-compat";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { JwtGuard } from "../auth/jwt.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import { ListEquipmentMovementsDto } from "./dto/list-equipment-movements.dto";
import { EquipmentMovementsService } from "./equipment-movements.service";

@ApiTags("equipment-movements")
@ApiBearerAuth()
@UseGuards(JwtGuard, PermissionsGuard)
@Controller()
export class EquipmentMovementsController {
  constructor(private readonly equipmentMovementsService: EquipmentMovementsService) {}

  @RequirePermissions("assets.read")
  @Get("equipment-movements")
  list(@CurrentAuth() auth: AuthenticatedUser, @Query() query: ListEquipmentMovementsDto) {
    return this.equipmentMovementsService.list(auth.organizationId, query);
  }

  @RequirePermissions("assets.read")
  @Get("equipment-movements/:movementId")
  detail(@CurrentAuth() auth: AuthenticatedUser, @Param("movementId") movementId: string) {
    return this.equipmentMovementsService.getDetail(auth.organizationId, movementId);
  }

  @RequirePermissions("assets.read")
  @Get("assets/:assetId/movements")
  listForAsset(
    @CurrentAuth() auth: AuthenticatedUser,
    @Param("assetId") assetId: string,
    @Query() query: ListEquipmentMovementsDto
  ) {
    return this.equipmentMovementsService.listForEquipment(auth.organizationId, assetId, query);
  }
}
