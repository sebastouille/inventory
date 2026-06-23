import type { CurrentUserResponse } from "./iam";

export type AuthLoginStatus = "AUTHENTICATED" | "PASSWORD_CHANGE_REQUIRED";

export interface PasswordChangeChallengeUserSummary {
  email: string;
  name: string | null;
  organization: {
    slug: string;
    name: string;
  };
}

export interface AuthenticatedLoginResponse {
  status: "AUTHENTICATED";
  accessToken: string;
  user: CurrentUserResponse;
}

export interface PasswordChangeRequiredResponse {
  status: "PASSWORD_CHANGE_REQUIRED";
  passwordChangeToken: string;
  user: PasswordChangeChallengeUserSummary;
}

export type LoginResponse = AuthenticatedLoginResponse | PasswordChangeRequiredResponse;

export interface CompletePasswordChangeInput {
  passwordChangeToken: string;
  newPassword: string;
}
