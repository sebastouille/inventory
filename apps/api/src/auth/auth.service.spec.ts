import { BadRequestException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { describe, expect, it, vi } from "vitest";
import { buildDefaultOrganizationSettings } from "@inventory/shared";
import { AuthService } from "./auth.service";
import { buildPasswordChallengeVersion, hashPassword } from "./password";

describe("AuthService", () => {
  it("returns an access token and enriched user for a valid account", async () => {
    const prisma = {
      organization: {
        findUnique: vi.fn().mockResolvedValue({ id: "org-1", slug: "demo-org", name: "Demo Org" })
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "user-1",
          organizationId: "org-1",
          email: "admin@demo.local",
          passwordHash: "9a4aabf0e5cf71cae2cea646613ce7e2a5919fa758e56819704be25a3a2c1f0b",
          isActive: true,
          mustChangePassword: false
        })
      }
    };

    const jwt = {
      signAsync: vi.fn().mockResolvedValue("signed-token")
    } as unknown as JwtService;

    const authContextService = {
      loadFromToken: vi.fn().mockResolvedValue({
        id: "user-1",
        sub: "user-1",
        organizationId: "org-1",
        email: "admin@demo.local",
        name: "Inventory Admin",
        isActive: true,
        mustChangePassword: false,
        organization: { id: "org-1", name: "Demo Org", slug: "demo-org" },
        roles: [],
        permissions: [],
        scopeAssignments: [],
        organizationSettings: buildDefaultOrganizationSettings(),
        spatialScopePolicy: "SCOPED",
        isOrganizationWideSpatialAccess: false,
        primaryRoleLabel: "Administrateur"
      })
    };

    const service = new AuthService(prisma as never, jwt, authContextService as never, { log: vi.fn() } as never);

    const result = await service.login({
      organizationSlug: "demo-org",
      email: "admin@demo.local",
      password: "ChangeMe123!"
    });

    expect(result.status).toBe("AUTHENTICATED");
    if (result.status !== "AUTHENTICATED") {
      throw new Error("unexpected login response");
    }
    expect(result.accessToken).toBe("signed-token");
    expect(result.user.organization.slug).toBe("demo-org");
    expect(authContextService.loadFromToken).toHaveBeenCalledWith({
      sub: "user-1",
      organizationId: "org-1",
      email: "admin@demo.local"
    });
  });

  it("returns a password change challenge when the account requires it", async () => {
    const temporaryPasswordHash = hashPassword("ChangeMe123!");
    const prisma = {
      organization: {
        findUnique: vi.fn().mockResolvedValue({ id: "org-1", slug: "demo-org", name: "Demo Org" })
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "user-1",
          organizationId: "org-1",
          email: "admin@demo.local",
          name: "Inventory Admin",
          passwordHash: temporaryPasswordHash,
          isActive: true,
          mustChangePassword: true
        })
      }
    };

    const jwt = {
      signAsync: vi.fn().mockResolvedValue("password-change-token")
    } as unknown as JwtService;

    const service = new AuthService(
      prisma as never,
      jwt,
      { loadFromToken: vi.fn() } as never,
      { log: vi.fn() } as never
    );

    const result = await service.login({
      organizationSlug: "demo-org",
      email: "admin@demo.local",
      password: "ChangeMe123!"
    });

    expect(result).toEqual({
      status: "PASSWORD_CHANGE_REQUIRED",
      passwordChangeToken: "password-change-token",
      user: {
        email: "admin@demo.local",
        name: "Inventory Admin",
        organization: {
          slug: "demo-org",
          name: "Demo Org"
        }
      }
    });
  });

  it("completes a forced password change and returns a normal authenticated session", async () => {
    const temporaryPasswordHash = hashPassword("TempPass123!");
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue({
          id: "user-1",
          organizationId: "org-1",
          email: "admin@demo.local",
          isActive: true,
          mustChangePassword: true,
          passwordHash: temporaryPasswordHash
        }),
        update: vi.fn().mockResolvedValue(undefined)
      },
      $transaction: vi.fn(async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma))
    };

    const jwt = {
      verifyAsync: vi.fn().mockResolvedValue({
        sub: "user-1",
        organizationId: "org-1",
        email: "admin@demo.local",
        purpose: "PASSWORD_CHANGE",
        passwordChallengeVersion: buildPasswordChallengeVersion(temporaryPasswordHash)
      }),
      signAsync: vi.fn().mockResolvedValue("access-token")
    } as unknown as JwtService;

    const authContextService = {
      loadFromToken: vi.fn().mockResolvedValue({
        id: "user-1",
        sub: "user-1",
        organizationId: "org-1",
        email: "admin@demo.local",
        name: "Inventory Admin",
        isActive: true,
        mustChangePassword: false,
        organization: { id: "org-1", name: "Demo Org", slug: "demo-org" },
        roles: [],
        permissions: [],
        scopeAssignments: [],
        organizationSettings: buildDefaultOrganizationSettings(),
        spatialScopePolicy: "SCOPED",
        isOrganizationWideSpatialAccess: false,
        primaryRoleLabel: "Administrateur"
      })
    };

    const auditService = { log: vi.fn().mockResolvedValue(undefined) };

    const service = new AuthService(prisma as never, jwt, authContextService as never, auditService as never);

    const result = await service.completePasswordChange({
      passwordChangeToken: "challenge-token",
      newPassword: "FreshPass123!"
    });

    expect(result.status).toBe("AUTHENTICATED");
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({
          mustChangePassword: false,
          passwordHash: hashPassword("FreshPass123!")
        })
      })
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.password.changed",
        entityId: "user-1"
      })
    );
  });

  it("rejects a forced password change when the new password equals the temporary one", async () => {
    const temporaryPasswordHash = hashPassword("TempPass123!");
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue({
          id: "user-1",
          organizationId: "org-1",
          email: "admin@demo.local",
          isActive: true,
          mustChangePassword: true,
          passwordHash: temporaryPasswordHash
        })
      }
    };

    const jwt = {
      verifyAsync: vi.fn().mockResolvedValue({
        sub: "user-1",
        organizationId: "org-1",
        email: "admin@demo.local",
        purpose: "PASSWORD_CHANGE",
        passwordChallengeVersion: buildPasswordChallengeVersion(temporaryPasswordHash)
      })
    } as unknown as JwtService;

    const service = new AuthService(
      prisma as never,
      jwt,
      { loadFromToken: vi.fn() } as never,
      { log: vi.fn() } as never
    );

    await expect(
      service.completePasswordChange({
        passwordChangeToken: "challenge-token",
        newPassword: "TempPass123!"
      })
    ).rejects.toThrow(BadRequestException);
  });
});
