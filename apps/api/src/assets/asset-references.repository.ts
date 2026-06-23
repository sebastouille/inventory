import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";

type DbClient = PrismaService | Prisma.TransactionClient;
type ReferenceState = "all" | "active" | "inactive";
type ReferenceResource =
  | "categories"
  | "families"
  | "subfamilies"
  | "types"
  | "brands"
  | "models"
  | "statuses"
  | "owners";

@Injectable()
export class AssetReferencesRepository {
  constructor(private readonly prisma: PrismaService) {}

  private stateWhere(state?: ReferenceState) {
    if (!state || state === "all") {
      return {};
    }

    return {
      isActive: state === "active"
    };
  }

  listCategories(organizationId: string, state?: ReferenceState) {
    return this.prisma.equipmentCategory.findMany({
      where: {
        organizationId,
        ...this.stateWhere(state)
      },
      orderBy: { label: "asc" }
    });
  }

  listFamilies(organizationId: string, state?: ReferenceState) {
    return this.prisma.equipmentFamily.findMany({
      where: {
        organizationId,
        ...this.stateWhere(state)
      },
      include: {
        category: true
      },
      orderBy: { label: "asc" }
    });
  }

  listSubfamilies(organizationId: string, state?: ReferenceState) {
    return this.prisma.equipmentSubfamily.findMany({
      where: {
        organizationId,
        ...this.stateWhere(state)
      },
      include: {
        family: true
      },
      orderBy: { label: "asc" }
    });
  }

  listTypes(organizationId: string, state?: ReferenceState) {
    return this.prisma.equipmentType.findMany({
      where: {
        organizationId,
        ...this.stateWhere(state)
      },
      include: {
        subfamily: true
      },
      orderBy: { label: "asc" }
    });
  }

  listBrands(organizationId: string, state?: ReferenceState) {
    return this.prisma.equipmentBrand.findMany({
      where: {
        organizationId,
        ...this.stateWhere(state)
      },
      orderBy: { label: "asc" }
    });
  }

  listModels(organizationId: string, state?: ReferenceState) {
    return this.prisma.equipmentModel.findMany({
      where: {
        organizationId,
        ...this.stateWhere(state)
      },
      include: {
        brand: true
      },
      orderBy: { label: "asc" }
    });
  }

  listStatuses(organizationId: string, state?: ReferenceState) {
    return this.prisma.equipmentStatus.findMany({
      where: {
        organizationId,
        ...this.stateWhere(state)
      },
      orderBy: { label: "asc" }
    });
  }

  listOwners(organizationId: string, state?: ReferenceState) {
    return this.prisma.ownerEntity.findMany({
      where: {
        organizationId,
        ...this.stateWhere(state)
      },
      orderBy: { label: "asc" }
    });
  }

  listAttachmentRules(organizationId: string, state?: ReferenceState) {
    return this.prisma.equipmentFamilyAttachmentRule.findMany({
      where: {
        organizationId,
        ...this.stateWhere(state)
      },
      include: {
        sourceFamily: true,
        targetFamily: true
      },
      orderBy: [{ sourceFamily: { label: "asc" } }, { targetFamily: { label: "asc" } }]
    });
  }

  findResourceById(organizationId: string, resource: ReferenceResource, id: string) {
    switch (resource) {
      case "categories":
        return this.prisma.equipmentCategory.findFirst({ where: { organizationId, id } });
      case "families":
        return this.prisma.equipmentFamily.findFirst({ where: { organizationId, id } });
      case "subfamilies":
        return this.prisma.equipmentSubfamily.findFirst({ where: { organizationId, id } });
      case "types":
        return this.prisma.equipmentType.findFirst({ where: { organizationId, id } });
      case "brands":
        return this.prisma.equipmentBrand.findFirst({ where: { organizationId, id } });
      case "models":
        return this.prisma.equipmentModel.findFirst({ where: { organizationId, id } });
      case "statuses":
        return this.prisma.equipmentStatus.findFirst({ where: { organizationId, id } });
      case "owners":
        return this.prisma.ownerEntity.findFirst({ where: { organizationId, id } });
    }
  }

  createReference(
    db: DbClient,
    organizationId: string,
    resource: ReferenceResource,
    input: {
      code: string;
      label: string;
      description?: string | null;
      parentId?: string | null;
      isGeneric?: boolean;
    }
  ) {
    switch (resource) {
      case "categories":
        return db.equipmentCategory.create({
          data: {
            organizationId,
            code: input.code,
            label: input.label,
            description: input.description ?? null
          }
        });
      case "families":
        return db.equipmentFamily.create({
          data: {
            organizationId,
            categoryId: input.parentId!,
            code: input.code,
            label: input.label,
            description: input.description ?? null
          }
        });
      case "subfamilies":
        return db.equipmentSubfamily.create({
          data: {
            organizationId,
            familyId: input.parentId!,
            code: input.code,
            label: input.label,
            description: input.description ?? null
          }
        });
      case "types":
        return db.equipmentType.create({
          data: {
            organizationId,
            subfamilyId: input.parentId!,
            code: input.code,
            label: input.label,
            description: input.description ?? null
          }
        });
      case "brands":
        return db.equipmentBrand.create({
          data: {
            organizationId,
            code: input.code,
            label: input.label,
            description: input.description ?? null
          }
        });
      case "models":
        return db.equipmentModel.create({
          data: {
            organizationId,
            brandId: input.parentId!,
            code: input.code,
            label: input.label,
            description: input.description ?? null,
            isGeneric: input.isGeneric ?? false
          }
        });
      case "statuses":
        return db.equipmentStatus.create({
          data: {
            organizationId,
            code: input.code,
            label: input.label,
            description: input.description ?? null
          }
        });
      case "owners":
        return db.ownerEntity.create({
          data: {
            organizationId,
            code: input.code,
            label: input.label,
            description: input.description ?? null
          }
        });
    }
  }

  updateReference(
    db: DbClient,
    organizationId: string,
    resource: ReferenceResource,
    id: string,
    input: {
      code: string;
      label: string;
      description?: string | null;
      parentId?: string | null;
      isGeneric?: boolean;
    }
  ) {
    switch (resource) {
      case "categories":
        return db.equipmentCategory.update({
          where: { id },
          data: { organizationId, code: input.code, label: input.label, description: input.description ?? null }
        });
      case "families":
        return db.equipmentFamily.update({
          where: { id },
          data: {
            organizationId,
            categoryId: input.parentId!,
            code: input.code,
            label: input.label,
            description: input.description ?? null
          }
        });
      case "subfamilies":
        return db.equipmentSubfamily.update({
          where: { id },
          data: {
            organizationId,
            familyId: input.parentId!,
            code: input.code,
            label: input.label,
            description: input.description ?? null
          }
        });
      case "types":
        return db.equipmentType.update({
          where: { id },
          data: {
            organizationId,
            subfamilyId: input.parentId!,
            code: input.code,
            label: input.label,
            description: input.description ?? null
          }
        });
      case "brands":
        return db.equipmentBrand.update({
          where: { id },
          data: { organizationId, code: input.code, label: input.label, description: input.description ?? null }
        });
      case "models":
        return db.equipmentModel.update({
          where: { id },
          data: {
            organizationId,
            brandId: input.parentId!,
            code: input.code,
            label: input.label,
            description: input.description ?? null,
            isGeneric: input.isGeneric ?? false
          }
        });
      case "statuses":
        return db.equipmentStatus.update({
          where: { id },
          data: { organizationId, code: input.code, label: input.label, description: input.description ?? null }
        });
      case "owners":
        return db.ownerEntity.update({
          where: { id },
          data: { organizationId, code: input.code, label: input.label, description: input.description ?? null }
        });
    }
  }

  archiveReference(db: DbClient, resource: ReferenceResource, id: string) {
    switch (resource) {
      case "categories":
        return db.equipmentCategory.update({ where: { id }, data: { isActive: false } });
      case "families":
        return db.equipmentFamily.update({ where: { id }, data: { isActive: false } });
      case "subfamilies":
        return db.equipmentSubfamily.update({ where: { id }, data: { isActive: false } });
      case "types":
        return db.equipmentType.update({ where: { id }, data: { isActive: false } });
      case "brands":
        return db.equipmentBrand.update({ where: { id }, data: { isActive: false } });
      case "models":
        return db.equipmentModel.update({ where: { id }, data: { isActive: false } });
      case "statuses":
        return db.equipmentStatus.update({ where: { id }, data: { isActive: false } });
      case "owners":
        return db.ownerEntity.update({ where: { id }, data: { isActive: false } });
    }
  }

  findAttachmentRuleById(organizationId: string, id: string) {
    return this.prisma.equipmentFamilyAttachmentRule.findFirst({
      where: {
        organizationId,
        id
      },
      include: {
        sourceFamily: true,
        targetFamily: true
      }
    });
  }

  createAttachmentRule(
    db: DbClient,
    organizationId: string,
    input: {
      sourceFamilyId: string;
      targetFamilyId: string;
    }
  ) {
    return db.equipmentFamilyAttachmentRule.create({
      data: {
        organizationId,
        sourceFamilyId: input.sourceFamilyId,
        targetFamilyId: input.targetFamilyId
      }
    });
  }

  updateAttachmentRule(
    db: DbClient,
    organizationId: string,
    id: string,
    input: {
      sourceFamilyId: string;
      targetFamilyId: string;
    }
  ) {
    return db.equipmentFamilyAttachmentRule.update({
      where: { id },
      data: {
        organizationId,
        sourceFamilyId: input.sourceFamilyId,
        targetFamilyId: input.targetFamilyId,
        isActive: true
      }
    });
  }

  archiveAttachmentRule(db: DbClient, id: string) {
    return db.equipmentFamilyAttachmentRule.update({
      where: { id },
      data: {
        isActive: false
      }
    });
  }
}
