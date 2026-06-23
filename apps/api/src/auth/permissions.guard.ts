import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { IamPermissionCode } from "@inventory/shared";
import type { RequestWithAuth } from "./auth.types";
import { REQUIRED_PERMISSIONS_KEY } from "./permissions.decorator";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<IamPermissionCode[]>(REQUIRED_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException("Missing authenticated user");
    }

    const permissions = new Set(user.permissions);
    const isAllowed = required.every((permission) => permissions.has(permission));
    if (!isAllowed) {
      throw new ForbiddenException("Insufficient permissions");
    }

    return true;
  }
}
