import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "../swagger-compat";
import type { LinkEquipmentImmobilizationInput, UnlinkEquipmentImmobilizationInput } from "@inventory/shared";
import { CurrentAuth } from "../auth/current-auth.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { JwtGuard } from "../auth/jwt.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { ReconciliationService } from "./reconciliation.service";

@ApiTags("reconciliation")
@ApiBearerAuth()
@UseGuards(JwtGuard, PermissionsGuard)
@Controller("reconciliation")
export class ReconciliationController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

  @RequirePermissions("reconciliation.read")
  @Get("equipment/:equipmentId")
  getEquipment(@CurrentAuth() auth: AuthenticatedUser, @Param("equipmentId") equipmentId: string) {
    return this.reconciliationService.getEquipment(auth.organizationId, equipmentId);
  }

  @RequirePermissions("reconciliation.manage")
  @Post("equipment/:equipmentId/link")
  link(
    @CurrentAuth() auth: AuthenticatedUser,
    @Param("equipmentId") equipmentId: string,
    @Body() input: LinkEquipmentImmobilizationInput
  ) {
    return this.reconciliationService.link(auth, equipmentId, input);
  }

  @RequirePermissions("reconciliation.manage")
  @Post("equipment/:equipmentId/unlink")
  unlink(
    @CurrentAuth() auth: AuthenticatedUser,
    @Param("equipmentId") equipmentId: string,
    @Body() input: UnlinkEquipmentImmobilizationInput
  ) {
    return this.reconciliationService.unlink(auth, equipmentId, input);
  }
}
