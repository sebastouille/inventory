import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "../swagger-compat";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { RequirePermissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import { JwtGuard } from "../auth/jwt.guard";
import { UsersService } from "./users.service";

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtGuard, PermissionsGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @RequirePermissions("iam.users.read")
  @Get()
  list(@CurrentAuth() auth: AuthenticatedUser) {
    return this.usersService.list(auth.organizationId);
  }
}
