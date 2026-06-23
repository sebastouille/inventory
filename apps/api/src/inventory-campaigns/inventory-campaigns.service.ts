import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InventoryAnomalyType, InventoryCampaignStatus, InventoryObservationResult, Prisma } from "@prisma/client";
import type {
  CompleteInventoryNodeInput,
  CompleteInventoryNodeResult,
  CreateInventoryCampaignInput,
  InventoryCampaignDetail,
  InventoryCampaignExpectedPreviewResponse,
  InventoryCampaignListQuery,
  InventoryCampaignSummary,
  InventoryCampaignSyncInput,
  InventoryCampaignSyncResponse,
  InventoryExpectedItemSummary,
  InventoryObservationSummary,
  ScanSource,
  UpdateInventoryCampaignInput
} from "@inventory/shared";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { matchesSearchTerm, normalizeSearchTerm, paginateItems, sortItems } from "../common/listing";
import { PrismaService } from "../prisma.service";

type DbClient = PrismaService | Prisma.TransactionClient;

const equipmentInclude = {
  equipmentType: {
    include: {
      subfamily: {
        include: {
          family: {
            include: {
              category: true
            }
          }
        }
      }
    }
  },
  equipmentModel: {
    include: {
      brand: true
    }
  },
  equipmentStatus: true,
  ownerEntity: true,
  currentSpatialNode: true,
  immobilization: true
} satisfies Prisma.EquipmentInclude;

type EquipmentWithRefs = Prisma.EquipmentGetPayload<{ include: typeof equipmentInclude }>;

const campaignInclude = {
  scopes: {
    include: {
      spatialNode: true
    }
  },
  familyFilters: true,
  expectedItems: {
    include: {
      equipment: {
        include: equipmentInclude
      },
      expectedSpatialNode: true
    },
    orderBy: {
      createdAt: "asc"
    }
  },
  observations: {
    include: {
      equipment: true,
      observedSpatialNode: true,
      createdBy: true
    },
    orderBy: {
      observedAt: "desc"
    }
  }
} satisfies Prisma.InventoryCampaignInclude;

type CampaignWithDetails = Prisma.InventoryCampaignGetPayload<{ include: typeof campaignInclude }>;

@Injectable()
export class InventoryCampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async list(organizationId: string, query: InventoryCampaignListQuery) {
    const campaigns = await this.prisma.inventoryCampaign.findMany({
      where: {
        organizationId
      },
      orderBy: {
        updatedAt: "desc"
      }
    });
    const search = normalizeSearchTerm(query.q);
    const filtered = campaigns
      .map((campaign) => this.mapSummary(campaign))
      .filter((campaign) => {
        if (query.status && campaign.status !== query.status) {
          return false;
        }
        return matchesSearchTerm(search, [campaign.name, campaign.description, campaign.status]);
      });
    const sorted = sortItems(
      filtered,
      {
        name: (item: InventoryCampaignSummary) => item.name,
        createdAt: (item: InventoryCampaignSummary) => item.createdAt,
        updatedAt: (item: InventoryCampaignSummary) => item.updatedAt,
        status: (item: InventoryCampaignSummary) => item.status
      }[query.sort ?? "updatedAt"],
      query.direction ?? "desc"
    );
    return paginateItems(sorted, Number(query.page ?? 1), Number(query.pageSize ?? 20));
  }

  async create(auth: AuthenticatedUser, input: CreateInventoryCampaignInput) {
    this.validateCampaignInput(input);
    await this.ensureSpatialNodes(auth.organizationId, input.scopes.map((scope) => scope.spatialNodeId));

    const created = await this.prisma.$transaction(async (tx) => {
      const campaign = await tx.inventoryCampaign.create({
        data: {
          organizationId: auth.organizationId,
          name: input.name.trim(),
          description: this.optional(input.description),
          plannedStartAt: this.dateOrNull(input.plannedStartAt),
          plannedEndAt: this.dateOrNull(input.plannedEndAt),
          responsibleUserId: input.responsibleUserId ?? null,
          createdById: auth.sub,
          scopes: {
            create: input.scopes.map((scope) => ({
              organizationId: auth.organizationId,
              spatialNodeId: scope.spatialNodeId,
              includeChildren: scope.includeChildren ?? true
            }))
          },
          familyFilters: {
            create: (input.familyFilters ?? []).map((filter) => ({
              organizationId: auth.organizationId,
              categoryId: filter.categoryId ?? null,
              familyId: filter.familyId ?? null,
              subfamilyId: filter.subfamilyId ?? null,
              typeId: filter.typeId ?? null
            }))
          }
        }
      });
      await this.auditService.log({
        db: tx,
        organizationId: auth.organizationId,
        userId: auth.sub,
        action: "inventory_campaign.created",
        entityType: "inventory_campaign",
        entityId: campaign.id,
        metadata: {
          name: campaign.name
        }
      });
      return campaign;
    });

    return this.detail(auth.organizationId, created.id);
  }

  async update(auth: AuthenticatedUser, campaignId: string, input: UpdateInventoryCampaignInput) {
    const campaign = await this.findCampaign(auth.organizationId, campaignId);
    if (!["DRAFT", "READY"].includes(campaign.status)) {
      throw new BadRequestException("La campagne ne peut plus etre modifiee");
    }
    const nextScopes = input.scopes ?? campaign.scopes.map((scope) => ({
      spatialNodeId: scope.spatialNodeId,
      includeChildren: scope.includeChildren
    }));
    if (nextScopes.length === 0) {
      throw new BadRequestException("Au moins un perimetre spatial est obligatoire");
    }
    await this.ensureSpatialNodes(auth.organizationId, nextScopes.map((scope) => scope.spatialNodeId));

    await this.prisma.$transaction(async (tx) => {
      await tx.inventoryCampaign.update({
        where: {
          id: campaignId
        },
        data: {
          name: input.name?.trim() ?? campaign.name,
          description: input.description === undefined ? campaign.description : this.optional(input.description),
          plannedStartAt: input.plannedStartAt === undefined ? campaign.plannedStartAt : this.dateOrNull(input.plannedStartAt),
          plannedEndAt: input.plannedEndAt === undefined ? campaign.plannedEndAt : this.dateOrNull(input.plannedEndAt),
          responsibleUserId: input.responsibleUserId === undefined ? campaign.responsibleUserId : input.responsibleUserId
        }
      });
      if (input.scopes) {
        await tx.inventoryCampaignScope.deleteMany({ where: { campaignId } });
        await tx.inventoryCampaignScope.createMany({
          data: input.scopes.map((scope) => ({
            organizationId: auth.organizationId,
            campaignId,
            spatialNodeId: scope.spatialNodeId,
            includeChildren: scope.includeChildren ?? true
          }))
        });
      }
      if (input.familyFilters) {
        await tx.inventoryCampaignFamilyFilter.deleteMany({ where: { campaignId } });
        if (input.familyFilters.length > 0) {
          await tx.inventoryCampaignFamilyFilter.createMany({
            data: input.familyFilters.map((filter) => ({
              organizationId: auth.organizationId,
              campaignId,
              categoryId: filter.categoryId ?? null,
              familyId: filter.familyId ?? null,
              subfamilyId: filter.subfamilyId ?? null,
              typeId: filter.typeId ?? null
            }))
          });
        }
      }
      await this.auditService.log({
        db: tx,
        organizationId: auth.organizationId,
        userId: auth.sub,
        action: "inventory_campaign.updated",
        entityType: "inventory_campaign",
        entityId: campaignId
      });
    });
    return this.detail(auth.organizationId, campaignId);
  }

  async detail(organizationId: string, campaignId: string): Promise<InventoryCampaignDetail> {
    const campaign = await this.findCampaign(organizationId, campaignId);
    return this.mapDetail(campaign);
  }

  async previewExpected(organizationId: string, campaignId: string): Promise<InventoryCampaignExpectedPreviewResponse> {
    const campaign = await this.findCampaign(organizationId, campaignId);
    const equipments = await this.collectExpectedEquipments(organizationId, campaign);
    return {
      total: equipments.length,
      items: equipments.map((equipment) => this.mapExpectedFromEquipment(equipment))
    };
  }

  async open(auth: AuthenticatedUser, campaignId: string) {
    const campaign = await this.findCampaign(auth.organizationId, campaignId);
    if (!["DRAFT", "READY"].includes(campaign.status)) {
      throw new BadRequestException("Seule une campagne brouillon ou prete peut etre ouverte");
    }
    const scopedEquipmentCount = await this.countScopedEquipments(auth.organizationId, campaign);
    const equipments = await this.collectExpectedEquipments(auth.organizationId, campaign);
    if (scopedEquipmentCount === 0) {
      throw new BadRequestException("Le perimetre de campagne ne contient aucun equipement");
    }
    if (equipments.length === 0) {
      throw new BadRequestException("Aucun equipement avec code interne n est attendu");
    }
    if (scopedEquipmentCount !== equipments.length) {
      throw new BadRequestException("Le perimetre contient des equipements sans code interne");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.inventoryCampaignExpectedItem.deleteMany({ where: { campaignId } });
      await tx.inventoryCampaignExpectedItem.createMany({
        data: equipments.map((equipment) => ({
          organizationId: auth.organizationId,
          campaignId,
          equipmentId: equipment.id,
          expectedSpatialNodeId: equipment.currentSpatialNodeId ?? null,
          expectedSpatialPath: equipment.currentSpatialNode?.path ?? null,
          equipmentSnapshot: this.snapshotEquipment(equipment) as Prisma.InputJsonValue
        }))
      });
      await tx.inventoryCampaign.update({
        where: {
          id: campaignId
        },
        data: {
          status: InventoryCampaignStatus.OPEN,
          openedAt: new Date(),
          expectedItemsCount: equipments.length,
          observationsCount: 0,
          anomaliesCount: 0
        }
      });
      await this.auditService.log({
        db: tx,
        organizationId: auth.organizationId,
        userId: auth.sub,
        action: "inventory_campaign.opened",
        entityType: "inventory_campaign",
        entityId: campaignId,
        metadata: {
          expectedItemsCount: equipments.length
        }
      });
    });
    return this.detail(auth.organizationId, campaignId);
  }

  async close(auth: AuthenticatedUser, campaignId: string) {
    const campaign = await this.findCampaign(auth.organizationId, campaignId);
    if (!["OPEN", "REVIEW"].includes(campaign.status)) {
      throw new BadRequestException("La campagne doit etre ouverte ou en revue pour etre cloturee");
    }
    const missingItems = campaign.expectedItems.filter((item) => !item.isSeen);
    const existingMissing = missingItems.length
      ? await this.prisma.inventoryAnomaly.findMany({
          where: {
            campaignId,
            type: InventoryAnomalyType.MISSING,
            expectedItemId: {
              in: missingItems.map((item) => item.id)
            }
          },
          select: {
            expectedItemId: true
          }
        })
      : [];
    const existingMissingIds = new Set(existingMissing.map((item) => item.expectedItemId).filter(Boolean));
    const missingItemsToCreate = missingItems.filter((item) => !existingMissingIds.has(item.id));
    await this.prisma.$transaction(async (tx) => {
      if (missingItemsToCreate.length > 0) {
        await tx.inventoryAnomaly.createMany({
          data: missingItemsToCreate.map((item) => ({
            organizationId: auth.organizationId,
            campaignId,
            expectedItemId: item.id,
            equipmentId: item.equipmentId,
            type: InventoryAnomalyType.MISSING,
            expectedSpatialNodeId: item.expectedSpatialNodeId ?? null,
            expectedSnapshot: item.equipmentSnapshot as Prisma.InputJsonValue,
            notes: "Equipement attendu non observe a la cloture"
          }))
        });
      }
      const [observationsCount, anomaliesCount] = await Promise.all([
        tx.inventoryObservation.count({ where: { campaignId } }),
        tx.inventoryAnomaly.count({ where: { campaignId } })
      ]);
      await tx.inventoryCampaign.update({
        where: {
          id: campaignId
        },
        data: {
          status: InventoryCampaignStatus.CLOSED,
          closedAt: new Date(),
          observationsCount,
          anomaliesCount
        }
      });
      await this.auditService.log({
        db: tx,
        organizationId: auth.organizationId,
        userId: auth.sub,
        action: "inventory_campaign.closed",
        entityType: "inventory_campaign",
        entityId: campaignId,
        metadata: {
          missingCount: missingItems.length
        }
      });
    });
    return this.detail(auth.organizationId, campaignId);
  }

  async archive(auth: AuthenticatedUser, campaignId: string) {
    const campaign = await this.findCampaign(auth.organizationId, campaignId);
    if (campaign.status === InventoryCampaignStatus.OPEN) {
      throw new BadRequestException("Une campagne ouverte doit etre cloturee avant archivage");
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.inventoryCampaign.update({
        where: {
          id: campaignId
        },
        data: {
          status: InventoryCampaignStatus.ARCHIVED,
          archivedAt: new Date()
        }
      });
      await this.auditService.log({
        db: tx,
        organizationId: auth.organizationId,
        userId: auth.sub,
        action: "inventory_campaign.archived",
        entityType: "inventory_campaign",
        entityId: campaignId
      });
    });
    return this.detail(auth.organizationId, campaignId);
  }

  async sync(auth: AuthenticatedUser, campaignId: string, input: InventoryCampaignSyncInput): Promise<InventoryCampaignSyncResponse> {
    const campaign = await this.findCampaign(auth.organizationId, campaignId);
    if (campaign.status !== InventoryCampaignStatus.OPEN) {
      throw new BadRequestException("La campagne n est pas ouverte");
    }
    if (!input.clientBatchId?.trim()) {
      throw new BadRequestException("clientBatchId obligatoire");
    }
    if (!input.activeSpatialNodeId) {
      throw new BadRequestException("Le scan du noeud spatial est obligatoire avant les equipements");
    }
    const activeNodeIds = new Set(
      input.observations.map((observation) => observation.activeSpatialNodeId ?? input.activeSpatialNodeId).filter(Boolean) as string[]
    );
    for (const activeNodeId of activeNodeIds) {
      await this.ensureNodeInCampaign(auth.organizationId, campaign, activeNodeId);
    }

    const existingBatch = await this.prisma.inventorySyncBatch.findFirst({
      where: {
        campaignId,
        clientBatchId: input.clientBatchId
      }
    });
    if (existingBatch) {
      const observations = await this.prisma.inventoryObservation.findMany({
        where: {
          syncBatchId: existingBatch.id
        },
        include: {
          equipment: true,
          observedSpatialNode: true,
          createdBy: true
        }
      });
      return {
        batchId: existingBatch.id,
        accepted: 0,
        duplicates: observations.length,
        observations: observations.map((observation) => this.mapObservation(observation))
      };
    }

    const createdObservations = await this.prisma.$transaction(async (tx) => {
      const batch = await tx.inventorySyncBatch.create({
        data: {
          organizationId: auth.organizationId,
          campaignId,
          userId: auth.sub,
          activeSpatialNodeId: input.activeSpatialNodeId ?? null,
          clientBatchId: input.clientBatchId,
          payload: input as unknown as Prisma.InputJsonValue
        }
      });

      const created: Array<Prisma.InventoryObservationGetPayload<{
        include: {
          equipment: true;
          observedSpatialNode: true;
          createdBy: true;
        };
      }>> = [];
      for (const observationInput of input.observations) {
        const duplicate = await tx.inventoryObservation.findFirst({
          where: {
            campaignId,
            clientObservationId: observationInput.clientObservationId
          },
          include: {
            equipment: true,
            observedSpatialNode: true,
            createdBy: true
          }
        });
        if (duplicate) {
          created.push(duplicate);
          continue;
        }

        const decision = await this.decideObservation(tx, auth.organizationId, campaign, {
          scannedPayload: observationInput.scannedPayload,
          activeSpatialNodeId: observationInput.activeSpatialNodeId ?? input.activeSpatialNodeId ?? null
        });
        const observedSpatialNodeId = observationInput.activeSpatialNodeId ?? input.activeSpatialNodeId ?? null;
        const observation = await tx.inventoryObservation.create({
          data: {
            organizationId: auth.organizationId,
            campaignId,
            expectedItemId: decision.expectedItemId,
            equipmentId: decision.equipmentId,
            observedSpatialNodeId,
            syncBatchId: batch.id,
            clientObservationId: observationInput.clientObservationId,
            scannedPayload: observationInput.scannedPayload,
            scannedCode: decision.scannedCode,
            scanSource: this.scanSourceOrNull(observationInput.scanSource),
            deviceHint: this.optional(observationInput.deviceHint),
            result: decision.result,
            comment: this.optional(observationInput.comment),
            clientObservedAt: this.dateOrNull(observationInput.clientObservedAt),
            observedAt: this.dateOrNow(observationInput.observedAt ?? observationInput.clientObservedAt),
            createdById: auth.sub
          },
          include: {
            equipment: true,
            observedSpatialNode: true,
            createdBy: true
          }
        });
        created.push(observation);
        if (decision.expectedItemId && decision.result !== InventoryObservationResult.DUPLICATE) {
          await tx.inventoryCampaignExpectedItem.update({
            where: {
              id: decision.expectedItemId
            },
            data: {
              isSeen: true,
              seenAt: observation.observedAt
            }
          });
        }
        if (decision.result !== InventoryObservationResult.MATCH) {
          await tx.inventoryAnomaly.create({
            data: {
              organizationId: auth.organizationId,
              campaignId,
              observationId: observation.id,
              expectedItemId: decision.expectedItemId,
              equipmentId: decision.equipmentId,
              type: decision.result as unknown as InventoryAnomalyType,
              scannedCode: decision.scannedCode,
              expectedSpatialNodeId: decision.expectedSpatialNodeId,
              observedSpatialNodeId,
              expectedSnapshot: decision.expectedSnapshot as Prisma.InputJsonValue | undefined,
              observedSnapshot: decision.observedSnapshot as Prisma.InputJsonValue | undefined,
              notes: decision.message
            }
          });
        }
      }

      const [observationsCount, anomaliesCount] = await Promise.all([
        tx.inventoryObservation.count({ where: { campaignId } }),
        tx.inventoryAnomaly.count({ where: { campaignId } })
      ]);
      await tx.inventoryCampaign.update({
        where: {
          id: campaignId
        },
        data: {
          observationsCount,
          anomaliesCount
        }
      });
      await tx.inventorySyncBatch.update({
        where: {
          id: batch.id
        },
        data: {
          status: "APPLIED",
          result: {
            accepted: created.length
          }
        }
      });
      return {
        batchId: batch.id,
        observations: created
      };
    });

    return {
      batchId: createdObservations.batchId,
      accepted: createdObservations.observations.length,
      duplicates: 0,
      observations: createdObservations.observations.map((observation) => this.mapObservation(observation))
    };
  }

  async completeNode(
    auth: AuthenticatedUser,
    campaignId: string,
    input: CompleteInventoryNodeInput
  ): Promise<CompleteInventoryNodeResult> {
    const campaign = await this.findCampaign(auth.organizationId, campaignId);
    if (campaign.status !== InventoryCampaignStatus.OPEN) {
      throw new BadRequestException("La campagne n est pas ouverte");
    }
    if (!input.spatialNodeId?.trim()) {
      throw new BadRequestException("Noeud spatial obligatoire");
    }
    await this.ensureNodeInCampaign(auth.organizationId, campaign, input.spatialNodeId);
    const missingItems = campaign.expectedItems.filter(
      (item) => item.expectedSpatialNodeId === input.spatialNodeId && !item.isSeen
    );
    const existingMissing = missingItems.length
      ? await this.prisma.inventoryAnomaly.findMany({
          where: {
            campaignId,
            type: InventoryAnomalyType.MISSING,
            expectedItemId: {
              in: missingItems.map((item) => item.id)
            }
          },
          select: {
            expectedItemId: true
          }
        })
      : [];
    const existingMissingIds = new Set(existingMissing.map((item) => item.expectedItemId).filter(Boolean));
    const missingItemsToCreate = missingItems.filter((item) => !existingMissingIds.has(item.id));

    await this.prisma.$transaction(async (tx) => {
      if (missingItemsToCreate.length > 0) {
        await tx.inventoryAnomaly.createMany({
          data: missingItemsToCreate.map((item) => ({
            organizationId: auth.organizationId,
            campaignId,
            expectedItemId: item.id,
            equipmentId: item.equipmentId,
            type: InventoryAnomalyType.MISSING,
            expectedSpatialNodeId: item.expectedSpatialNodeId ?? null,
            expectedSnapshot: item.equipmentSnapshot as Prisma.InputJsonValue,
            notes: "Equipement attendu non observe a la fin de piece",
            createdById: auth.sub
          }))
        });
      }
      const anomaliesCount = await tx.inventoryAnomaly.count({ where: { campaignId } });
      await tx.inventoryCampaign.update({
        where: {
          id: campaignId
        },
        data: {
          anomaliesCount
        }
      });
      await this.auditService.log({
        db: tx,
        organizationId: auth.organizationId,
        userId: auth.sub,
        action: "inventory_campaign.node_completed",
        entityType: "inventory_campaign",
        entityId: campaignId,
        metadata: {
          spatialNodeId: input.spatialNodeId,
          missingCreated: missingItemsToCreate.length,
          missingAlreadyExisting: existingMissingIds.size
        }
      });
    });

    return {
      campaignId,
      spatialNodeId: input.spatialNodeId,
      missingCreated: missingItemsToCreate.length,
      missingAlreadyExisting: existingMissingIds.size
    };
  }

  private validateCampaignInput(input: CreateInventoryCampaignInput) {
    if (!input.name?.trim()) {
      throw new BadRequestException("Le nom de campagne est obligatoire");
    }
    if (!input.scopes || input.scopes.length === 0) {
      throw new BadRequestException("Au moins un perimetre spatial est obligatoire");
    }
  }

  private async ensureSpatialNodes(organizationId: string, ids: string[]) {
    const nodes = await this.prisma.spatialNode.findMany({
      where: {
        organizationId,
        id: {
          in: ids
        }
      }
    });
    if (nodes.length !== new Set(ids).size) {
      throw new BadRequestException("Perimetre spatial invalide");
    }
  }

  private async findCampaign(organizationId: string, campaignId: string) {
    const campaign = await this.prisma.inventoryCampaign.findFirst({
      where: {
        id: campaignId,
        organizationId
      },
      include: campaignInclude
    });
    if (!campaign) {
      throw new NotFoundException("Campagne introuvable");
    }
    return campaign;
  }

  private async collectExpectedEquipments(organizationId: string, campaign: CampaignWithDetails) {
    const scopedEquipments = await this.collectScopedEquipments(organizationId, campaign);
    return scopedEquipments.filter((equipment) => equipment.internalCode.trim().length > 0);
  }

  private async countScopedEquipments(organizationId: string, campaign: CampaignWithDetails) {
    return (await this.collectScopedEquipments(organizationId, campaign)).length;
  }

  private async collectScopedEquipments(organizationId: string, campaign: CampaignWithDetails) {
    const equipments = await this.prisma.equipment.findMany({
      where: {
        organizationId,
        isDeleted: false
      },
      include: equipmentInclude,
      orderBy: {
        internalCode: "asc"
      }
    });
    return equipments.filter((equipment) => this.matchesCampaign(equipment, campaign));
  }

  private matchesCampaign(equipment: EquipmentWithRefs, campaign: CampaignWithDetails) {
    if (!equipment.currentSpatialNode) {
      return false;
    }
    const path = equipment.currentSpatialNode.path;
    const inScope = campaign.scopes.some((scope) => {
      const scopePath = scope.spatialNode.path;
      return scope.includeChildren ? path === scopePath || path.startsWith(`${scopePath}/`) : path === scopePath;
    });
    if (!inScope) {
      return false;
    }
    if (campaign.familyFilters.length === 0) {
      return true;
    }
    return campaign.familyFilters.some((filter) => {
      if (filter.typeId && filter.typeId !== equipment.equipmentTypeId) {
        return false;
      }
      if (filter.subfamilyId && filter.subfamilyId !== equipment.equipmentType.subfamily.id) {
        return false;
      }
      if (filter.familyId && filter.familyId !== equipment.equipmentType.subfamily.family.id) {
        return false;
      }
      if (filter.categoryId && filter.categoryId !== equipment.equipmentType.subfamily.family.category.id) {
        return false;
      }
      return true;
    });
  }

  private snapshotEquipment(equipment: EquipmentWithRefs) {
    return {
      equipmentId: equipment.id,
      internalCode: equipment.internalCode,
      numPiece: equipment.numPiece ?? null,
      externalRef: equipment.externalRef ?? null,
      typeLabel: equipment.equipmentType.label,
      familyLabel: equipment.equipmentType.subfamily.family.label,
      statusLabel: equipment.equipmentStatus.label,
      ownerLabel: equipment.ownerEntity.label,
      immobilizationCode: equipment.immobilization?.code ?? null,
      spatialNodeId: equipment.currentSpatialNodeId ?? null,
      spatialPath: equipment.currentSpatialNode?.path ?? null,
      spatialLabel: equipment.currentSpatialNode?.label ?? null
    };
  }

  private mapSummary(campaign: {
    id: string;
    name: string;
    description: string | null;
    status: InventoryCampaignStatus;
    plannedStartAt: Date | null;
    plannedEndAt: Date | null;
    openedAt: Date | null;
    reviewStartedAt: Date | null;
    closedAt: Date | null;
    archivedAt: Date | null;
    expectedItemsCount: number;
    observationsCount: number;
    anomaliesCount: number;
    createdAt: Date;
    updatedAt: Date;
  }): InventoryCampaignSummary {
    return {
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      status: campaign.status,
      plannedStartAt: campaign.plannedStartAt?.toISOString() ?? null,
      plannedEndAt: campaign.plannedEndAt?.toISOString() ?? null,
      openedAt: campaign.openedAt?.toISOString() ?? null,
      reviewStartedAt: campaign.reviewStartedAt?.toISOString() ?? null,
      closedAt: campaign.closedAt?.toISOString() ?? null,
      archivedAt: campaign.archivedAt?.toISOString() ?? null,
      expectedItemsCount: campaign.expectedItemsCount,
      observationsCount: campaign.observationsCount,
      anomaliesCount: campaign.anomaliesCount,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString()
    };
  }

  private mapDetail(campaign: CampaignWithDetails): InventoryCampaignDetail {
    return {
      ...this.mapSummary(campaign),
      scopes: campaign.scopes.map((scope) => ({
        id: scope.id,
        spatialNodeId: scope.spatialNodeId,
        spatialPath: scope.spatialNode.path,
        spatialLabel: scope.spatialNode.label,
        includeChildren: scope.includeChildren
      })),
      familyFilters: campaign.familyFilters.map((filter) => ({
        categoryId: filter.categoryId,
        familyId: filter.familyId,
        subfamilyId: filter.subfamilyId,
        typeId: filter.typeId
      })),
      expectedItems: campaign.expectedItems.map((item) => this.mapExpectedItem(item)),
      observations: campaign.observations.map((observation) => this.mapObservation(observation))
    };
  }

  private mapExpectedFromEquipment(equipment: EquipmentWithRefs): InventoryExpectedItemSummary {
    return {
      id: equipment.id,
      equipmentId: equipment.id,
      internalCode: equipment.internalCode,
      label: equipment.equipmentModel?.label ?? equipment.equipmentType.label,
      familyLabel: equipment.equipmentType.subfamily.family.label,
      typeLabel: equipment.equipmentType.label,
      statusLabel: equipment.equipmentStatus.label,
      ownerLabel: equipment.ownerEntity.label,
      immobilizationCode: equipment.immobilization?.code ?? null,
      expectedSpatialNodeId: equipment.currentSpatialNodeId ?? null,
      expectedSpatialPath: equipment.currentSpatialNode?.path ?? null,
      isSeen: false,
      seenAt: null
    };
  }

  private mapExpectedItem(item: CampaignWithDetails["expectedItems"][number]): InventoryExpectedItemSummary {
    return {
      id: item.id,
      equipmentId: item.equipmentId,
      internalCode: item.equipment.internalCode,
      label: item.equipment.equipmentModel?.label ?? item.equipment.equipmentType.label,
      familyLabel: item.equipment.equipmentType.subfamily.family.label,
      typeLabel: item.equipment.equipmentType.label,
      statusLabel: item.equipment.equipmentStatus.label,
      ownerLabel: item.equipment.ownerEntity.label,
      immobilizationCode: item.equipment.immobilization?.code ?? null,
      expectedSpatialNodeId: item.expectedSpatialNodeId ?? null,
      expectedSpatialPath: item.expectedSpatialPath ?? item.expectedSpatialNode?.path ?? null,
      isSeen: item.isSeen,
      seenAt: item.seenAt?.toISOString() ?? null
    };
  }

  private mapObservation(observation: {
    id: string;
    campaignId: string;
    clientObservationId: string;
    scannedPayload: string;
    scannedCode: string | null;
    scanSource?: ScanSource | null;
    deviceHint?: string | null;
    result: InventoryObservationResult;
    equipmentId: string | null;
    equipment?: { internalCode: string } | null;
    observedSpatialNodeId: string | null;
    observedSpatialNode?: { path: string } | null;
    comment: string | null;
    clientObservedAt?: Date | null;
    observedAt: Date;
    createdBy?: { name: string | null } | null;
  }): InventoryObservationSummary {
    return {
      id: observation.id,
      campaignId: observation.campaignId,
      clientObservationId: observation.clientObservationId,
      scannedPayload: observation.scannedPayload,
      scannedCode: observation.scannedCode,
      scanSource: observation.scanSource ?? null,
      deviceHint: observation.deviceHint ?? null,
      result: observation.result,
      equipmentId: observation.equipmentId,
      equipmentInternalCode: observation.equipment?.internalCode ?? null,
      observedSpatialNodeId: observation.observedSpatialNodeId,
      observedSpatialPath: observation.observedSpatialNode?.path ?? null,
      comment: observation.comment,
      clientObservedAt: observation.clientObservedAt?.toISOString() ?? null,
      observedAt: observation.observedAt.toISOString(),
      createdByName: observation.createdBy?.name ?? null
    };
  }

  private async decideObservation(
    db: DbClient,
    organizationId: string,
    campaign: CampaignWithDetails,
    input: { scannedPayload: string; activeSpatialNodeId: string | null }
  ) {
    const scannedCode = this.extractEquipmentCode(input.scannedPayload);
    if (!scannedCode) {
      return {
        result: InventoryObservationResult.UNKNOWN_CODE,
        scannedCode: input.scannedPayload,
        equipmentId: null,
        expectedItemId: null,
        expectedSpatialNodeId: null,
        expectedSnapshot: undefined,
        observedSnapshot: { scannedPayload: input.scannedPayload },
        message: "Payload equipement invalide"
      };
    }
    const equipment = await db.equipment.findFirst({
      where: {
        organizationId,
        internalCode: scannedCode,
        isDeleted: false
      },
      include: equipmentInclude
    });
    if (!equipment) {
      return {
        result: InventoryObservationResult.UNKNOWN_CODE,
        scannedCode,
        equipmentId: null,
        expectedItemId: null,
        expectedSpatialNodeId: null,
        expectedSnapshot: undefined,
        observedSnapshot: { scannedCode },
        message: "Code equipement inconnu"
      };
    }

    const duplicate = await db.inventoryObservation.findFirst({
      where: {
        campaignId: campaign.id,
        equipmentId: equipment.id
      }
    });
    const expectedItem = await db.inventoryCampaignExpectedItem.findFirst({
      where: {
        campaignId: campaign.id,
        equipmentId: equipment.id
      }
    });
    if (duplicate) {
      return {
        result: InventoryObservationResult.DUPLICATE,
        scannedCode,
        equipmentId: equipment.id,
        expectedItemId: expectedItem?.id ?? null,
        expectedSpatialNodeId: expectedItem?.expectedSpatialNodeId ?? null,
        expectedSnapshot: expectedItem?.equipmentSnapshot ?? this.snapshotEquipment(equipment),
        observedSnapshot: this.snapshotEquipment(equipment),
        message: "Equipement deja observe dans cette campagne"
      };
    }
    if (!expectedItem) {
      return {
        result: InventoryObservationResult.OUT_OF_SCOPE,
        scannedCode,
        equipmentId: equipment.id,
        expectedItemId: null,
        expectedSpatialNodeId: equipment.currentSpatialNodeId ?? null,
        expectedSnapshot: this.snapshotEquipment(equipment),
        observedSnapshot: this.snapshotEquipment(equipment),
        message: "Equipement hors perimetre de campagne"
      };
    }
    const result =
      expectedItem.expectedSpatialNodeId === input.activeSpatialNodeId
        ? InventoryObservationResult.MATCH
        : InventoryObservationResult.WRONG_LOCATION;
    return {
      result,
      scannedCode,
      equipmentId: equipment.id,
      expectedItemId: expectedItem.id,
      expectedSpatialNodeId: expectedItem.expectedSpatialNodeId ?? null,
      expectedSnapshot: expectedItem.equipmentSnapshot,
      observedSnapshot: {
        ...this.snapshotEquipment(equipment),
        observedSpatialNodeId: input.activeSpatialNodeId
      },
      message: result === InventoryObservationResult.MATCH ? "Equipement conforme" : "Equipement observe dans une autre localisation"
    };
  }

  private extractEquipmentCode(payload: string) {
    const trimmed = payload.trim();
    if (trimmed.startsWith("EQ:")) {
      return trimmed.slice(3).trim();
    }
    return trimmed.length > 0 ? trimmed : null;
  }

  private async ensureNodeInCampaign(organizationId: string, campaign: CampaignWithDetails, activeSpatialNodeId: string) {
    const node = await this.prisma.spatialNode.findFirst({
      where: {
        id: activeSpatialNodeId,
        organizationId,
        isActive: true
      }
    });
    if (!node) {
      throw new BadRequestException("Noeud spatial scanne inconnu");
    }
    const scopePaths = campaign.scopes.map((scope) => ({
      path: scope.spatialNode.path,
      includeChildren: scope.includeChildren
    }));
    const allowed = scopePaths.some((scope) =>
      scope.includeChildren ? node.path === scope.path || node.path.startsWith(`${scope.path}/`) : node.path === scope.path
    );
    if (!allowed) {
      throw new BadRequestException("Noeud spatial hors perimetre de campagne");
    }
  }

  private optional(value?: string | null) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private dateOrNull(value?: string | null) {
    if (!value) {
      return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException("Date invalide");
    }
    return date;
  }

  private dateOrNow(value?: string | null) {
    return this.dateOrNull(value) ?? new Date();
  }

  private scanSourceOrNull(value?: ScanSource | null) {
    if (!value) {
      return null;
    }
    if (!["CAMERA", "HID", "MANUAL"].includes(value)) {
      throw new BadRequestException("Source de scan invalide");
    }
    return value;
  }
}
