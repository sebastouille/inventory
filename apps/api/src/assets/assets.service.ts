import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  AssetAssignableUser,
  AssetAssignmentSummary,
  AssetDetail,
  AssetHistoryEntry,
  AssetListItem,
  ImmobilizationSummary,
  SpatialNodeType
} from "@inventory/shared";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { buildOdsExport } from "../common/ods-export";
import { matchesSearchTerm, normalizeSearchTerm, paginateItems, sortItems } from "../common/listing";
import { EquipmentMovementsService } from "../equipment-movements/equipment-movements.service";
import { PrismaService } from "../prisma.service";
import { AssetsRepository } from "./assets.repository";
import { CreateAssetDto } from "./dto/create-asset.dto";
import { ListAssetsDto } from "./dto/list-assets.dto";
import { UpdateAssetDto } from "./dto/update-asset.dto";

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly equipmentMovementsService: EquipmentMovementsService,
    private readonly assetsRepository: AssetsRepository
  ) {}

  private isAssignmentActive(assignment: { endsAt: Date | null }) {
    return !assignment.endsAt || assignment.endsAt.getTime() > Date.now();
  }

  private mapAssignment(assignment: Awaited<ReturnType<AssetsRepository["findById"]>> extends infer T
    ? T extends { assignments: infer A }
      ? A extends Array<infer I>
        ? I
        : never
      : never
    : never): AssetAssignmentSummary {
    return {
      id: assignment.id,
      assignmentType: assignment.assignmentType,
      targetUserId: assignment.targetUserId ?? null,
      targetUserName: assignment.targetUser?.name ?? null,
      targetUserEmail: assignment.targetUser?.email ?? null,
      targetPersonName: assignment.targetPersonName ?? null,
      targetLocationId: assignment.targetLocationId ?? null,
      targetLocationLabel: assignment.targetLocation?.name ?? null,
      targetEquipmentId: assignment.targetEquipmentId ?? null,
      targetEquipmentInternalCode: assignment.targetEquipment?.internalCode ?? null,
      targetEquipmentLabel:
        assignment.targetEquipment?.equipmentModel?.label ??
        assignment.targetEquipment?.equipmentType.label ??
        null,
      startsAt: assignment.startsAt.toISOString(),
      endsAt: assignment.endsAt?.toISOString() ?? null,
      notes: assignment.notes ?? null,
      isActive: this.isAssignmentActive(assignment)
    };
  }

  private mapAsset(asset: NonNullable<Awaited<ReturnType<AssetsRepository["findById"]>>>): AssetDetail {
    const assignments = asset.assignments.map((assignment) => this.mapAssignment(assignment));
    const immobilization: ImmobilizationSummary | null = asset.immobilization
      ? {
          id: asset.immobilization.id,
          code: asset.immobilization.code,
          label: asset.immobilization.label,
          description: asset.immobilization.description ?? null,
          status: asset.immobilization.status ?? null,
          costCenter: asset.immobilization.costCenter ?? null,
          purchaseValue: asset.immobilization.purchaseValue?.toFixed(2) ?? null,
          purchaseDate: asset.immobilization.purchaseDate?.toISOString() ?? null,
          serviceStartAt: asset.immobilization.serviceStartAt?.toISOString() ?? null,
          sourceSystem: asset.immobilization.sourceSystem ?? null,
          externalRef: asset.immobilization.externalRef ?? null,
          isActive: asset.immobilization.isActive,
          equipmentsCount: asset.immobilization._count.equipments,
          createdAt: asset.immobilization.createdAt.toISOString(),
          updatedAt: asset.immobilization.updatedAt.toISOString()
        }
      : null;
    return {
      id: asset.id,
      internalCode: asset.internalCode,
      numPiece: asset.numPiece ?? null,
      externalRef: asset.externalRef ?? null,
      serialNumber: asset.serialNumber,
      isDeleted: asset.isDeleted,
      currentSpatialNodeId: asset.currentSpatialNodeId ?? null,
      currentSpatialPath: asset.currentSpatialNode?.path ?? null,
      currentSpatialLabel: asset.currentSpatialNode?.label ?? null,
      currentSpatialType: (asset.currentSpatialNode?.type as SpatialNodeType | undefined) ?? null,
      immobilizationId: asset.immobilizationId ?? null,
      immobilizationCode: asset.immobilization?.code ?? null,
      immobilizationLabel: asset.immobilization?.label ?? null,
      createdAt: asset.createdAt.toISOString(),
      updatedAt: asset.updatedAt.toISOString(),
      technicalCharacteristics: asset.technicalCharacteristics ?? null,
      notes: asset.notes ?? null,
      receivedAt: asset.receivedAt?.toISOString() ?? null,
      commissionedAt: asset.commissionedAt?.toISOString() ?? null,
      lastInventoryAt: asset.lastInventoryAt?.toISOString() ?? null,
      initializedByImportJobId: asset.initializedByImportJobId ?? null,
      deletedAt: asset.deletedAt?.toISOString() ?? null,
      equipmentType: {
        id: asset.equipmentType.id,
        code: asset.equipmentType.code,
        label: asset.equipmentType.label,
        familyId: asset.equipmentType.subfamily.family.id,
        familyLabel: asset.equipmentType.subfamily.family.label,
        subfamilyId: asset.equipmentType.subfamily.id,
        subfamilyLabel: asset.equipmentType.subfamily.label
      },
      equipmentModel: asset.equipmentModel
        ? {
            id: asset.equipmentModel.id,
            code: asset.equipmentModel.code,
            label: asset.equipmentModel.label,
            brandId: asset.equipmentModel.brand.id,
            brandLabel: asset.equipmentModel.brand.label,
            isGeneric: asset.equipmentModel.isGeneric
          }
        : null,
      equipmentStatus: {
        id: asset.equipmentStatus.id,
        code: asset.equipmentStatus.code,
        label: asset.equipmentStatus.label
      },
      ownerEntity: {
        id: asset.ownerEntity.id,
        code: asset.ownerEntity.code,
        label: asset.ownerEntity.label
      },
      immobilization,
      activeAssignments: assignments.filter((assignment) => assignment.isActive),
      assignments
    };
  }

  private dedupeAssignments(assignments: CreateAssetDto["assignments"] = []) {
    const seen = new Set<string>();
    for (const assignment of assignments) {
      const key = assignment.assignmentType;
      if (seen.has(key)) {
        throw new BadRequestException("Only one active assignment per type is allowed");
      }
      seen.add(key);
    }
  }

  private normalizeDate(value?: string | null) {
    if (!value) {
      return undefined;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException("Invalid assignment date");
    }
    return date;
  }

  private normalizeOptionalString(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private async validateReferenceIds(organizationId: string, dto: CreateAssetDto) {
    const [type, model, status, owner, currentSpatialNode, immobilization] = await Promise.all([
      this.assetsRepository.findEquipmentType(organizationId, dto.equipmentTypeId),
      dto.equipmentModelId ? this.assetsRepository.findEquipmentModel(organizationId, dto.equipmentModelId) : null,
      this.assetsRepository.findEquipmentStatus(organizationId, dto.equipmentStatusId),
      this.assetsRepository.findOwnerEntity(organizationId, dto.ownerEntityId),
      dto.currentSpatialNodeId
        ? this.assetsRepository.findSpatialNodeById(organizationId, dto.currentSpatialNodeId)
        : null,
      dto.immobilizationId ? this.assetsRepository.findImmobilizationById(organizationId, dto.immobilizationId) : null
    ]);

    if (!type || !type.isActive) {
      throw new BadRequestException("Unknown equipment type");
    }
    if (dto.equipmentModelId && (!model || !model.isActive)) {
      throw new BadRequestException("Unknown equipment model");
    }
    if (!status || !status.isActive) {
      throw new BadRequestException("Unknown equipment status");
    }
    if (!owner || !owner.isActive) {
      throw new BadRequestException("Unknown owner entity");
    }
    if (dto.currentSpatialNodeId && (!currentSpatialNode || !currentSpatialNode.isActive)) {
      throw new BadRequestException("Unknown spatial node");
    }
    if (dto.immobilizationId && !immobilization) {
      throw new BadRequestException("Unknown immobilization");
    }

    return {
      type,
      model,
      status,
      owner,
      currentSpatialNode,
      immobilization
    };
  }

  private async validateAssignments(
    organizationId: string,
    equipmentTypeId: string,
    assignments: CreateAssetDto["assignments"] = [],
    currentAssetId?: string
  ) {
    this.dedupeAssignments(assignments);

    const userIds = Array.from(
      new Set(
        assignments
          .map((assignment) => assignment.targetUserId ?? null)
          .filter((value): value is string => Boolean(value))
      )
    );
    const targetAssetIds = Array.from(
      new Set(
        assignments
          .map((assignment) => assignment.targetEquipmentId ?? null)
          .filter((value): value is string => Boolean(value))
      )
    );

    const [sourceType, users, targetAssets] = await Promise.all([
      this.assetsRepository.findEquipmentType(organizationId, equipmentTypeId),
      userIds.length ? this.assetsRepository.findUsersByIds(organizationId, userIds) : [],
      targetAssetIds.length ? this.assetsRepository.findByIds(organizationId, targetAssetIds) : []
    ]);

    if (!sourceType) {
      throw new BadRequestException("Unknown equipment type");
    }

    if (users.length !== userIds.length) {
      throw new BadRequestException("Unknown assignment user");
    }
    if (targetAssets.length !== targetAssetIds.length) {
      throw new BadRequestException("Unknown assignment asset");
    }

    const sourceFamilyId = sourceType.subfamily.family.id;
    const usersSet = new Set(users.map((item) => item.id));
    const usersById = new Map(users.map((item) => [item.id, item]));
    const targetAssetsMap = new Map(targetAssets.map((item) => [item.id, item]));

    for (const assignment of assignments) {
      const startsAt = this.normalizeDate(assignment.startsAt);
      const endsAt = this.normalizeDate(assignment.endsAt);
      if (startsAt && endsAt && endsAt.getTime() < startsAt.getTime()) {
        throw new BadRequestException("Assignment end date must be after start date");
      }

      if (assignment.assignmentType === "PERSON") {
        if (!assignment.targetUserId && !assignment.targetPersonName) {
          throw new BadRequestException("Person assignment requires a user or a free name");
        }
        if (assignment.targetUserId && !usersSet.has(assignment.targetUserId)) {
          throw new BadRequestException("Unknown assignment user");
        }
      }

      if (assignment.assignmentType === "LOCATION") {
        throw new BadRequestException("Location assignment is legacy only");
      }

      if (assignment.assignmentType === "ASSET") {
        if (!assignment.targetEquipmentId) {
          throw new BadRequestException("Asset assignment requires a target asset");
        }
        if (assignment.targetEquipmentId === currentAssetId) {
          throw new BadRequestException("An asset cannot be attached to itself");
        }
        const targetAsset = targetAssetsMap.get(assignment.targetEquipmentId);
        if (!targetAsset || targetAsset.isDeleted) {
          throw new BadRequestException("Unknown assignment asset");
        }
        const targetFamilyId = targetAsset.equipmentType.subfamily.family.id;
        const rule = await this.assetsRepository.findActiveAttachmentRule(
          organizationId,
          sourceFamilyId,
          targetFamilyId
        );
        if (!rule) {
          throw new BadRequestException("Asset attachment is not allowed for these families");
        }
      }
    }

    return assignments.map((assignment) => ({
      assignmentType: assignment.assignmentType,
      targetUserId: assignment.targetUserId ?? null,
      targetPersonName:
        assignment.targetPersonName ??
        (assignment.targetUserId ? usersById.get(assignment.targetUserId)?.name ?? null : null),
      targetLocationId: null,
      targetEquipmentId: assignment.targetEquipmentId ?? null,
      startsAt: this.normalizeDate(assignment.startsAt),
      endsAt: this.normalizeDate(assignment.endsAt) ?? null,
      notes: assignment.notes ?? null
    }));
  }

  private async getAssetListItems(organizationId: string, query: ListAssetsDto) {
    const assets = await this.assetsRepository.listByOrganization(organizationId);
    const search = normalizeSearchTerm(query.q);
    const mapped: AssetListItem[] = assets
      .map((asset) => this.mapAsset(asset))
      .filter((asset) => {
        if (query.isArchived && String(asset.isDeleted) !== query.isArchived) {
          return false;
        }
        if (query.familyId && asset.equipmentType.familyId !== query.familyId) {
          return false;
        }
        if (query.subfamilyId && asset.equipmentType.subfamilyId !== query.subfamilyId) {
          return false;
        }
        if (query.typeId && asset.equipmentType.id !== query.typeId) {
          return false;
        }
        if (query.statusId && asset.equipmentStatus.id !== query.statusId) {
          return false;
        }
        if (query.ownerEntityId && asset.ownerEntity.id !== query.ownerEntityId) {
          return false;
        }
        if (query.immobilizationId && asset.immobilizationId !== query.immobilizationId) {
          return false;
        }
        if (
          query.locationId &&
          asset.currentSpatialNodeId !== query.locationId
        ) {
          return false;
        }

        return matchesSearchTerm(search, [
          asset.internalCode,
          asset.numPiece,
          asset.externalRef,
          asset.serialNumber,
          asset.currentSpatialLabel,
          asset.currentSpatialPath,
          asset.equipmentType.label,
          asset.equipmentType.familyLabel,
          asset.equipmentType.subfamilyLabel,
          asset.equipmentModel?.label,
          asset.ownerEntity.label,
          asset.equipmentStatus.label,
          asset.immobilizationCode,
          asset.immobilizationLabel
        ]);
      });

    return sortItems(
      mapped,
      {
        internalCode: (item: AssetListItem) => item.internalCode,
        serialNumber: (item: AssetListItem) => item.serialNumber,
        createdAt: (item: AssetListItem) => item.createdAt,
        updatedAt: (item: AssetListItem) => item.updatedAt,
        statusLabel: (item: AssetListItem) => item.equipmentStatus.label,
        ownerLabel: (item: AssetListItem) => item.ownerEntity.label,
        immobilizationCode: (item: AssetListItem) => item.immobilizationCode
      }[query.sort ?? "createdAt"],
      query.direction ?? "asc"
    );
  }

  async list(organizationId: string, query: ListAssetsDto) {
    const items = await this.getAssetListItems(organizationId, query);
    return paginateItems(items, query.page, query.pageSize);
  }

  async export(organizationId: string, query: ListAssetsDto) {
    const items = await this.getAssetListItems(organizationId, query);
    const buffer = buildOdsExport(
      "Equipements",
      items.map((item) => ({
        CodeInterne: item.internalCode,
        NumPiece: item.numPiece ?? "",
        ReferenceExterne: item.externalRef ?? "",
        NumeroSerie: item.serialNumber,
        Type: item.equipmentType.label,
        Famille: item.equipmentType.familyLabel,
        SousFamille: item.equipmentType.subfamilyLabel,
        Modele: item.equipmentModel?.label ?? "",
        Statut: item.equipmentStatus.label,
        Proprietaire: item.ownerEntity.label,
        Immobilisation: item.immobilizationCode
          ? `${item.immobilizationCode} - ${item.immobilizationLabel ?? ""}`.trim()
          : "",
        Localisation: item.currentSpatialLabel ?? "",
        Archive: item.isDeleted ? "Oui" : "Non"
      }))
    );

    return {
      buffer,
      filename: "equipements.ods"
    };
  }

  async create(auth: AuthenticatedUser, dto: CreateAssetDto) {
    const referenceState = await this.validateReferenceIds(auth.organizationId, dto);
    const normalizedAssignments = await this.validateAssignments(
      auth.organizationId,
      dto.equipmentTypeId,
      dto.assignments ?? []
    );

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const asset = await this.assetsRepository.createAsset(tx, {
          organizationId: auth.organizationId,
          internalCode: dto.internalCode.trim(),
          numPiece: this.normalizeOptionalString(dto.numPiece),
          externalRef: this.normalizeOptionalString(dto.externalRef),
          serialNumber: this.normalizeOptionalString(dto.serialNumber),
          equipmentTypeId: referenceState.type.id,
          equipmentModelId: referenceState.model?.id ?? null,
          equipmentStatusId: referenceState.status.id,
          ownerEntityId: referenceState.owner.id,
          currentSpatialNodeId: referenceState.currentSpatialNode?.id ?? null,
          immobilizationId: referenceState.immobilization?.id ?? null,
          technicalCharacteristics: dto.technicalCharacteristics ?? null,
          notes: dto.notes ?? null,
          receivedAt: this.normalizeDate(dto.receivedAt) ?? null,
          commissionedAt: this.normalizeDate(dto.commissionedAt) ?? null,
          lastInventoryAt: this.normalizeDate(dto.lastInventoryAt) ?? null
        });

        await this.assetsRepository.replaceAssignments(tx, auth.organizationId, asset.id, normalizedAssignments);
        const createdAssetState = await this.assetsRepository.findByIdWithClient(tx, auth.organizationId, asset.id);
        if (createdAssetState) {
          await this.equipmentMovementsService.recordForAssetMutation(tx, {
            organizationId: auth.organizationId,
            equipmentId: asset.id,
            createdById: auth.sub,
            source: "USER",
            triggerType: "EQUIPMENT_CREATED",
            before: null,
            after: createdAssetState
          });
        }

        await this.auditService.log({
          db: tx,
          organizationId: auth.organizationId,
          userId: auth.sub,
          action: "assets.created",
          entityType: "equipment",
          entityId: asset.id,
          metadata: {
            internalCode: dto.internalCode,
            numPiece: dto.numPiece ?? null,
            externalRef: dto.externalRef ?? null,
            serialNumber: dto.serialNumber ?? null,
            currentSpatialNodeId: referenceState.currentSpatialNode?.id ?? null,
            immobilizationId: referenceState.immobilization?.id ?? null
          }
        });

        if (normalizedAssignments.length > 0) {
          await this.auditService.log({
            db: tx,
            organizationId: auth.organizationId,
            userId: auth.sub,
            action: "assets.assignments.replaced",
            entityType: "equipment_assignment",
            entityId: asset.id,
            metadata: {
              assignments: normalizedAssignments as unknown as Prisma.InputJsonValue
            }
          });
        }

        return asset.id;
      });

      const asset = await this.assetsRepository.findById(auth.organizationId, created);
      if (!asset) {
        throw new NotFoundException("Created asset not found");
      }
      return this.mapAsset(asset);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("A critical unique field is already in use");
      }
      throw error;
    }
  }

  async getDetail(organizationId: string, assetId: string) {
    const asset = await this.assetsRepository.findById(organizationId, assetId);
    if (!asset) {
      throw new NotFoundException("Asset not found");
    }
    return this.mapAsset(asset);
  }

  async update(auth: AuthenticatedUser, assetId: string, dto: UpdateAssetDto) {
    const existing = await this.assetsRepository.findById(auth.organizationId, assetId);
    if (!existing) {
      throw new NotFoundException("Asset not found");
    }

    const referenceState = await this.validateReferenceIds(auth.organizationId, dto);
    const normalizedAssignments = await this.validateAssignments(
      auth.organizationId,
      dto.equipmentTypeId,
      dto.assignments ?? [],
      assetId
    );

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.assetsRepository.updateAsset(tx, auth.organizationId, assetId, {
          internalCode: dto.internalCode.trim(),
          numPiece: this.normalizeOptionalString(dto.numPiece),
          externalRef: this.normalizeOptionalString(dto.externalRef),
          serialNumber: this.normalizeOptionalString(dto.serialNumber),
          equipmentTypeId: referenceState.type.id,
          equipmentModelId: referenceState.model?.id ?? null,
          equipmentStatusId: referenceState.status.id,
          ownerEntityId: referenceState.owner.id,
          currentSpatialNodeId: referenceState.currentSpatialNode?.id ?? null,
          immobilizationId: referenceState.immobilization?.id ?? null,
          technicalCharacteristics: dto.technicalCharacteristics ?? null,
          notes: dto.notes ?? null,
          receivedAt: this.normalizeDate(dto.receivedAt) ?? null,
          commissionedAt: this.normalizeDate(dto.commissionedAt) ?? null,
          lastInventoryAt: this.normalizeDate(dto.lastInventoryAt) ?? null
        });

        await this.assetsRepository.replaceAssignments(tx, auth.organizationId, assetId, normalizedAssignments);
        const updatedAssetState = await this.assetsRepository.findByIdWithClient(tx, auth.organizationId, assetId);
        if (updatedAssetState) {
          await this.equipmentMovementsService.recordForAssetMutation(tx, {
            organizationId: auth.organizationId,
            equipmentId: assetId,
            createdById: auth.sub,
            source: "USER",
            triggerType: "EQUIPMENT_UPDATED",
            before: existing,
            after: updatedAssetState
          });
        }

        await this.auditService.log({
          db: tx,
          organizationId: auth.organizationId,
          userId: auth.sub,
          action: "assets.updated",
          entityType: "equipment",
          entityId: assetId,
          metadata: {
            before: {
              internalCode: existing.internalCode,
              numPiece: existing.numPiece ?? null,
              externalRef: existing.externalRef ?? null,
              serialNumber: existing.serialNumber,
              currentSpatialNodeId: existing.currentSpatialNodeId,
              immobilizationId: existing.immobilizationId
            } as Prisma.InputJsonValue,
            after: {
              internalCode: dto.internalCode,
              numPiece: dto.numPiece ?? null,
              externalRef: dto.externalRef ?? null,
              serialNumber: dto.serialNumber ?? null,
              currentSpatialNodeId: referenceState.currentSpatialNode?.id ?? null,
              immobilizationId: referenceState.immobilization?.id ?? null
            } as Prisma.InputJsonValue
          }
        });

        await this.auditService.log({
          db: tx,
          organizationId: auth.organizationId,
          userId: auth.sub,
          action: "assets.assignments.replaced",
          entityType: "equipment_assignment",
          entityId: assetId,
          metadata: {
            assignments: normalizedAssignments as unknown as Prisma.InputJsonValue
          }
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("A critical unique field is already in use");
      }
      throw error;
    }

    const updated = await this.assetsRepository.findById(auth.organizationId, assetId);
    if (!updated) {
      throw new NotFoundException("Updated asset not found");
    }
    return this.mapAsset(updated);
  }

  async archive(auth: AuthenticatedUser, assetId: string) {
    const existing = await this.assetsRepository.findById(auth.organizationId, assetId);
    if (!existing) {
      throw new NotFoundException("Asset not found");
    }

    await this.prisma.$transaction(async (tx) => {
      await this.assetsRepository.archiveAsset(tx, assetId);
      await tx.equipmentAssignment.updateMany({
        where: {
          organizationId: auth.organizationId,
          equipmentId: assetId,
          endsAt: null
        },
        data: {
          endsAt: new Date()
        }
      });

      await this.auditService.log({
        db: tx,
        organizationId: auth.organizationId,
        userId: auth.sub,
        action: "assets.archived",
        entityType: "equipment",
        entityId: assetId,
        metadata: {
          internalCode: existing.internalCode
        }
      });

      await this.auditService.log({
        db: tx,
        organizationId: auth.organizationId,
        userId: auth.sub,
        action: "assets.assignments.closed",
        entityType: "equipment_assignment",
        entityId: assetId,
        metadata: {
          reason: "asset archived"
        }
      });
    });

    const archived = await this.assetsRepository.findById(auth.organizationId, assetId);
    if (!archived) {
      throw new NotFoundException("Archived asset not found");
    }
    return this.mapAsset(archived);
  }

  async history(organizationId: string, assetId: string): Promise<AssetHistoryEntry[]> {
    const asset = await this.assetsRepository.findById(organizationId, assetId);
    if (!asset) {
      throw new NotFoundException("Asset not found");
    }
    const history = await this.assetsRepository.listHistory(organizationId, assetId);
    return history.map((entry) => ({
      id: entry.id,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      createdAt: entry.createdAt.toISOString(),
      userName: entry.user?.name ?? null,
      userEmail: entry.user?.email ?? null,
      metadata: entry.metadata ?? null
    }));
  }

  async listAssignableUsers(organizationId: string): Promise<AssetAssignableUser[]> {
    const users = await this.assetsRepository.listAssignableUsers(organizationId);
    return users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name
    }));
  }
}
