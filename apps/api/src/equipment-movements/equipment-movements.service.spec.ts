import { describe, expect, it, vi } from "vitest";
import { EquipmentMovementsService } from "./equipment-movements.service";

function spatialNode(id: string, label: string) {
  return {
    id,
    type: "ROOM",
    code: label.toUpperCase(),
    label,
    path: `SITE/${label.toUpperCase()}`
  };
}

function assetState(overrides: Record<string, unknown> = {}) {
  return {
    id: "asset-1",
    organizationId: "org-1",
    internalCode: "AST-001",
    currentSpatialNodeId: null,
    currentSpatialNode: null,
    assignments: [],
    ...overrides
  } as never;
}

function personAssignment(targetUserId: string, name: string) {
  return {
    id: `assignment-${targetUserId}`,
    assignmentType: "PERSON",
    targetUserId,
    targetPersonName: name,
    targetLocationId: null,
    targetEquipmentId: null,
    targetUser: {
      id: targetUserId,
      name,
      email: `${targetUserId}@demo.local`
    },
    targetLocation: null,
    targetEquipment: null,
    startsAt: new Date(),
    endsAt: null,
    notes: null
  };
}

function assetAssignment(targetEquipmentId: string) {
  return {
    id: `assignment-${targetEquipmentId}`,
    assignmentType: "ASSET",
    targetUserId: null,
    targetPersonName: null,
    targetLocationId: null,
    targetEquipmentId,
    targetUser: null,
    targetLocation: null,
    targetEquipment: {
      id: targetEquipmentId,
      internalCode: "AST-PARENT-001",
      equipmentModel: { label: "Bureau standard" },
      equipmentType: { label: "Bureau" }
    },
    startsAt: new Date(),
    endsAt: null,
    notes: null
  };
}

function createService() {
  const repository = {
    createMany: vi.fn(async (_db, rows) => ({ count: rows.length }))
  };
  return {
    repository,
    service: new EquipmentMovementsService(repository as never)
  };
}

describe("EquipmentMovementsService", () => {
  it("creates initial state movements for spatial node and assignments", async () => {
    const { repository, service } = createService();
    await service.recordForAssetMutation({} as never, {
      organizationId: "org-1",
      equipmentId: "asset-1",
      createdById: "user-1",
      source: "USER",
      triggerType: "EQUIPMENT_CREATED",
      before: null,
      after: assetState({
        currentSpatialNodeId: "room-1",
        currentSpatialNode: spatialNode("room-1", "Bureau A"),
        assignments: [personAssignment("user-2", "Nicolas")]
      })
    });

    const rows = repository.createMany.mock.calls[0]?.[1];
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.movementType)).toEqual(["INITIAL_STATE", "INITIAL_STATE"]);
  });

  it("creates one location movement when the current spatial node changes", async () => {
    const { repository, service } = createService();
    await service.recordForAssetMutation({} as never, {
      organizationId: "org-1",
      equipmentId: "asset-1",
      createdById: "user-1",
      source: "USER",
      triggerType: "EQUIPMENT_UPDATED",
      before: assetState({
        currentSpatialNodeId: "room-1",
        currentSpatialNode: spatialNode("room-1", "Bureau A")
      }),
      after: assetState({
        currentSpatialNodeId: "room-2",
        currentSpatialNode: spatialNode("room-2", "Bureau B")
      })
    });

    const rows = repository.createMany.mock.calls[0]?.[1];
    expect(rows).toHaveLength(1);
    expect(rows[0].movementType).toBe("LOCATION_CHANGED");
    expect(rows[0].fromSpatialNodeId).toBe("room-1");
    expect(rows[0].toSpatialNodeId).toBe("room-2");
  });

  it("creates assignment changed, removed and added movements", async () => {
    const { repository, service } = createService();
    await service.recordForAssetMutation({} as never, {
      organizationId: "org-1",
      equipmentId: "asset-1",
      createdById: "user-1",
      source: "USER",
      triggerType: "EQUIPMENT_UPDATED",
      before: assetState({
        assignments: [personAssignment("user-2", "Nicolas"), assetAssignment("asset-parent-1")]
      }),
      after: assetState({
        assignments: [personAssignment("user-3", "Lea")]
      })
    });

    const rows = repository.createMany.mock.calls[0]?.[1];
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.movementType).sort()).toEqual([
      "ASSIGNMENT_CHANGED",
      "ASSIGNMENT_REMOVED"
    ]);
    expect(rows.every((row) => row.triggerType === "ASSIGNMENTS_REPLACED")).toBe(true);
  });

  it("does not create movement when nothing relevant changed", async () => {
    const { repository, service } = createService();
    const state = assetState({
      currentSpatialNodeId: "room-1",
      currentSpatialNode: spatialNode("room-1", "Bureau A"),
      assignments: [personAssignment("user-2", "Nicolas")]
    });

    await service.recordForAssetMutation({} as never, {
      organizationId: "org-1",
      equipmentId: "asset-1",
      createdById: "user-1",
      source: "USER",
      triggerType: "EQUIPMENT_UPDATED",
      before: state,
      after: state
    });

    const rows = repository.createMany.mock.calls[0]?.[1];
    expect(rows).toHaveLength(0);
  });
});
