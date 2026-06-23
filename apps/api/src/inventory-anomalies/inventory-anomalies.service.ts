import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  EquipmentMovementSource,
  EquipmentMovementTriggerType,
  EquipmentMovementType,
  InventoryAnomalyStatus,
  InventoryCorrectionStatus,
  InventoryCorrectionType,
  Prisma
} from "@prisma/client";
import type {
  CreateInventoryCorrectionInput,
  InventoryAnomalyDetail,
  InventoryAnomalyListQuery,
  InventoryAnomalySummary,
  InventoryCorrectionSummary,
  UpdateInventoryAnomalyInput
} from "@inventory/shared";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { matchesSearchTerm, normalizeSearchTerm, paginateItems, sortItems } from "../common/listing";
import { PrismaService } from "../prisma.service";

const anomalyInclude = {
  campaign: true,
  equipment: true,
  expectedSpatialNode: true,
  observedSpatialNode: true,
  corrections: {
    orderBy: {
      proposedAt: "desc"
    }
  }
} satisfies Prisma.InventoryAnomalyInclude;

type AnomalyRecord = Prisma.InventoryAnomalyGetPayload<{ include: typeof anomalyInclude }>;

@Injectable()
export class InventoryAnomaliesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async list(organizationId: string, query: InventoryAnomalyListQuery) {
    const anomalies = await this.prisma.inventoryAnomaly.findMany({
      where: {
        organizationId
      },
      include: anomalyInclude,
      orderBy: {
        updatedAt: "desc"
      }
    });
    const search = normalizeSearchTerm(query.q);
    const filtered = anomalies
      .map((anomaly) => this.mapSummary(anomaly))
      .filter((anomaly) => {
        if (query.campaignId && anomaly.campaignId !== query.campaignId) {
          return false;
        }
        if (query.type && anomaly.type !== query.type) {
          return false;
        }
        if (query.status && anomaly.status !== query.status) {
          return false;
        }
        return matchesSearchTerm(search, [
          anomaly.campaignName,
          anomaly.equipmentInternalCode,
          anomaly.scannedCode,
          anomaly.expectedSpatialPath,
          anomaly.observedSpatialPath,
          anomaly.type,
          anomaly.status
        ]);
      });
    const sorted = sortItems(
      filtered,
      {
        createdAt: (item: InventoryAnomalySummary) => item.createdAt,
        updatedAt: (item: InventoryAnomalySummary) => item.updatedAt,
        type: (item: InventoryAnomalySummary) => item.type,
        status: (item: InventoryAnomalySummary) => item.status
      }[query.sort ?? "updatedAt"],
      query.direction ?? "desc"
    );
    return paginateItems(sorted, Number(query.page ?? 1), Number(query.pageSize ?? 20));
  }

  async detail(organizationId: string, anomalyId: string): Promise<InventoryAnomalyDetail> {
    const anomaly = await this.findAnomaly(organizationId, anomalyId);
    return {
      ...this.mapSummary(anomaly),
      expectedSnapshot: anomaly.expectedSnapshot ?? null,
      observedSnapshot: anomaly.observedSnapshot ?? null,
      corrections: anomaly.corrections.map((correction) => this.mapCorrection(correction))
    };
  }

  async update(auth: AuthenticatedUser, anomalyId: string, input: UpdateInventoryAnomalyInput) {
    await this.findAnomaly(auth.organizationId, anomalyId);
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.inventoryAnomaly.update({
        where: {
          id: anomalyId
        },
        data: {
          status: input.status as InventoryAnomalyStatus | undefined,
          notes: input.notes === undefined ? undefined : input.notes
        }
      });
      await this.auditService.log({
        db: tx,
        organizationId: auth.organizationId,
        userId: auth.sub,
        action: "inventory_anomaly.updated",
        entityType: "inventory_anomaly",
        entityId: anomalyId,
        metadata: {
          status: result.status
        }
      });
      return result;
    });
    return this.detail(auth.organizationId, updated.id);
  }

  async createCorrection(auth: AuthenticatedUser, anomalyId: string, input: CreateInventoryCorrectionInput) {
    const anomaly = await this.findAnomaly(auth.organizationId, anomalyId);
    const equipmentId = input.equipmentId ?? anomaly.equipmentId;
    if (!input.correctionType) {
      throw new BadRequestException("Type de correction obligatoire");
    }
    await this.validateCorrectionTargets(auth.organizationId, input);
    const correction = await this.prisma.$transaction(async (tx) => {
      const created = await tx.inventoryCorrection.create({
        data: {
          organizationId: auth.organizationId,
          campaignId: anomaly.campaignId,
          anomalyId,
          equipmentId,
          correctionType: input.correctionType as InventoryCorrectionType,
          targetSpatialNodeId: input.targetSpatialNodeId ?? null,
          targetEquipmentStatusId: input.targetEquipmentStatusId ?? null,
          targetImmobilizationId: input.targetImmobilizationId ?? null,
          notes: input.notes ?? null,
          fromSnapshot: anomaly.observedSnapshot as Prisma.InputJsonValue | undefined,
          toSnapshot: input as unknown as Prisma.InputJsonValue,
          proposedById: auth.sub
        }
      });
      await this.auditService.log({
        db: tx,
        organizationId: auth.organizationId,
        userId: auth.sub,
        action: "inventory_correction.proposed",
        entityType: "inventory_correction",
        entityId: created.id,
        metadata: {
          correctionType: created.correctionType
        }
      });
      return created;
    });
    return this.mapCorrection(correction);
  }

  async applyCorrection(auth: AuthenticatedUser, correctionId: string) {
    const correction = await this.prisma.inventoryCorrection.findFirst({
      where: {
        id: correctionId,
        organizationId: auth.organizationId
      },
      include: {
        equipment: {
          include: {
            currentSpatialNode: true
          }
        },
        targetSpatialNode: true,
        targetEquipmentStatus: true,
        targetImmobilization: true
      }
    });
    if (!correction) {
      throw new NotFoundException("Correction introuvable");
    }
    if (correction.status === InventoryCorrectionStatus.APPLIED) {
      return this.mapCorrection(correction);
    }
    if (!correction.equipmentId) {
      throw new BadRequestException("Correction sans equipement cible");
    }

    const applied = await this.prisma.$transaction(async (tx) => {
      if (correction.correctionType === InventoryCorrectionType.LOCATION_CHANGE) {
        if (!correction.targetSpatialNodeId) {
          throw new BadRequestException("Noeud spatial cible obligatoire");
        }
        const before = correction.equipment?.currentSpatialNode ?? null;
        const after = correction.targetSpatialNode;
        await tx.equipment.update({
          where: {
            id: correction.equipmentId!
          },
          data: {
            currentSpatialNodeId: correction.targetSpatialNodeId
          }
        });
        await tx.equipmentMovement.create({
          data: {
            organizationId: auth.organizationId,
            equipmentId: correction.equipmentId!,
            movementType: EquipmentMovementType.LOCATION_CHANGED,
            triggerType: EquipmentMovementTriggerType.EQUIPMENT_UPDATED,
            source: EquipmentMovementSource.USER,
            fromSpatialNodeId: before?.id ?? null,
            toSpatialNodeId: after?.id ?? null,
            fromSpatialSnapshot: before
              ? {
                  id: before.id,
                  type: before.type,
                  code: before.code,
                  label: before.label,
                  path: before.path
                }
              : undefined,
            toSpatialSnapshot: after
              ? {
                  id: after.id,
                  type: after.type,
                  code: after.code,
                  label: after.label,
                  path: after.path
                }
              : undefined,
            reason: correction.notes,
            createdById: auth.sub
          }
        });
      }

      if (correction.correctionType === InventoryCorrectionType.STATUS_CHANGE) {
        if (!correction.targetEquipmentStatusId) {
          throw new BadRequestException("Statut cible obligatoire");
        }
        await tx.equipment.update({
          where: {
            id: correction.equipmentId!
          },
          data: {
            equipmentStatusId: correction.targetEquipmentStatusId
          }
        });
      }

      if (correction.correctionType === InventoryCorrectionType.MANUAL_IMMOBILIZATION_LINK) {
        await tx.equipment.update({
          where: {
            id: correction.equipmentId!
          },
          data: {
            immobilizationId: correction.targetImmobilizationId ?? null
          }
        });
      }

      const updated = await tx.inventoryCorrection.update({
        where: {
          id: correctionId
        },
        data: {
          status: InventoryCorrectionStatus.APPLIED,
          approvedById: auth.sub,
          approvedAt: new Date(),
          appliedAt: new Date()
        }
      });
      if (correction.anomalyId) {
        await tx.inventoryAnomaly.update({
          where: {
            id: correction.anomalyId
          },
          data: {
            status: InventoryAnomalyStatus.RESOLVED
          }
        });
      }
      await this.auditService.log({
        db: tx,
        organizationId: auth.organizationId,
        userId: auth.sub,
        action: "inventory_correction.applied",
        entityType: "inventory_correction",
        entityId: correctionId,
        metadata: {
          correctionType: correction.correctionType,
          equipmentId: correction.equipmentId
        }
      });
      return updated;
    });
    return this.mapCorrection(applied);
  }

  private async validateCorrectionTargets(organizationId: string, input: CreateInventoryCorrectionInput) {
    if (input.targetSpatialNodeId) {
      const node = await this.prisma.spatialNode.findFirst({
        where: {
          id: input.targetSpatialNodeId,
          organizationId
        }
      });
      if (!node) {
        throw new BadRequestException("Noeud spatial cible invalide");
      }
    }
    if (input.targetEquipmentStatusId) {
      const status = await this.prisma.equipmentStatus.findFirst({
        where: {
          id: input.targetEquipmentStatusId,
          organizationId
        }
      });
      if (!status) {
        throw new BadRequestException("Statut cible invalide");
      }
    }
    if (input.targetImmobilizationId) {
      const immobilization = await this.prisma.immobilization.findFirst({
        where: {
          id: input.targetImmobilizationId,
          organizationId
        }
      });
      if (!immobilization) {
        throw new BadRequestException("Immobilisation cible invalide");
      }
    }
  }

  private async findAnomaly(organizationId: string, anomalyId: string) {
    const anomaly = await this.prisma.inventoryAnomaly.findFirst({
      where: {
        id: anomalyId,
        organizationId
      },
      include: anomalyInclude
    });
    if (!anomaly) {
      throw new NotFoundException("Anomalie introuvable");
    }
    return anomaly;
  }

  private mapSummary(anomaly: AnomalyRecord): InventoryAnomalySummary {
    return {
      id: anomaly.id,
      campaignId: anomaly.campaignId,
      campaignName: anomaly.campaign.name,
      type: anomaly.type,
      status: anomaly.status,
      equipmentId: anomaly.equipmentId ?? null,
      equipmentInternalCode: anomaly.equipment?.internalCode ?? null,
      scannedCode: anomaly.scannedCode ?? null,
      expectedSpatialPath: anomaly.expectedSpatialNode?.path ?? null,
      observedSpatialPath: anomaly.observedSpatialNode?.path ?? null,
      notes: anomaly.notes ?? null,
      createdAt: anomaly.createdAt.toISOString(),
      updatedAt: anomaly.updatedAt.toISOString()
    };
  }

  private mapCorrection(correction: {
    id: string;
    anomalyId: string | null;
    equipmentId: string | null;
    correctionType: InventoryCorrectionType;
    status: InventoryCorrectionStatus;
    targetSpatialNodeId: string | null;
    targetEquipmentStatusId: string | null;
    targetImmobilizationId: string | null;
    notes: string | null;
    proposedAt: Date;
    approvedAt: Date | null;
    appliedAt: Date | null;
    failureReason: string | null;
  }): InventoryCorrectionSummary {
    return {
      id: correction.id,
      anomalyId: correction.anomalyId,
      equipmentId: correction.equipmentId,
      correctionType: correction.correctionType,
      status: correction.status,
      targetSpatialNodeId: correction.targetSpatialNodeId,
      targetEquipmentStatusId: correction.targetEquipmentStatusId,
      targetImmobilizationId: correction.targetImmobilizationId,
      notes: correction.notes,
      proposedAt: correction.proposedAt.toISOString(),
      approvedAt: correction.approvedAt?.toISOString() ?? null,
      appliedAt: correction.appliedAt?.toISOString() ?? null,
      failureReason: correction.failureReason
    };
  }
}
