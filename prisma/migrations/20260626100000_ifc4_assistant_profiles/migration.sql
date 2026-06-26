-- CreateTable
CREATE TABLE "Ifc4AssistantProfile" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "selectedClasses" JSONB NOT NULL,
    "selectedProperties" JSONB NOT NULL,
    "spatialMappings" JSONB,
    "equipmentMappings" JSONB,
    "assetReferenceOverrides" JSONB,
    "spatialTypeOverrides" JSONB,
    "geometryLevel" TEXT NOT NULL DEFAULT 'MINIMUM',
    "maxProducts" INTEGER NOT NULL DEFAULT 5000,
    "maxShapeParts" INTEGER NOT NULL DEFAULT 12,
    "importOnlyGeometryReady" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ifc4AssistantProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ifc4AssistantProfile_organizationId_name_key" ON "Ifc4AssistantProfile"("organizationId", "name");

-- CreateIndex
CREATE INDEX "Ifc4AssistantProfile_organizationId_isArchived_idx" ON "Ifc4AssistantProfile"("organizationId", "isArchived");

-- CreateIndex
CREATE INDEX "Ifc4AssistantProfile_organizationId_isDefault_idx" ON "Ifc4AssistantProfile"("organizationId", "isDefault");

-- CreateIndex
CREATE INDEX "Ifc4AssistantProfile_createdById_idx" ON "Ifc4AssistantProfile"("createdById");

-- AddForeignKey
ALTER TABLE "Ifc4AssistantProfile" ADD CONSTRAINT "Ifc4AssistantProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ifc4AssistantProfile" ADD CONSTRAINT "Ifc4AssistantProfile_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
