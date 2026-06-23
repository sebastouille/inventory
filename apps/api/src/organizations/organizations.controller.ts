import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "../swagger-compat";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { RequirePermissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import { JwtGuard } from "../auth/jwt.guard";
import { UpdateOrganizationSettingsDto } from "./dto/update-organization-settings.dto";
import { UpdateSpatialDisplayDto } from "./dto/update-spatial-display.dto";
import { OrganizationsService } from "./organizations.service";

@ApiTags("organizations")
@ApiBearerAuth()
@UseGuards(JwtGuard, PermissionsGuard)
@Controller("organizations")
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @RequirePermissions("organizations.read")
  @Get("current")
  current(@CurrentAuth() auth: AuthenticatedUser) {
    return this.organizationsService.current(auth.organizationId);
  }

  @RequirePermissions("organizations.update")
  @Patch("current/settings")
  updateSettings(@CurrentAuth() auth: AuthenticatedUser, @Body() dto: UpdateOrganizationSettingsDto) {
    return this.organizationsService.updateSettings(auth, dto);
  }

  @RequirePermissions("organizations.update")
  @Patch("current/spatial-display")
  updateSpatialDisplay(@CurrentAuth() auth: AuthenticatedUser, @Body() dto: UpdateSpatialDisplayDto) {
    return this.organizationsService.updateSpatialDisplay(auth, dto);
  }
}
