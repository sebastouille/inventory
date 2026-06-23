import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "../swagger-compat";
import type {
  CreateInventoryCorrectionInput,
  InventoryAnomalyListQuery,
  UpdateInventoryAnomalyInput
} from "@inventory/shared";
import { CurrentAuth } from "../auth/current-auth.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { JwtGuard } from "../auth/jwt.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { InventoryAnomaliesService } from "./inventory-anomalies.service";

@ApiTags("inventory-anomalies")
@ApiBearerAuth()
@UseGuards(JwtGuard, PermissionsGuard)
@Controller("inventory-anomalies")
export class InventoryAnomaliesController {
  constructor(private readonly anomaliesService: InventoryAnomaliesService) {}

  @RequirePermissions("anomalies.read")
  @Get()
  list(@CurrentAuth() auth: AuthenticatedUser, @Query() query: InventoryAnomalyListQuery) {
    return this.anomaliesService.list(auth.organizationId, query);
  }

  @RequirePermissions("anomalies.read")
  @Get(":anomalyId")
  detail(@CurrentAuth() auth: AuthenticatedUser, @Param("anomalyId") anomalyId: string) {
    return this.anomaliesService.detail(auth.organizationId, anomalyId);
  }

  @RequirePermissions("anomalies.update")
  @Patch(":anomalyId")
  update(
    @CurrentAuth() auth: AuthenticatedUser,
    @Param("anomalyId") anomalyId: string,
    @Body() input: UpdateInventoryAnomalyInput
  ) {
    return this.anomaliesService.update(auth, anomalyId, input);
  }

  @RequirePermissions("anomalies.update")
  @Post(":anomalyId/corrections")
  createCorrection(
    @CurrentAuth() auth: AuthenticatedUser,
    @Param("anomalyId") anomalyId: string,
    @Body() input: CreateInventoryCorrectionInput
  ) {
    return this.anomaliesService.createCorrection(auth, anomalyId, input);
  }

  @RequirePermissions("anomalies.update")
  @Post("corrections/:correctionId/apply")
  applyCorrection(@CurrentAuth() auth: AuthenticatedUser, @Param("correctionId") correctionId: string) {
    return this.anomaliesService.applyCorrection(auth, correctionId);
  }
}
