import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import type {
  AuthenticatedLoginResponse,
  LoginResponse,
  PasswordChangeRequiredResponse
} from "@inventory/shared";
import { PrismaService } from "../prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuthContextService } from "./auth-context.service";
import type { AuthenticatedUser, JwtTokenPayload } from "./auth.types";
import { CompletePasswordChangeDto } from "./complete-password-change.dto";
import { LoginDto } from "./login.dto";
import { assertPasswordPolicy } from "./password-policy";
import { buildPasswordChallengeVersion, hashPassword } from "./password";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly authContextService: AuthContextService,
    private readonly auditService: AuditService
  ) {}

  private async signAccessToken(payload: JwtTokenPayload) {
    return this.jwtService.signAsync(
      {
        ...payload,
        purpose: "ACCESS"
      },
      {
        expiresIn: (process.env.JWT_EXPIRES_IN ?? "15m") as never,
        secret: process.env.JWT_SECRET ?? "dev-change-me"
      }
    );
  }

  private async signPasswordChangeToken(payload: JwtTokenPayload) {
    return this.jwtService.signAsync(
      {
        ...payload,
        purpose: "PASSWORD_CHANGE",
        passwordChallengeVersion: payload.passwordChallengeVersion
      },
      {
        expiresIn: (process.env.JWT_PASSWORD_CHANGE_EXPIRES_IN ?? "10m") as never,
        secret: process.env.JWT_SECRET ?? "dev-change-me"
      }
    );
  }

  private async buildAuthenticatedLoginResponse(payload: JwtTokenPayload): Promise<AuthenticatedLoginResponse> {
    return {
      status: "AUTHENTICATED",
      accessToken: await this.signAccessToken(payload),
      user: await this.authContextService.loadFromToken(payload)
    };
  }

  async login(dto: LoginDto): Promise<LoginResponse> {
    const organization = await this.prisma.organization.findUnique({
      where: { slug: dto.organizationSlug }
    });

    if (!organization) {
      throw new UnauthorizedException("Invalid organization");
    }

    const user = await this.prisma.user.findUnique({
      where: {
        organizationId_email: {
          organizationId: organization.id,
          email: dto.email
        }
      }
    });

    if (!user || !user.isActive || user.passwordHash !== hashPassword(dto.password)) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const payload: JwtTokenPayload = {
      sub: user.id,
      organizationId: user.organizationId,
      email: user.email
    };

    if (user.mustChangePassword) {
      const response: PasswordChangeRequiredResponse = {
        status: "PASSWORD_CHANGE_REQUIRED",
        passwordChangeToken: await this.signPasswordChangeToken({
          ...payload,
          passwordChallengeVersion: buildPasswordChallengeVersion(user.passwordHash)
        }),
        user: {
          email: user.email,
          name: user.name ?? null,
          organization: {
            slug: organization.slug,
            name: organization.name
          }
        }
      };

      return response;
    }

    return this.buildAuthenticatedLoginResponse(payload);
  }

  async completePasswordChange(dto: CompletePasswordChangeDto): Promise<AuthenticatedLoginResponse> {
    assertPasswordPolicy(dto.newPassword, "Nouveau mot de passe");

    let payload: JwtTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtTokenPayload>(dto.passwordChangeToken, {
        secret: process.env.JWT_SECRET ?? "dev-change-me"
      });
    } catch {
      throw new UnauthorizedException("Lien de changement de mot de passe invalide ou expire");
    }

    if (payload.purpose !== "PASSWORD_CHANGE" || !payload.passwordChallengeVersion) {
      throw new UnauthorizedException("Lien de changement de mot de passe invalide ou expire");
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        organizationId: payload.organizationId
      }
    });

    if (!user || !user.isActive || !user.mustChangePassword) {
      throw new UnauthorizedException("Lien de changement de mot de passe invalide ou expire");
    }

    if (buildPasswordChallengeVersion(user.passwordHash) !== payload.passwordChallengeVersion) {
      throw new UnauthorizedException("Lien de changement de mot de passe invalide ou expire");
    }

    const nextPasswordHash = hashPassword(dto.newPassword);
    if (nextPasswordHash === user.passwordHash) {
      throw new BadRequestException("Le nouveau mot de passe doit etre different du mot de passe temporaire");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: nextPasswordHash,
          mustChangePassword: false
        }
      });

      await this.auditService.log({
        db: tx as Prisma.TransactionClient,
        organizationId: user.organizationId,
        userId: user.id,
        action: "auth.password.changed",
        entityType: "User",
        entityId: user.id,
        metadata: {
          reason: "FORCED_CHANGE_AFTER_ADMIN_RESET"
        }
      });
    });

    return this.buildAuthenticatedLoginResponse({
      sub: user.id,
      organizationId: user.organizationId,
      email: user.email
    });
  }

  me(user: AuthenticatedUser) {
    return user;
  }
}
