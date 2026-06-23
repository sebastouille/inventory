import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { buildDefaultOrganizationSettings } from "@inventory/shared";
import { IamService } from "./iam.service";

describe("IamService", () => {
  it("rejects user creation when the password does not satisfy the policy", async () => {
    const service = new IamService(
      { $transaction: vi.fn() } as never,
      { log: vi.fn() } as never,
      { findByEmail: vi.fn().mockResolvedValue(null) } as never,
      { findByIds: vi.fn().mockResolvedValue([{ id: "role-1" }]), listRoles: vi.fn(), listPermissions: vi.fn() } as never,
      { findByIds: vi.fn().mockResolvedValue([]), listByOrganization: vi.fn() } as never
    );

    await expect(
      service.createUser(
        {
          id: "admin-1",
          sub: "admin-1",
          organizationId: "org-1",
          email: "admin@demo.local",
          name: "Admin",
          isActive: true,
          mustChangePassword: false,
          organization: { id: "org-1", name: "Demo Org", slug: "demo-org" },
          roles: [],
          permissions: ["iam.users.create"],
          scopeAssignments: [],
          organizationSettings: buildDefaultOrganizationSettings(),
          spatialScopePolicy: "SCOPED",
          isOrganizationWideSpatialAccess: false,
          primaryRoleLabel: "Administrateur"
        },
        {
          email: "agent@demo.local",
          password: "abc",
          roleAssignments: [{ roleId: "role-1" }]
        }
      )
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects user creation when a role does not exist", async () => {
    const service = new IamService(
      { $transaction: vi.fn() } as never,
      { log: vi.fn() } as never,
      { findByEmail: vi.fn().mockResolvedValue(null) } as never,
      { findByIds: vi.fn().mockResolvedValue([]), listRoles: vi.fn(), listPermissions: vi.fn() } as never,
      { findByIds: vi.fn().mockResolvedValue([]), listByOrganization: vi.fn() } as never
    );

    await expect(
      service.createUser(
        {
          id: "admin-1",
          sub: "admin-1",
          organizationId: "org-1",
          email: "admin@demo.local",
          name: "Admin",
          isActive: true,
          mustChangePassword: false,
          organization: { id: "org-1", name: "Demo Org", slug: "demo-org" },
          roles: [],
          permissions: ["iam.users.create"],
          scopeAssignments: [],
          organizationSettings: buildDefaultOrganizationSettings(),
          spatialScopePolicy: "SCOPED",
          isOrganizationWideSpatialAccess: false,
          primaryRoleLabel: "Administrateur"
        },
        {
          email: "agent@demo.local",
          password: "ChangeMe123!",
          roleAssignments: [{ roleId: "missing-role" }]
        }
      )
    ).rejects.toThrow(BadRequestException);
  });

  it("audits role replacement", async () => {
    const auditService = { log: vi.fn().mockResolvedValue(undefined) };
    const usersRepository = {
      findById: vi
        .fn()
        .mockResolvedValueOnce({
          id: "user-1",
          email: "agent@demo.local",
          name: "Agent",
          isActive: true,
          createdAt: new Date("2026-06-11T09:00:00.000Z"),
          roleAssignments: [
            {
              id: "assignment-1",
              role: {
                id: "role-1",
                code: "INVENTORY_AGENT",
                label: "Agent inventaire",
                description: "",
                isSystem: true
              },
              scope: null
            }
          ]
        })
        .mockResolvedValueOnce({
          id: "user-1",
          email: "agent@demo.local",
          name: "Agent",
          isActive: true,
          createdAt: new Date("2026-06-11T09:00:00.000Z"),
          roleAssignments: [
            {
              id: "assignment-2",
              role: {
                id: "role-2",
                code: "CAMPAIGN_SUPERVISOR",
                label: "Superviseur campagne",
                description: "",
                isSystem: true
              },
              scope: null
            }
          ]
        }),
      replaceAssignments: vi.fn().mockResolvedValue({
        id: "user-1",
        email: "agent@demo.local",
        name: "Agent",
        isActive: true,
        createdAt: new Date("2026-06-11T09:00:00.000Z"),
        roleAssignments: [
          {
            id: "assignment-2",
            role: {
              id: "role-2",
              code: "CAMPAIGN_SUPERVISOR",
              label: "Superviseur campagne",
              description: "",
              isSystem: true
            },
            scope: null
          }
        ]
      })
    };

    const prisma = {
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({}))
    };

    const service = new IamService(
      prisma as never,
      auditService as never,
      usersRepository as never,
      {
        findByIds: vi.fn().mockResolvedValue([
          { id: "role-2", code: "CAMPAIGN_SUPERVISOR", label: "Superviseur campagne" }
        ]),
        listRoles: vi.fn(),
        listPermissions: vi.fn()
      } as never,
      {
        findByIds: vi.fn().mockResolvedValue([]),
        listByOrganization: vi.fn()
      } as never
    );

    const result = await service.replaceUserRoles(
      {
        id: "admin-1",
        sub: "admin-1",
        organizationId: "org-1",
        email: "admin@demo.local",
        name: "Admin",
        isActive: true,
        mustChangePassword: false,
        organization: { id: "org-1", name: "Demo Org", slug: "demo-org" },
        roles: [],
        permissions: ["iam.users.update"],
        scopeAssignments: [],
        organizationSettings: buildDefaultOrganizationSettings(),
        spatialScopePolicy: "SCOPED",
        isOrganizationWideSpatialAccess: false,
        primaryRoleLabel: "Administrateur"
      },
      "user-1",
      {
        roleAssignments: [{ roleId: "role-2" }]
      }
    );

    expect(result.roles[0]?.label).toBe("Superviseur campagne");
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "iam.user.roles.updated",
        entityId: "user-1"
      })
    );
  });

  it("resets a user password and marks it for forced change", async () => {
    const auditService = { log: vi.fn().mockResolvedValue(undefined) };
    const usersRepository = {
      findById: vi
        .fn()
        .mockResolvedValueOnce({
          id: "user-1",
          organizationId: "org-1",
          email: "agent@demo.local",
          name: "Agent",
          isActive: true,
          mustChangePassword: false,
          passwordHash: "old-hash",
          createdAt: new Date("2026-06-11T09:00:00.000Z"),
          roleAssignments: []
        })
        .mockResolvedValueOnce({
          id: "user-1",
          organizationId: "org-1",
          email: "agent@demo.local",
          name: "Agent",
          isActive: true,
          mustChangePassword: true,
          passwordHash: "new-hash",
          createdAt: new Date("2026-06-11T09:00:00.000Z"),
          roleAssignments: []
        }),
      updatePassword: vi.fn().mockResolvedValue({
        id: "user-1",
        organizationId: "org-1",
        email: "agent@demo.local",
        name: "Agent",
        isActive: true,
        mustChangePassword: true,
        passwordHash: "new-hash",
        createdAt: new Date("2026-06-11T09:00:00.000Z"),
        roleAssignments: []
      })
    };

    const prisma = {
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({}))
    };

    const service = new IamService(
      prisma as never,
      auditService as never,
      usersRepository as never,
      { findByIds: vi.fn(), listRoles: vi.fn(), listPermissions: vi.fn() } as never,
      { findByIds: vi.fn(), listByOrganization: vi.fn() } as never
    );

    const result = await service.resetUserPassword(
      {
        id: "admin-1",
        sub: "admin-1",
        organizationId: "org-1",
        email: "admin@demo.local",
        name: "Admin",
        isActive: true,
        mustChangePassword: false,
        organization: { id: "org-1", name: "Demo Org", slug: "demo-org" },
        roles: [],
        permissions: ["iam.users.update"],
        scopeAssignments: [],
        organizationSettings: buildDefaultOrganizationSettings(),
        spatialScopePolicy: "SCOPED",
        isOrganizationWideSpatialAccess: false,
        primaryRoleLabel: "Administrateur"
      },
      "user-1",
      {
        temporaryPassword: "TempPass123!"
      }
    );

    expect(result.mustChangePassword).toBe(true);
    expect(usersRepository.updatePassword).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        organizationId: "org-1",
        userId: "user-1",
        mustChangePassword: true
      })
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "iam.user.password.reset",
        entityId: "user-1"
      })
    );
  });
});
