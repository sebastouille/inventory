import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AttachmentRuleItem, EquipmentReferenceItem, EquipmentReferenceResource } from "@inventory/shared";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { matchesSearchTerm, normalizeSearchTerm } from "../common/listing";
import { PrismaService } from "../prisma.service";
import { AssetReferencesRepository } from "./asset-references.repository";
import { CreateAttachmentRuleDto } from "./dto/create-attachment-rule.dto";
import { CreateEquipmentReferenceDto } from "./dto/create-equipment-reference.dto";
import { ListAssetReferencesDto } from "./dto/list-asset-references.dto";
import { UpdateAttachmentRuleDto } from "./dto/update-attachment-rule.dto";
import { UpdateEquipmentReferenceDto } from "./dto/update-equipment-reference.dto";

const REFERENCE_RESOURCES = new Set<EquipmentReferenceResource>([
  "categories",
  "families",
  "subfamilies",
  "types",
  "brands",
  "models",
  "statuses",
  "owners",
  "attachment-rules"
]);

type StandardReferenceResource = Exclude<EquipmentReferenceResource, "attachment-rules">;

const AUDIT_ENTITY_TYPES: Record<StandardReferenceResource, string> = {
  categories: "equipment_category",
  families: "equipment_family",
  subfamilies: "equipment_subfamily",
  types: "equipment_type",
  brands: "equipment_brand",
  models: "equipment_model",
  statuses: "equipment_status",
  owners: "owner_entity"
};

@Injectable()
export class AssetReferencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly referencesRepository: AssetReferencesRepository
  ) {}

  private normalizeResource(resource: string): EquipmentReferenceResource {
    if (!REFERENCE_RESOURCES.has(resource as EquipmentReferenceResource)) {
      throw new BadRequestException("Unknown asset reference resource");
    }
    return resource as EquipmentReferenceResource;
  }

  private async ensureParent(
    organizationId: string,
    resource: StandardReferenceResource,
    parentId?: string | null
  ) {
    if (resource === "categories" || resource === "brands" || resource === "statuses" || resource === "owners") {
      return;
    }

    if (!parentId) {
      throw new BadRequestException("Missing parent reference");
    }

    const parentResource: StandardReferenceResource =
      resource === "families"
        ? "categories"
        : resource === "subfamilies"
          ? "families"
          : resource === "types"
            ? "subfamilies"
            : "brands";

    const parent = await this.referencesRepository.findResourceById(organizationId, parentResource, parentId);
    if (!parent || !parent.isActive) {
      throw new BadRequestException("Unknown parent reference");
    }
  }

  private filterReferences(items: EquipmentReferenceItem[], query: ListAssetReferencesDto) {
    const search = normalizeSearchTerm(query.q);
    return items.filter((item) => matchesSearchTerm(search, [item.code, item.label, item.description, item.parentLabel]));
  }

  private async listStandardReferences(
    organizationId: string,
    resource: StandardReferenceResource,
    query: ListAssetReferencesDto
  ): Promise<EquipmentReferenceItem[]> {
    switch (resource) {
      case "categories":
        return this.filterReferences(
          (
            await this.referencesRepository.listCategories(organizationId, query.state)
          ).map((item) => ({
            id: item.id,
            code: item.code,
            label: item.label,
            description: item.description ?? null,
            isActive: item.isActive,
            parentId: null,
            parentLabel: null,
            isGeneric: false
          })),
          query
        );
      case "families":
        return this.filterReferences(
          (
            await this.referencesRepository.listFamilies(organizationId, query.state)
          ).map((item) => ({
            id: item.id,
            code: item.code,
            label: item.label,
            description: item.description ?? null,
            isActive: item.isActive,
            parentId: item.categoryId,
            parentLabel: item.category.label,
            isGeneric: false
          })),
          query
        );
      case "subfamilies":
        return this.filterReferences(
          (
            await this.referencesRepository.listSubfamilies(organizationId, query.state)
          ).map((item) => ({
            id: item.id,
            code: item.code,
            label: item.label,
            description: item.description ?? null,
            isActive: item.isActive,
            parentId: item.familyId,
            parentLabel: item.family.label,
            isGeneric: false
          })),
          query
        );
      case "types":
        return this.filterReferences(
          (
            await this.referencesRepository.listTypes(organizationId, query.state)
          ).map((item) => ({
            id: item.id,
            code: item.code,
            label: item.label,
            description: item.description ?? null,
            isActive: item.isActive,
            parentId: item.subfamilyId,
            parentLabel: item.subfamily.label,
            isGeneric: false
          })),
          query
        );
      case "brands":
        return this.filterReferences(
          (
            await this.referencesRepository.listBrands(organizationId, query.state)
          ).map((item) => ({
            id: item.id,
            code: item.code,
            label: item.label,
            description: item.description ?? null,
            isActive: item.isActive,
            parentId: null,
            parentLabel: null,
            isGeneric: false
          })),
          query
        );
      case "models":
        return this.filterReferences(
          (
            await this.referencesRepository.listModels(organizationId, query.state)
          ).map((item) => ({
            id: item.id,
            code: item.code,
            label: item.label,
            description: item.description ?? null,
            isActive: item.isActive,
            parentId: item.brandId,
            parentLabel: item.brand.label,
            isGeneric: item.isGeneric
          })),
          query
        );
      case "statuses":
        return this.filterReferences(
          (
            await this.referencesRepository.listStatuses(organizationId, query.state)
          ).map((item) => ({
            id: item.id,
            code: item.code,
            label: item.label,
            description: item.description ?? null,
            isActive: item.isActive,
            parentId: null,
            parentLabel: null,
            isGeneric: false
          })),
          query
        );
      case "owners":
        return this.filterReferences(
          (
            await this.referencesRepository.listOwners(organizationId, query.state)
          ).map((item) => ({
            id: item.id,
            code: item.code,
            label: item.label,
            description: item.description ?? null,
            isActive: item.isActive,
            parentId: null,
            parentLabel: null,
            isGeneric: false
          })),
          query
        );
    }
  }

  async list(organizationId: string, resourceInput: string, query: ListAssetReferencesDto) {
    const resource = this.normalizeResource(resourceInput);
    if (resource === "attachment-rules") {
      const rules = await this.referencesRepository.listAttachmentRules(organizationId, query.state);
      const search = normalizeSearchTerm(query.q);
      return rules
        .map(
          (item): AttachmentRuleItem => ({
            id: item.id,
            sourceFamilyId: item.sourceFamilyId,
            sourceFamilyLabel: item.sourceFamily.label,
            targetFamilyId: item.targetFamilyId,
            targetFamilyLabel: item.targetFamily.label,
            isActive: item.isActive
          })
        )
        .filter((item) => matchesSearchTerm(search, [item.sourceFamilyLabel, item.targetFamilyLabel]));
    }

    return this.listStandardReferences(organizationId, resource, query);
  }

  async createReference(auth: AuthenticatedUser, resourceInput: string, dto: CreateEquipmentReferenceDto) {
    const resource = this.normalizeResource(resourceInput);
    if (resource === "attachment-rules") {
      throw new BadRequestException("Attachment rules use a dedicated payload");
    }

    await this.ensureParent(auth.organizationId, resource, dto.parentId);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const record = await this.referencesRepository.createReference(tx, auth.organizationId, resource, dto);
        await this.auditService.log({
          db: tx,
          organizationId: auth.organizationId,
          userId: auth.sub,
          action: "asset-references.created",
          entityType: AUDIT_ENTITY_TYPES[resource],
          entityId: record.id,
          metadata: {
            code: dto.code,
            label: dto.label
          }
        });
        return record;
      });

      return created;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Reference code already exists");
      }
      throw error;
    }
  }

  async updateReference(
    auth: AuthenticatedUser,
    resourceInput: string,
    id: string,
    dto: UpdateEquipmentReferenceDto
  ) {
    const resource = this.normalizeResource(resourceInput);
    if (resource === "attachment-rules") {
      throw new BadRequestException("Attachment rules use a dedicated payload");
    }

    const existing = await this.referencesRepository.findResourceById(auth.organizationId, resource, id);
    if (!existing) {
      throw new NotFoundException("Reference not found");
    }

    await this.ensureParent(auth.organizationId, resource, dto.parentId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await this.referencesRepository.updateReference(tx, auth.organizationId, resource, id, dto);
        await this.auditService.log({
          db: tx,
          organizationId: auth.organizationId,
          userId: auth.sub,
          action: "asset-references.updated",
          entityType: AUDIT_ENTITY_TYPES[resource],
          entityId: id,
          metadata: {
            code: dto.code,
            label: dto.label
          }
        });
        return updated;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Reference code already exists");
      }
      throw error;
    }
  }

  async archiveReference(auth: AuthenticatedUser, resourceInput: string, id: string) {
    const resource = this.normalizeResource(resourceInput);
    if (resource === "attachment-rules") {
      throw new BadRequestException("Attachment rules use a dedicated payload");
    }
    const existing = await this.referencesRepository.findResourceById(auth.organizationId, resource, id);
    if (!existing) {
      throw new NotFoundException("Reference not found");
    }
    return this.prisma.$transaction(async (tx) => {
      const archived = await this.referencesRepository.archiveReference(tx, resource, id);
      await this.auditService.log({
        db: tx,
        organizationId: auth.organizationId,
        userId: auth.sub,
        action: "asset-references.archived",
        entityType: AUDIT_ENTITY_TYPES[resource],
        entityId: id,
        metadata: Prisma.JsonNull
      });
      return archived;
    });
  }

  private async ensureFamilies(organizationId: string, sourceFamilyId: string, targetFamilyId: string) {
    const [source, target] = await Promise.all([
      this.referencesRepository.findResourceById(organizationId, "families", sourceFamilyId),
      this.referencesRepository.findResourceById(organizationId, "families", targetFamilyId)
    ]);
    if (!source || !source.isActive || !target || !target.isActive) {
      throw new BadRequestException("Unknown attachment family");
    }
    if (sourceFamilyId === targetFamilyId) {
      throw new BadRequestException("Source and target family must differ");
    }
  }

  async createAttachmentRule(auth: AuthenticatedUser, dto: CreateAttachmentRuleDto) {
    await this.ensureFamilies(auth.organizationId, dto.sourceFamilyId, dto.targetFamilyId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const rule = await this.referencesRepository.createAttachmentRule(tx, auth.organizationId, dto);
        await this.auditService.log({
          db: tx,
          organizationId: auth.organizationId,
          userId: auth.sub,
          action: "asset-references.attachment-rule.created",
          entityType: "equipment_family_attachment_rule",
          entityId: rule.id,
          metadata: dto as unknown as Prisma.InputJsonValue
        });
        return rule;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Attachment rule already exists");
      }
      throw error;
    }
  }

  async updateAttachmentRule(auth: AuthenticatedUser, id: string, dto: UpdateAttachmentRuleDto) {
    const existing = await this.referencesRepository.findAttachmentRuleById(auth.organizationId, id);
    if (!existing) {
      throw new NotFoundException("Attachment rule not found");
    }
    await this.ensureFamilies(auth.organizationId, dto.sourceFamilyId, dto.targetFamilyId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const rule = await this.referencesRepository.updateAttachmentRule(tx, auth.organizationId, id, dto);
        await this.auditService.log({
          db: tx,
          organizationId: auth.organizationId,
          userId: auth.sub,
          action: "asset-references.attachment-rule.updated",
          entityType: "equipment_family_attachment_rule",
          entityId: id,
          metadata: dto as unknown as Prisma.InputJsonValue
        });
        return rule;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Attachment rule already exists");
      }
      throw error;
    }
  }

  async archiveAttachmentRule(auth: AuthenticatedUser, id: string) {
    const existing = await this.referencesRepository.findAttachmentRuleById(auth.organizationId, id);
    if (!existing) {
      throw new NotFoundException("Attachment rule not found");
    }
    return this.prisma.$transaction(async (tx) => {
      const rule = await this.referencesRepository.archiveAttachmentRule(tx, id);
      await this.auditService.log({
        db: tx,
        organizationId: auth.organizationId,
        userId: auth.sub,
        action: "asset-references.attachment-rule.archived",
        entityType: "equipment_family_attachment_rule",
        entityId: id,
        metadata: Prisma.JsonNull
      });
      return rule;
    });
  }
}
