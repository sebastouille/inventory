import { buildDefaultOrganizationSettings, type CurrentUserResponse } from "@inventory/shared";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../auth/auth.types";
import { GlobalSearchService } from "./global-search.service";

function createAuth(permissions: AuthenticatedUser["permissions"]): AuthenticatedUser {
  const baseUser: CurrentUserResponse = {
    id: "user-1",
    organization: { id: "org-1", name: "Demo Org", slug: "demo-org" },
    email: "admin@demo.local",
    name: "Admin",
    isActive: true,
    mustChangePassword: false,
    roles: [],
    permissions,
    scopeAssignments: [],
    organizationSettings: buildDefaultOrganizationSettings(),
    spatialScopePolicy: "SCOPED",
    isOrganizationWideSpatialAccess: false,
    primaryRoleLabel: "Administrateur"
  };

  return {
    ...baseUser,
    sub: "user-1",
    organizationId: "org-1"
  };
}

function createPrismaMock() {
  return {
    equipment: { findMany: vi.fn().mockResolvedValue([]) },
    inventoryCampaign: { findMany: vi.fn().mockResolvedValue([]) },
    spatialNode: { findMany: vi.fn().mockResolvedValue([]) },
    immobilization: { findMany: vi.fn().mockResolvedValue([]) },
    importJob: { findMany: vi.fn().mockResolvedValue([]) },
    importProfile: { findMany: vi.fn().mockResolvedValue([]) }
  };
}

describe("GlobalSearchService", () => {
  it("returns an empty response below the 3 character threshold", async () => {
    const prisma = createPrismaMock();
    const service = new GlobalSearchService(prisma as never);

    const result = await service.search(createAuth(["assets.read"]), "eq");

    expect(result).toEqual({
      query: "eq",
      total: 0,
      groups: []
    });
    expect(prisma.equipment.findMany).not.toHaveBeenCalled();
    expect(prisma.inventoryCampaign.findMany).not.toHaveBeenCalled();
  });

  it("filters domains from the response according to permissions", async () => {
    const prisma = createPrismaMock();
    prisma.inventoryCampaign.findMany.mockResolvedValue([
      {
        id: "campaign-1",
        name: "Campagne Alpha",
        description: "Inventaire principal",
        status: "OPEN",
        updatedAt: new Date("2026-06-22T10:00:00.000Z")
      }
    ]);

    const service = new GlobalSearchService(prisma as never);

    const result = await service.search(createAuth(["campaigns.read"]), "camp");

    expect(result.total).toBe(1);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.domain).toBe("campaigns");
    expect(result.groups[0]?.items[0]?.href).toBe("/campaigns?campaignId=campaign-1");
    expect(prisma.inventoryCampaign.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.equipment.findMany).not.toHaveBeenCalled();
    expect(prisma.spatialNode.findMany).not.toHaveBeenCalled();
    expect(prisma.immobilization.findMany).not.toHaveBeenCalled();
    expect(prisma.importJob.findMany).not.toHaveBeenCalled();
    expect(prisma.importProfile.findMany).not.toHaveBeenCalled();
  });

  it("orders stronger prefix matches before simple substring matches", async () => {
    const prisma = createPrismaMock();
    prisma.inventoryCampaign.findMany.mockResolvedValue([
      {
        id: "campaign-2",
        name: "Mon alpha secondaire",
        description: null,
        status: "DRAFT",
        updatedAt: new Date("2026-06-22T12:00:00.000Z")
      },
      {
        id: "campaign-1",
        name: "Alpha campagne",
        description: null,
        status: "OPEN",
        updatedAt: new Date("2026-06-21T12:00:00.000Z")
      }
    ]);

    const service = new GlobalSearchService(prisma as never);

    const result = await service.search(createAuth(["campaigns.read"]), "alpha");

    expect(result.groups[0]?.items.map((item) => item.id)).toEqual(["campaign-1", "campaign-2"]);
  });

  it("limits results to 5 items per group and 20 items overall", async () => {
    const prisma = createPrismaMock();
    prisma.equipment.findMany.mockResolvedValue(
      Array.from({ length: 8 }, (_, index) => ({
        id: `asset-${index + 1}`,
        internalCode: `EQ-${String(index + 1).padStart(3, "0")}`,
        numPiece: null,
        externalRef: null,
        isDeleted: false,
        updatedAt: new Date(`2026-06-22T0${index}:00:00.000Z`),
        equipmentType: { label: "Alpha poste" },
        equipmentModel: { label: `Alpha modele ${index + 1}` },
        currentSpatialNode: { label: "Alpha Site", path: "Alpha Site" },
        immobilization: null
      }))
    );
    prisma.inventoryCampaign.findMany.mockResolvedValue(
      Array.from({ length: 8 }, (_, index) => ({
        id: `campaign-${index + 1}`,
        name: `Alpha campagne ${index + 1}`,
        description: null,
        status: "OPEN",
        updatedAt: new Date(`2026-06-22T1${index}:00:00.000Z`)
      }))
    );
    prisma.spatialNode.findMany.mockResolvedValue(
      Array.from({ length: 8 }, (_, index) => ({
        id: `location-${index + 1}`,
        code: `ALPHA-${index + 1}`,
        label: `Alpha Zone ${index + 1}`,
        path: `Site/Alpha Zone ${index + 1}`,
        type: "ZONE",
        externalRef: null,
        isActive: true,
        updatedAt: new Date(`2026-06-21T1${index}:00:00.000Z`)
      }))
    );
    prisma.immobilization.findMany.mockResolvedValue(
      Array.from({ length: 8 }, (_, index) => ({
        id: `immo-${index + 1}`,
        code: `ALPHA-IMMO-${index + 1}`,
        label: `Alpha immo ${index + 1}`,
        externalRef: null,
        costCenter: null,
        status: "ACTIVE",
        isActive: true,
        updatedAt: new Date(`2026-06-20T1${index}:00:00.000Z`),
        _count: { equipments: index + 1 }
      }))
    );

    const service = new GlobalSearchService(prisma as never);

    const result = await service.search(createAuth(["assets.read", "campaigns.read", "spatial.read"]), "alpha");

    expect(result.total).toBe(20);
    expect(result.groups).toHaveLength(4);
    for (const group of result.groups) {
      expect(group.items.length).toBeLessThanOrEqual(5);
    }
  });
});
