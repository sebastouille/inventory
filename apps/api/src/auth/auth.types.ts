import type { CurrentUserResponse, IamPermissionCode } from "@inventory/shared";
import type { Request } from "express";

export type JwtTokenPurpose = "ACCESS" | "PASSWORD_CHANGE";

export interface JwtTokenPayload {
  sub: string;
  organizationId: string;
  email: string;
  purpose?: JwtTokenPurpose;
  passwordChallengeVersion?: string;
}

export interface AuthenticatedUser extends CurrentUserResponse {
  sub: string;
  organizationId: string;
  permissions: IamPermissionCode[];
}

export interface RequestWithAuth extends Request {
  user?: AuthenticatedUser;
}
