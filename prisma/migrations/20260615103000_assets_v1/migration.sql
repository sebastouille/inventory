CREATE TYPE "AssetAssignmentType" AS ENUM ('PERSON', 'LOCATION', 'ASSET');

CREATE TABLE "equipment_categories" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "equipment_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "equipment_families" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "equipment_families_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "equipment_subfamilies" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "equipment_subfamilies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "equipment_types" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "subfamilyId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "equipment_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "equipment_brands" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "equipment_brands_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "equipment_models" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "brandId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isGeneric" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "equipment_models_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "equipment_statuses" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "equipment_statuses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "owner_entities" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "owner_entities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "equipment_assets" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "equipmentTypeId" UUID NOT NULL,
    "equipmentModelId" UUID,
    "equipmentStatusId" UUID NOT NULL,
    "ownerEntityId" UUID NOT NULL,
    "internalCode" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "barcode" TEXT,
    "qrCode" TEXT,
    "technicalCharacteristics" TEXT,
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "equipment_assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "equipment_assignments" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "equipmentId" UUID NOT NULL,
    "assignmentType" "AssetAssignmentType" NOT NULL,
    "targetUserId" UUID,
    "targetPersonName" TEXT,
    "targetLocationId" UUID,
    "targetEquipmentId" UUID,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "equipment_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "equipment_family_attachment_rules" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "sourceFamilyId" UUID NOT NULL,
    "targetFamilyId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "equipment_family_attachment_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "equipment_categories_organizationId_code_key" ON "equipment_categories"("organizationId", "code");
CREATE UNIQUE INDEX "equipment_families_organizationId_code_key" ON "equipment_families"("organizationId", "code");
CREATE UNIQUE INDEX "equipment_subfamilies_organizationId_code_key" ON "equipment_subfamilies"("organizationId", "code");
CREATE UNIQUE INDEX "equipment_types_organizationId_code_key" ON "equipment_types"("organizationId", "code");
CREATE UNIQUE INDEX "equipment_brands_organizationId_code_key" ON "equipment_brands"("organizationId", "code");
CREATE UNIQUE INDEX "equipment_models_organizationId_code_key" ON "equipment_models"("organizationId", "code");
CREATE UNIQUE INDEX "equipment_statuses_organizationId_code_key" ON "equipment_statuses"("organizationId", "code");
CREATE UNIQUE INDEX "owner_entities_organizationId_code_key" ON "owner_entities"("organizationId", "code");
CREATE UNIQUE INDEX "equipment_assets_organizationId_internalCode_key" ON "equipment_assets"("organizationId", "internalCode");
CREATE UNIQUE INDEX "equipment_assets_organizationId_serialNumber_key" ON "equipment_assets"("organizationId", "serialNumber");
CREATE UNIQUE INDEX "equipment_assets_organizationId_barcode_key" ON "equipment_assets"("organizationId", "barcode");
CREATE UNIQUE INDEX "equipment_assets_organizationId_qrCode_key" ON "equipment_assets"("organizationId", "qrCode");
CREATE UNIQUE INDEX "equipment_family_attachment_rules_organizationId_sourceFamilyId_targetFamilyId_key" ON "equipment_family_attachment_rules"("organizationId", "sourceFamilyId", "targetFamilyId");

CREATE INDEX "equipment_categories_organizationId_idx" ON "equipment_categories"("organizationId");
CREATE INDEX "equipment_categories_organizationId_isActive_idx" ON "equipment_categories"("organizationId", "isActive");
CREATE INDEX "equipment_families_organizationId_idx" ON "equipment_families"("organizationId");
CREATE INDEX "equipment_families_categoryId_idx" ON "equipment_families"("categoryId");
CREATE INDEX "equipment_families_organizationId_isActive_idx" ON "equipment_families"("organizationId", "isActive");
CREATE INDEX "equipment_subfamilies_organizationId_idx" ON "equipment_subfamilies"("organizationId");
CREATE INDEX "equipment_subfamilies_familyId_idx" ON "equipment_subfamilies"("familyId");
CREATE INDEX "equipment_subfamilies_organizationId_isActive_idx" ON "equipment_subfamilies"("organizationId", "isActive");
CREATE INDEX "equipment_types_organizationId_idx" ON "equipment_types"("organizationId");
CREATE INDEX "equipment_types_subfamilyId_idx" ON "equipment_types"("subfamilyId");
CREATE INDEX "equipment_types_organizationId_isActive_idx" ON "equipment_types"("organizationId", "isActive");
CREATE INDEX "equipment_brands_organizationId_idx" ON "equipment_brands"("organizationId");
CREATE INDEX "equipment_brands_organizationId_isActive_idx" ON "equipment_brands"("organizationId", "isActive");
CREATE INDEX "equipment_models_organizationId_idx" ON "equipment_models"("organizationId");
CREATE INDEX "equipment_models_brandId_idx" ON "equipment_models"("brandId");
CREATE INDEX "equipment_models_organizationId_isActive_idx" ON "equipment_models"("organizationId", "isActive");
CREATE INDEX "equipment_statuses_organizationId_idx" ON "equipment_statuses"("organizationId");
CREATE INDEX "equipment_statuses_organizationId_isActive_idx" ON "equipment_statuses"("organizationId", "isActive");
CREATE INDEX "owner_entities_organizationId_idx" ON "owner_entities"("organizationId");
CREATE INDEX "owner_entities_organizationId_isActive_idx" ON "owner_entities"("organizationId", "isActive");
CREATE INDEX "equipment_assets_organizationId_idx" ON "equipment_assets"("organizationId");
CREATE INDEX "equipment_assets_equipmentStatusId_idx" ON "equipment_assets"("equipmentStatusId");
CREATE INDEX "equipment_assets_ownerEntityId_idx" ON "equipment_assets"("ownerEntityId");
CREATE INDEX "equipment_assets_equipmentTypeId_idx" ON "equipment_assets"("equipmentTypeId");
CREATE INDEX "equipment_assets_organizationId_isDeleted_idx" ON "equipment_assets"("organizationId", "isDeleted");
CREATE INDEX "equipment_assignments_organizationId_idx" ON "equipment_assignments"("organizationId");
CREATE INDEX "equipment_assignments_equipmentId_idx" ON "equipment_assignments"("equipmentId");
CREATE INDEX "equipment_assignments_targetUserId_idx" ON "equipment_assignments"("targetUserId");
CREATE INDEX "equipment_assignments_targetLocationId_idx" ON "equipment_assignments"("targetLocationId");
CREATE INDEX "equipment_assignments_targetEquipmentId_idx" ON "equipment_assignments"("targetEquipmentId");
CREATE INDEX "equipment_family_attachment_rules_organizationId_idx" ON "equipment_family_attachment_rules"("organizationId");
CREATE INDEX "equipment_family_attachment_rules_sourceFamilyId_idx" ON "equipment_family_attachment_rules"("sourceFamilyId");
CREATE INDEX "equipment_family_attachment_rules_targetFamilyId_idx" ON "equipment_family_attachment_rules"("targetFamilyId");

ALTER TABLE "equipment_categories" ADD CONSTRAINT "equipment_categories_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "equipment_families" ADD CONSTRAINT "equipment_families_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "equipment_families" ADD CONSTRAINT "equipment_families_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "equipment_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipment_subfamilies" ADD CONSTRAINT "equipment_subfamilies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "equipment_subfamilies" ADD CONSTRAINT "equipment_subfamilies_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "equipment_families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipment_types" ADD CONSTRAINT "equipment_types_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "equipment_types" ADD CONSTRAINT "equipment_types_subfamilyId_fkey" FOREIGN KEY ("subfamilyId") REFERENCES "equipment_subfamilies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipment_brands" ADD CONSTRAINT "equipment_brands_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "equipment_models" ADD CONSTRAINT "equipment_models_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "equipment_models" ADD CONSTRAINT "equipment_models_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "equipment_brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipment_statuses" ADD CONSTRAINT "equipment_statuses_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "owner_entities" ADD CONSTRAINT "owner_entities_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "equipment_assets" ADD CONSTRAINT "equipment_assets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "equipment_assets" ADD CONSTRAINT "equipment_assets_equipmentTypeId_fkey" FOREIGN KEY ("equipmentTypeId") REFERENCES "equipment_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipment_assets" ADD CONSTRAINT "equipment_assets_equipmentModelId_fkey" FOREIGN KEY ("equipmentModelId") REFERENCES "equipment_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "equipment_assets" ADD CONSTRAINT "equipment_assets_equipmentStatusId_fkey" FOREIGN KEY ("equipmentStatusId") REFERENCES "equipment_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipment_assets" ADD CONSTRAINT "equipment_assets_ownerEntityId_fkey" FOREIGN KEY ("ownerEntityId") REFERENCES "owner_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipment_assignments" ADD CONSTRAINT "equipment_assignments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "equipment_assignments" ADD CONSTRAINT "equipment_assignments_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "equipment_assignments" ADD CONSTRAINT "equipment_assignments_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "equipment_assignments" ADD CONSTRAINT "equipment_assignments_targetLocationId_fkey" FOREIGN KEY ("targetLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "equipment_assignments" ADD CONSTRAINT "equipment_assignments_targetEquipmentId_fkey" FOREIGN KEY ("targetEquipmentId") REFERENCES "equipment_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "equipment_family_attachment_rules" ADD CONSTRAINT "equipment_family_attachment_rules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "equipment_family_attachment_rules" ADD CONSTRAINT "equipment_family_attachment_rules_sourceFamilyId_fkey" FOREIGN KEY ("sourceFamilyId") REFERENCES "equipment_families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "equipment_family_attachment_rules" ADD CONSTRAINT "equipment_family_attachment_rules_targetFamilyId_fkey" FOREIGN KEY ("targetFamilyId") REFERENCES "equipment_families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
