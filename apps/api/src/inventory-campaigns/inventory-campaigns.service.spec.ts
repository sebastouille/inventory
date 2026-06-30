import { InventoryAnomalyType, InventoryCampaignStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { InventoryCampaignsService } from "./inventory-campaigns.service";

function createCampaign() {
  return {
    id: "campaign-1",
    organizationId: "org-1",
    name: "Campagne test",
    description: null,
    status: InventoryCampaignStatus.OPEN,
    plannedStartAt: null,
    plannedEndAt: null,
    openedAt: new Date(),
    reviewStartedAt: null,
    closedAt: null,
    archivedAt: null,
    createdById: "user-1",
    responsibleUserId: null,
    expectedItemsCount: 2,
    observationsCount: 0,
    anomaliesCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    scopes: [
      {
        id: "scope-1",
        organizationId: "org-1",
        campaignId: "campaign-1",
        spatialNodeId: "node-1",
        includeChildren: true,
        snapshot: null,
        createdAt: new Date(),
        spatialNode: {
          id: "node-1",
          organizationId: "org-1",
          type: "ROOM",
          code: "B101",
          label: "Bureau 101",
          description: null,
          path: "SITE/B101",
          depth: 1,
          sortOrder: 0,
          parentId: null,
          legacyLocationId: null,
          externalSource: null,
          externalRef: null,
          sourceClass: null,
          sourceMetadata: null,
          importProfileId: null,
          lastImportJobId: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      }
    ],
    familyFilters: [],
    observations: [],
    expectedItems: [
      {
        id: "expected-1",
        organizationId: "org-1",
        campaignId: "campaign-1",
        equipmentId: "equipment-1",
        expectedSpatialNodeId: "node-1",
        expectedSpatialPath: "SITE/B101",
        equipmentSnapshot: { internalCode: "AST-001" },
        isSeen: false,
        seenAt: null,
        createdAt: new Date(),
        equipment: {
          id: "equipment-1",
          internalCode: "AST-001",
          equipmentType: {
            label: "Bureau",
            subfamily: {
              family: {
                label: "Mobilier",
                category: {
                  label: "IFC4"
                }
              }
            }
          },
          equipmentStatus: {
            label: "En service"
          },
          ownerEntity: {
            label: "CPRP"
          },
          currentSpatialNodeId: "node-1",
          currentSpatialNode: {
            path: "SITE/B101"
          },
          immobilization: null
        }
      },
      {
        id: "expected-2",
        organizationId: "org-1",
        campaignId: "campaign-1",
        equipmentId: "equipment-2",
        expectedSpatialNodeId: "node-1",
        expectedSpatialPath: "SITE/B101",
        equipmentSnapshot: { internalCode: "AST-002" },
        isSeen: false,
        seenAt: null,
        createdAt: new Date(),
        equipment: {
          id: "equipment-2",
          internalCode: "AST-002",
          equipmentType: {
            label: "Armoire",
            subfamily: {
              family: {
                label: "Mobilier",
                category: {
                  label: "IFC4"
                }
              }
            }
          },
          equipmentStatus: {
            label: "En service"
          },
          ownerEntity: {
            label: "CPRP"
          },
          currentSpatialNodeId: "node-1",
          currentSpatialNode: {
            path: "SITE/B101"
          },
          immobilization: null
        }
      }
    ]
  };
}

describe("InventoryCampaignsService", () => {
  it("completes a node and creates only missing anomalies not already present", async () => {
    const campaign = createCampaign();
    const tx = {
      inventoryAnomaly: {
        createMany: vi.fn(async () => ({ count: 1 })),
        count: vi.fn(async () => 2)
      },
      inventoryCampaign: {
        update: vi.fn()
      }
    };
    const prisma = {
      inventoryCampaign: {
        findFirst: vi.fn(async () => campaign)
      },
      spatialNode: {
        findFirst: vi.fn(async () => campaign.scopes[0].spatialNode),
        findMany: vi.fn(async () => [campaign.scopes[0].spatialNode])
      },
      inventoryAnomaly: {
        findMany: vi.fn(async () => [{ expectedItemId: "expected-1" }])
      },
      $transaction: vi.fn(async (callback) => callback(tx))
    };
    const audit = {
      log: vi.fn()
    };
    const service = new InventoryCampaignsService(prisma as never, audit as never);

    const result = await service.completeNode(
      {
        organizationId: "org-1",
        sub: "user-1"
      } as never,
      "campaign-1",
      {
        spatialNodeId: "node-1"
      }
    );

    expect(result).toEqual({
      campaignId: "campaign-1",
      spatialNodeId: "node-1",
      missingCreated: 1,
      missingAlreadyExisting: 1
    });
    expect(tx.inventoryAnomaly.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          expectedItemId: "expected-2",
          type: InventoryAnomalyType.MISSING,
          notes: "Equipement attendu non observe a la fin de piece"
        })
      ]
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "inventory_campaign.node_completed"
      })
    );
  });

  it("syncs an equipment scanned by external reference on a spatial node code", async () => {
    const campaign = createCampaign();
    const equipment = {
      ...campaign.expectedItems[0].equipment,
      externalRef: "EXT-001",
      numPiece: null,
      immobilization: null
    };
    const tx = {
      inventorySyncBatch: {
        create: vi.fn(async () => ({ id: "batch-1" })),
        update: vi.fn()
      },
      inventoryObservation: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async (args) => ({
          id: "observation-1",
          organizationId: "org-1",
          campaignId: "campaign-1",
          clientObservationId: args.data.clientObservationId,
          scannedPayload: args.data.scannedPayload,
          scannedCode: args.data.scannedCode,
          scanSource: args.data.scanSource,
          deviceHint: args.data.deviceHint,
          result: args.data.result,
          equipmentId: args.data.equipmentId,
          observedSpatialNodeId: args.data.observedSpatialNodeId,
          syncBatchId: "batch-1",
          comment: null,
          clientObservedAt: null,
          observedAt: new Date("2026-06-29T12:00:00.000Z"),
          createdById: "user-1",
          equipment,
          observedSpatialNode: campaign.scopes[0].spatialNode,
          createdBy: { name: "Agent" }
        })),
        count: vi.fn(async () => 1)
      },
      equipment: {
        findMany: vi.fn(async () => [equipment])
      },
      inventoryCampaignExpectedItem: {
        findFirst: vi.fn(async () => campaign.expectedItems[0]),
        update: vi.fn()
      },
      inventoryAnomaly: {
        create: vi.fn(),
        count: vi.fn(async () => 0)
      },
      inventoryCampaign: {
        update: vi.fn()
      }
    };
    const prisma = {
      inventoryCampaign: {
        findFirst: vi.fn(async () => campaign)
      },
      spatialNode: {
        findMany: vi.fn(async () => [campaign.scopes[0].spatialNode])
      },
      inventorySyncBatch: {
        findFirst: vi.fn(async () => null)
      },
      $transaction: vi.fn(async (callback) => callback(tx))
    };
    const audit = {
      log: vi.fn()
    };
    const service = new InventoryCampaignsService(prisma as never, audit as never);

    const result = await service.sync(
      {
        organizationId: "org-1",
        sub: "user-1"
      } as never,
      "campaign-1",
      {
        clientBatchId: "client-batch-1",
        activeSpatialNodeId: "B101",
        observations: [
          {
            clientObservationId: "client-observation-1",
            scannedPayload: "EQ:EXT-001",
            scanSource: "MANUAL"
          }
        ]
      }
    );

    expect(tx.inventorySyncBatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          activeSpatialNodeId: "node-1"
        })
      })
    );
    expect(tx.equipment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([expect.objectContaining({ externalRef: "EXT-001" })])
        })
      })
    );
    expect(tx.inventoryObservation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          observedSpatialNodeId: "node-1",
          result: "MATCH"
        })
      })
    );
    expect(result.observations[0]).toEqual(expect.objectContaining({ result: "MATCH", equipmentInternalCode: "AST-001" }));
    expect(tx.inventoryAnomaly.create).not.toHaveBeenCalled();
  });
});
