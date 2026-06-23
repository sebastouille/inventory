import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  ImmobilizationDetail,
  ImmobilizationEquipmentSummary,
  ImmobilizationSummary
} from "@inventory/shared";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { matchesSearchTerm, normalizeSearchTerm, paginateItems, sortItems } from "../common/listing";
import { PrismaService } from "../prisma.service";
import { CreateImmobilizationDto } from "./dto/create-immobilization.dto";
import { ListImmobilizationsDto } from "./dto/list-immobilizations.dto";
import { UpdateImmobilizationDto } from "./dto/update-immobilization.dto";
import { ImmobilizationsRepository } from "./immobilizations.repository";

type ImmobilizationListRecord = Awaited<ReturnType<ImmobilizationsRepository["listByOrganization"]>>[number];
type ImmobilizationDetailRecord = NonNullable<Awaited<ReturnType<ImmobilizationsRepository["findById"]>>>;
type ImmobilizationRecord = ImmobilizationListRecord | ImmobilizationDetailRecord;

@Injectable()
export class ImmobilizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly repository: ImmobilizationsRepository
  ) {}

  private normalizeOptionalString(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private normalizeDate(value?: string | null) {
    if (!value) {
      return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException("Invalid immobilization date");
    }
    return date;
  }

  private normalizeDecimal(value?: string | null) {
    const normalized = this.normalizeOptionalString(value);
    if (!normalized) {
      return null;
    }
    return new Prisma.Decimal(normalized);
  }

  private mapSummary(immobilization: ImmobilizationRecord): ImmobilizationSummary {
    return {
      id: immobilization.id,
      code: immobilization.code,
      label: immobilization.label,
      description: immobilization.description ?? null,
      status: immobilization.status ?? null,
      costCenter: immobilization.costCenter ?? null,
      purchaseValue: immobilization.purchaseValue?.toFixed(2) ?? null,
      purchaseDate: immobilization.purchaseDate?.toISOString() ?? null,
      serviceStartAt: immobilization.serviceStartAt?.toISOString() ?? null,
      sourceSystem: immobilization.sourceSystem ?? null,
      externalRef: immobilization.externalRef ?? null,
      isActive: immobilization.isActive,
      equipmentsCount: immobilization._count.equipments,
      createdAt: immobilization.createdAt.toISOString(),
      updatedAt: immobilization.updatedAt.toISOString()
    };
  }

  private mapDetail(immobilization: ImmobilizationDetailRecord): ImmobilizationDetail {
    const equipments: ImmobilizationEquipmentSummary[] = immobilization.equipments.map((equipment) => ({
      id: equipment.id,
      internalCode: equipment.internalCode,
      serialNumber: equipment.serialNumber ?? null,
      isDeleted: equipment.isDeleted,
      equipmentTypeLabel: equipment.equipmentType.label,
      equipmentStatusLabel: equipment.equipmentStatus.label,
      currentSpatialLabel: equipment.currentSpatialNode?.label ?? null,
      currentSpatialPath: equipment.currentSpatialNode?.path ?? null
    }));
    return {
      ...this.mapSummary(immobilization),
      initializedByImportJobId: immobilization.initializedByImportJobId ?? null,
      equipments
    };
  }

  private buildCreateData(organizationId: string, dto: CreateImmobilizationDto) {
    const code = dto.code.trim();
    const label = dto.label.trim();
    if (!code || !label) {
      throw new BadRequestException("Immobilization code and label are required");
    }
    return {
      organizationId,
      code,
      label,
      description: this.normalizeOptionalString(dto.description),
      status: this.normalizeOptionalString(dto.status),
      costCenter: this.normalizeOptionalString(dto.costCenter),
      purchaseValue: this.normalizeDecimal(dto.purchaseValue),
      purchaseDate: this.normalizeDate(dto.purchaseDate),
      serviceStartAt: this.normalizeDate(dto.serviceStartAt),
      sourceSystem: this.normalizeOptionalString(dto.sourceSystem),
      externalRef: this.normalizeOptionalString(dto.externalRef)
    };
  }

  private buildUpdateData(dto: UpdateImmobilizationDto): Prisma.ImmobilizationUncheckedUpdateInput {
    const data: Prisma.ImmobilizationUncheckedUpdateInput = {};
    if (dto.code !== undefined) {
      const code = dto.code.trim();
      if (!code) {
        throw new BadRequestException("Immobilization code is required");
      }
      data.code = code;
    }
    if (dto.label !== undefined) {
      const label = dto.label.trim();
      if (!label) {
        throw new BadRequestException("Immobilization label is required");
      }
      data.label = label;
    }
    if (dto.description !== undefined) {
      data.description = this.normalizeOptionalString(dto.description);
    }
    if (dto.status !== undefined) {
      data.status = this.normalizeOptionalString(dto.status);
    }
    if (dto.costCenter !== undefined) {
      data.costCenter = this.normalizeOptionalString(dto.costCenter);
    }
    if (dto.purchaseValue !== undefined) {
      data.purchaseValue = this.normalizeDecimal(dto.purchaseValue);
    }
    if (dto.purchaseDate !== undefined) {
      data.purchaseDate = this.normalizeDate(dto.purchaseDate);
    }
    if (dto.serviceStartAt !== undefined) {
      data.serviceStartAt = this.normalizeDate(dto.serviceStartAt);
    }
    if (dto.sourceSystem !== undefined) {
      data.sourceSystem = this.normalizeOptionalString(dto.sourceSystem);
    }
    if (dto.externalRef !== undefined) {
      data.externalRef = this.normalizeOptionalString(dto.externalRef);
    }
    return data;
  }

  private async getListItems(organizationId: string, query: ListImmobilizationsDto) {
    const search = normalizeSearchTerm(query.q);
    const items = (await this.repository.listByOrganization(organizationId))
      .map((item) => this.mapSummary(item))
      .filter((item) => {
        if (query.isActive && String(item.isActive) !== query.isActive) {
          return false;
        }
        return matchesSearchTerm(search, [
          item.code,
          item.label,
          item.description,
          item.status,
          item.costCenter,
          item.sourceSystem,
          item.externalRef
        ]);
      });

    return sortItems(
      items,
      {
        code: (item: ImmobilizationSummary) => item.code,
        label: (item: ImmobilizationSummary) => item.label,
        status: (item: ImmobilizationSummary) => item.status,
        costCenter: (item: ImmobilizationSummary) => item.costCenter,
        createdAt: (item: ImmobilizationSummary) => item.createdAt,
        updatedAt: (item: ImmobilizationSummary) => item.updatedAt,
        equipmentsCount: (item: ImmobilizationSummary) => item.equipmentsCount
      }[query.sort ?? "code"],
      query.direction ?? "asc"
    );
  }

  async list(organizationId: string, query: ListImmobilizationsDto) {
    const items = await this.getListItems(organizationId, query);
    return paginateItems(items, query.page, query.pageSize);
  }

  async getDetail(organizationId: string, immobilizationId: string) {
    const immobilization = await this.repository.findById(organizationId, immobilizationId);
    if (!immobilization) {
      throw new NotFoundException("Immobilization not found");
    }
    return this.mapDetail(immobilization);
  }

  findImmobilizationByCode(organizationId: string, code: string) {
    return this.repository.findByCode(organizationId, code);
  }

  async create(auth: AuthenticatedUser, dto: CreateImmobilizationDto) {
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const immobilization = await this.repository.create(tx, this.buildCreateData(auth.organizationId, dto));
        await this.auditService.log({
          db: tx,
          organizationId: auth.organizationId,
          userId: auth.sub,
          action: "immobilizations.created",
          entityType: "immobilization",
          entityId: immobilization.id,
          metadata: {
            code: immobilization.code
          }
        });
        return immobilization;
      });
      return this.mapDetail(created);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Immobilization code already exists");
      }
      throw error;
    }
  }

  async update(auth: AuthenticatedUser, immobilizationId: string, dto: UpdateImmobilizationDto) {
    const existing = await this.repository.findById(auth.organizationId, immobilizationId);
    if (!existing) {
      throw new NotFoundException("Immobilization not found");
    }

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const immobilization = await this.repository.update(
          tx,
          immobilizationId,
          this.buildUpdateData(dto)
        );
        await this.auditService.log({
          db: tx,
          organizationId: auth.organizationId,
          userId: auth.sub,
          action: "immobilizations.updated",
          entityType: "immobilization",
          entityId: immobilization.id,
          metadata: {
            before: {
              code: existing.code,
              label: existing.label,
              status: existing.status
            } as Prisma.InputJsonValue,
            after: {
              code: immobilization.code,
              label: immobilization.label,
              status: immobilization.status
            } as Prisma.InputJsonValue
          }
        });
        return immobilization;
      });
      return this.mapDetail(updated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Immobilization code already exists");
      }
      throw error;
    }
  }

  async archive(auth: AuthenticatedUser, immobilizationId: string) {
    const existing = await this.repository.findById(auth.organizationId, immobilizationId);
    if (!existing) {
      throw new NotFoundException("Immobilization not found");
    }

    const archived = await this.prisma.$transaction(async (tx) => {
      const immobilization = await this.repository.update(tx, immobilizationId, { isActive: false });
      await this.auditService.log({
        db: tx,
        organizationId: auth.organizationId,
        userId: auth.sub,
        action: "immobilizations.archived",
        entityType: "immobilization",
        entityId: immobilization.id,
        metadata: {
          code: immobilization.code,
          equipmentsCount: immobilization._count.equipments
        }
      });
      return immobilization;
    });

    return this.mapDetail(archived);
  }
}
