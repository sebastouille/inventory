import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AuthContextService } from "./auth-context.service";
import type { JwtTokenPayload, RequestWithAuth } from "./auth.types";

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authContextService: AuthContextService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const token = header.slice("Bearer ".length);
    try {
      const payload = await this.jwtService.verifyAsync<JwtTokenPayload>(token, {
        secret: process.env.JWT_SECRET ?? "dev-change-me"
      });
      if (payload.purpose && payload.purpose !== "ACCESS") {
        throw new UnauthorizedException("Invalid token");
      }
      request.user = await this.authContextService.loadFromToken(payload);
      return true;
    } catch {
      throw new UnauthorizedException("Invalid token");
    }
  }
}
