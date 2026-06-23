CREATE TABLE "immobilizations" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT,
    "costCenter" TEXT,
    "purchaseValue" DECIMAL(14,2),
    "purchaseDate" TIMESTAMP(3),
    "serviceStartAt" TIMESTAMP(3),
    "sourceSystem" TEXT,
    "externalRef" TEXT,
    "initializedByImportJobId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "immobilizations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "equipment_assets"
ADD COLUMN "immobilizationId" UUID;

CREATE UNIQUE INDEX "immobilizations_organizationId_code_key"
ON "immobilizations"("organizationId", "code");

CREATE INDEX "immobilizations_organizationId_isActive_idx"
ON "immobilizations"("organizationId", "isActive");

CREATE INDEX "immobilizations_organizationId_status_idx"
ON "immobilizations"("organizationId", "status");

CREATE INDEX "immobilizations_organizationId_externalRef_idx"
ON "immobilizations"("organizationId", "externalRef");

CREATE INDEX "immobilizations_initializedByImportJobId_idx"
ON "immobilizations"("initializedByImportJobId");

CREATE INDEX "equipment_assets_organizationId_immobilizationId_idx"
ON "equipment_assets"("organizationId", "immobilizationId");

ALTER TABLE "immobilizations"
ADD CONSTRAINT "immobilizations_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "immobilizations"
ADD CONSTRAINT "immobilizations_initializedByImportJobId_fkey"
FOREIGN KEY ("initializedByImportJobId") REFERENCES "ImportJob"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "equipment_assets"
ADD CONSTRAINT "equipment_assets_immobilizationId_fkey"
FOREIGN KEY ("immobilizationId") REFERENCES "immobilizations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
