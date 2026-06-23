import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthenticatedUser, RequestWithAuth } from "./auth.types";

export const CurrentAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<RequestWithAuth>();
    if (!request.user) {
      throw new Error("Authenticated user not found on request");
    }
    return request.user;
  }
);
