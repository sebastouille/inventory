import { describe, expect, it, vi } from "vitest";
import { AuthContextService } from "./auth-context.service";

describe("AuthContextService", () => {
  it("exposes organization wide spatial access from organization settings", async () => {
    const service = new AuthContextService({
      user: {
        findFirst: vi.fn().mockResolvedValue({
          id: "user-1",
          organizationId: "org-1",
          email: "admin@demo.local",
          name: "Admin",
          isActive: true,
          mustChangePassword: false,
          organization: {
            id: "org-1",
            name: "Demo Org",
            slug: "demo-org",
            settings: {
              iam: {
                spatialScopePolicy: "ORGANIZATION_WIDE"
              }
            }
          },
          roleAssignments: []
        })
      }
    } as never);

    const result = await service.loadFromToken({
      sub: "user-1",
      organizationId: "org-1",
      email: "admin@demo.local"
    });

    expect(result.spatialScopePolicy).toBe("ORGANIZATION_WIDE");
    expect(result.isOrganizationWideSpatialAccess).toBe(true);
    expect(result.organizationSettings.iam.spatialScopePolicy).toBe("ORGANIZATION_WIDE");
  });
});
