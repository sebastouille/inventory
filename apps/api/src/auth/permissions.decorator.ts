import { SetMetadata } from "@nestjs/common";
import type { IamPermissionCode } from "@inventory/shared";

export const REQUIRED_PERMISSIONS_KEY = "required_permissions";

export const RequirePermissions = (...permissions: IamPermissionCode[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
