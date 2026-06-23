import { Injectable, NotFoundException } from "@nestjs/common";
import {
  EquipmentMovementSource,
  EquipmentMovementTriggerType,
  EquipmentMovementType,
  Prisma,
  SpatialNodeType
} from "@prisma/client";
import type {
  EquipmentMovementAssignmentSnapshot,
  EquipmentMovementDetail,
  EquipmentMovementSpatialSnapshot,
  EquipmentMovementSummary
} from "@inventory/shared";
import type { equipmentInclude } from "../assets/assets.repository";
import { matchesSearchTerm, normalizeSearchTerm, paginateItems, sortItems } from "../common/listing";
import { ListEquipmentMovementsDto } from "./dto/list-equipment-movements.dto";
import {
  DbClient,
  EquipmentMovementsRepository
} from "./equipment-movements.repository";

type AssetState = Prisma.EquipmentGetPayload<{ include: typeof equipmentInclude }>;
type AssetAssignmentState = AssetState["assignments"][number];
type MovementRecord = NonNullable<Awaited<ReturnType<EquipmentMovementsRepository["findById"]>>>;

interface RecordAssetMutationInput {
  organizationId: string;
  equipmentId: string;
  createdById?: string | null;
  source: EquipmentMovementSource;
  triggerType: EquipmentMovementTriggerType;
  before: AssetState | null;
  after: AssetState;
  reason?: string | null;
}

@Injectable()
export class EquipmentMovementsService {
  constructor(private readonly repository: EquipmentMovementsRepository) {}

  private isAssignmentActive(assignment: { endsAt: Date | null }) {
    return !assignment.endsAt || assignment.endsAt.getTime() > Date.now();
  }

  private spatialSnapshot(node: AssetState["currentSpatialNode"]): EquipmentMovementSpatialSnapshot | null {
    if (!node) {
      return null;
    }
    return {
      id: node.id,
      type: node.type as SpatialNodeType,
      code: node.code,
      label: node.label,
      path: node.path
    };
  }

  private assignmentSnapshot(assignment: AssetAssignmentState): EquipmentMovementAssignmentSnapshot | null {
    if (assignment.assignmentType === "LOCATION") {
      return null;
    }
    return {
      assignmentType: assignment.assignmentType,
      targetUserId: assignment.targetUserId ?? null,
      targetUserName: assignment.targetUser?.name ?? null,
      targetUserEmail: assignment.targetUser?.email ?? null,
      targetPersonName: assignment.targetPersonName ?? null,
      targetEquipmentId: assignment.targetEquipmentId ?? null,
      targetEquipmentInternalCode: assignment.targetEquipment?.internalCode ?? null,
      targetEquipmentTypeLabel: assignment.targetEquipment?.equipmentType.label ?? null,
      targetEquipmentModelLabel: assignment.targetEquipment?.equipmentModel?.label ?? null
    };
  }

  private activeBusinessAssignments(asset: AssetState | null) {
    if (!asset) {
      return [];
    }
    return asset.assignments.filter(
      (assignment) =>
        assignment.assignmentType !== "LOCATION" &&
        this.isAssignmentActive(assignment)
    );
  }

  private assignmentKey(assignment: AssetAssignmentState) {
    if (assignment.assignmentType === "PERSON") {
      return assignment.targetUserId
        ? `user:${assignment.targetUserId}`
        : `person:${assignment.targetPersonName ?? ""}`;
    }
    if (assignment.assignmentType === "ASSET") {
      return `asset:${assignment.targetEquipmentId ?? ""}`;
    }
    return "legacy-location";
  }

  private assignmentMap(asset: AssetState | null) {
    return new Map(
      this.activeBusinessAssignments(asset).map((assignment) => [assignment.assignmentType, assignment])
    );
  }

  private createRow(input: {
    organizationId: string;
    equipmentId: string;
    createdById?: string | null;
    movementType: EquipmentMovementType;
    triggerType: EquipmentMovementTriggerType;
    source: EquipmentMovementSource;
    fromSpatialNodeId?: string | null;
    toSpatialNodeId?: string | null;
    fromSpatialSnapshot?: EquipmentMovementSpatialSnapshot | null;
    toSpatialSnapshot?: EquipmentMovementSpatialSnapshot | null;
    fromAssignmentSnapshot?: EquipmentMovementAssignmentSnapshot | null;
    toAssignmentSnapshot?: EquipmentMovementAssignmentSnapshot | null;
    reason?: string | null;
  }): Prisma.EquipmentMovementCreateManyInput {
    const row: Prisma.EquipmentMovementCreateManyInput = {
      organizationId: input.organizationId,
      equipmentId: input.equipmentId,
      movementType: input.movementType,
      triggerType: input.triggerType,
      source: input.source,
      fromSpatialNodeId: input.fromSpatialNodeId ?? null,
      toSpatialNodeId: input.toSpatialNodeId ?? null,
      reason: input.reason ?? null,
      createdById: input.createdById ?? null
    };
    if (input.fromSpatialSnapshot) {
      row.fromSpatialSnapshot = input.fromSpatialSnapshot as unknown as Prisma.InputJsonValue;
    }
    if (input.toSpatialSnapshot) {
      row.toSpatialSnapshot = input.toSpatialSnapshot as unknown as Prisma.InputJsonValue;
    }
    if (input.fromAssignmentSnapshot) {
      row.fromAssignmentSnapshot = input.fromAssignmentSnapshot as unknown as Prisma.InputJsonValue;
    }
    if (input.toAssignmentSnapshot) {
      row.toAssignmentSnapshot = input.toAssignmentSnapshot as unknown as Prisma.InputJsonValue;
    }
    return row;
  }

  async recordForAssetMutation(db: DbClient, input: RecordAssetMutationInput) {
    const rows: Prisma.EquipmentMovementCreateManyInput[] = [];
    const beforeSpatial = this.spatialSnapshot(input.before?.currentSpatialNode ?? null);
    const afterSpatial = this.spatialSnapshot(input.after.currentSpatialNode);
    const beforeAssignments = this.assignmentMap(input.before);
    const afterAssignments = this.assignmentMap(input.after);

    if (!input.before) {
      if (afterSpatial) {
        rows.push(
          this.createRow({
            ...input,
            movementType: EquipmentMovementType.INITIAL_STATE,
            fromSpatialNodeId: null,
            toSpatialNodeId: input.after.currentSpatialNodeId ?? null,
            fromSpatialSnapshot: null,
            toSpatialSnapshot: afterSpatial
          })
        );
      }

      for (const assignment of afterAssignments.values()) {
        rows.push(
          this.createRow({
            ...input,
            movementType: EquipmentMovementType.INITIAL_STATE,
            fromAssignmentSnapshot: null,
            toAssignmentSnapshot: this.assignmentSnapshot(assignment)
          })
        );
      }

      await this.repository.createMany(db, rows);
      return rows.length;
    }

    if ((input.before.currentSpatialNodeId ?? null) !== (input.after.currentSpatialNodeId ?? null)) {
      rows.push(
        this.createRow({
          ...input,
          movementType: EquipmentMovementType.LOCATION_CHANGED,
          fromSpatialNodeId: input.before.currentSpatialNodeId ?? null,
          toSpatialNodeId: input.after.currentSpatialNodeId ?? null,
          fromSpatialSnapshot: beforeSpatial,
          toSpatialSnapshot: afterSpatial
        })
      );
    }

    for (const assignmentType of ["PERSON", "ASSET"] as const) {
      const beforeAssignment = beforeAssignments.get(assignmentType) ?? null;
      const afterAssignment = afterAssignments.get(assignmentType) ?? null;

      if (!beforeAssignment && afterAssignment) {
        rows.push(
          this.createRow({
            ...input,
            movementType: EquipmentMovementType.ASSIGNMENT_ADDED,
            triggerType: EquipmentMovementTriggerType.ASSIGNMENTS_REPLACED,
            fromAssignmentSnapshot: null,
            toAssignmentSnapshot: this.assignmentSnapshot(afterAssignment)
          })
        );
        continue;
      }

      if (beforeAssignment && !afterAssignment) {
        rows.push(
          this.createRow({
            ...input,
            movementType: EquipmentMovementType.ASSIGNMENT_REMOVED,
            triggerType: EquipmentMovementTriggerType.ASSIGNMENTS_REPLACED,
            fromAssignmentSnapshot: this.assignmentSnapshot(beforeAssignment),
            toAssignmentSnapshot: null
          })
        );
        continue;
      }

      if (
        beforeAssignment &&
        afterAssignment &&
        this.assignmentKey(beforeAssignment) !== this.assignmentKey(afterAssignment)
      ) {
        rows.push(
          this.createRow({
            ...input,
            movementType: EquipmentMovementType.ASSIGNMENT_CHANGED,
            triggerType: EquipmentMovementTriggerType.ASSIGNMENTS_REPLACED,
            fromAssignmentSnapshot: this.assignmentSnapshot(beforeAssignment),
            toAssignmentSnapshot: this.assignmentSnapshot(afterAssignment)
          })
        );
      }
    }

    await this.repository.createMany(db, rows);
    return rows.length;
  }

  private mapMovement(movement: MovementRecord): EquipmentMovementSummary {
    return {
      id: movement.id,
      organizationId: movement.organizationId,
      equipmentId: movement.equipmentId,
      equipmentInternalCode: movement.equipment.internalCode,
      movementType: movement.movementType,
      triggerType: movement.triggerType,
      source: movement.source,
      fromSpatialNodeId: movement.fromSpatialNodeId ?? null,
      toSpatialNodeId: movement.toSpatialNodeId ?? null,
      fromSpatialSnapshot: movement.fromSpatialSnapshot as EquipmentMovementSpatialSnapshot | null,
      toSpatialSnapshot: movement.toSpatialSnapshot as EquipmentMovementSpatialSnapshot | null,
      fromAssignmentSnapshot: movement.fromAssignmentSnapshot as EquipmentMovementAssignmentSnapshot | null,
      toAssignmentSnapshot: movement.toAssignmentSnapshot as EquipmentMovementAssignmentSnapshot | null,
      reason: movement.reason ?? null,
      createdById: movement.createdById ?? null,
      createdByName: movement.createdBy?.name ?? null,
      createdByEmail: movement.createdBy?.email ?? null,
      createdAt: movement.createdAt.toISOString()
    };
  }

  private async getListItems(organizationId: string, query: ListEquipmentMovementsDto) {
    const search = normalizeSearchTerm(query.q);
    const movements = (await this.repository.listByOrganization(organizationId))
      .map((movement) => this.mapMovement(movement))
      .filter((movement) => {
        if (query.equipmentId && movement.equipmentId !== query.equipmentId) {
          return false;
        }
        if (query.movementType && movement.movementType !== query.movementType) {
          return false;
        }
        if (query.source && movement.source !== query.source) {
          return false;
        }
        return matchesSearchTerm(search, [
          movement.equipmentInternalCode,
          movement.movementType,
          movement.source,
          movement.createdByName,
          movement.createdByEmail,
          movement.fromSpatialSnapshot?.label,
          movement.fromSpatialSnapshot?.path,
          movement.toSpatialSnapshot?.label,
          movement.toSpatialSnapshot?.path,
          movement.fromAssignmentSnapshot?.targetPersonName,
          movement.fromAssignmentSnapshot?.targetUserName,
          movement.fromAssignmentSnapshot?.targetUserEmail,
          movement.fromAssignmentSnapshot?.targetEquipmentInternalCode,
          movement.toAssignmentSnapshot?.targetPersonName,
          movement.toAssignmentSnapshot?.targetUserName,
          movement.toAssignmentSnapshot?.targetUserEmail,
          movement.toAssignmentSnapshot?.targetEquipmentInternalCode
        ]);
      });

    return sortItems(
      movements,
      {
        createdAt: (item: EquipmentMovementSummary) => item.createdAt,
        movementType: (item: EquipmentMovementSummary) => item.movementType,
        source: (item: EquipmentMovementSummary) => item.source,
        equipmentInternalCode: (item: EquipmentMovementSummary) => item.equipmentInternalCode
      }[query.sort ?? "createdAt"],
      query.direction ?? "desc"
    );
  }

  async list(organizationId: string, query: ListEquipmentMovementsDto) {
    const items = await this.getListItems(organizationId, query);
    return paginateItems(items, query.page, query.pageSize);
  }

  async listForEquipment(organizationId: string, equipmentId: string, query: ListEquipmentMovementsDto) {
    return this.list(organizationId, { ...query, equipmentId });
  }

  async getDetail(organizationId: string, movementId: string): Promise<EquipmentMovementDetail> {
    const movement = await this.repository.findById(organizationId, movementId);
    if (!movement) {
      throw new NotFoundException("Equipment movement not found");
    }
    return this.mapMovement(movement);
  }
}
