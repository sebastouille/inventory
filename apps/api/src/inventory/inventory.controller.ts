import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "../swagger-compat";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { RequirePermissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import { JwtGuard } from "../auth/jwt.guard";
import { InventoryService } from "./inventory.service";

@ApiTags("inventory")
@ApiBearerAuth()
@UseGuards(JwtGuard, PermissionsGuard)
@Controller("inventory")
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @RequirePermissions("inventory.overview.read")
  @Get("overview")
  overview(@CurrentAuth() auth: AuthenticatedUser) {
    return this.inventoryService.overview(auth.organizationId);
  }
}
