import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "../swagger-compat";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { RequirePermissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import { JwtGuard } from "../auth/jwt.guard";
import { DashboardService } from "./dashboard.service";

@ApiTags("dashboard")
@ApiBearerAuth()
@UseGuards(JwtGuard, PermissionsGuard)
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @RequirePermissions("inventory.overview.read")
  @Get("overview")
  overview(@CurrentAuth() auth: AuthenticatedUser) {
    return this.dashboardService.overview(auth.organizationId);
  }
}
