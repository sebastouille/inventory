-- CreateEnum
CREATE TYPE "SpatialSourceKind" AS ENUM ('LEGACY', 'CSV', 'XLSX', 'IFC4');

-- CreateEnum
CREATE TYPE "SpatialNodeType" AS ENUM ('SITE', 'BUILDING', 'FLOOR', 'ZONE', 'ROOM', 'LOCATION');

-- CreateTable
CREATE TABLE "spatial_nodes" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "type" "SpatialNodeType" NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "path" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "parentId" UUID,
    "legacyLocationId" UUID,
    "externalSource" "SpatialSourceKind",
    "externalRef" TEXT,
    "sourceClass" TEXT,
    "sourceMetadata" JSONB,
    "importProfileId" UUID,
    "lastImportJobId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spatial_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "spatial_nodes_organizationId_type_idx" ON "spatial_nodes"("organizationId", "type");

-- CreateIndex
CREATE INDEX "spatial_nodes_organizationId_parentId_idx" ON "spatial_nodes"("organizationId", "parentId");

-- CreateIndex
CREATE INDEX "spatial_nodes_organizationId_code_idx" ON "spatial_nodes"("organizationId", "code");

-- CreateIndex
CREATE INDEX "spatial_nodes_organizationId_externalRef_idx" ON "spatial_nodes"("organizationId", "externalRef");

-- CreateIndex
CREATE INDEX "spatial_nodes_organizationId_sourceClass_idx" ON "spatial_nodes"("organizationId", "sourceClass");

-- CreateIndex
CREATE UNIQUE INDEX "spatial_nodes_organizationId_parentId_code_key" ON "spatial_nodes"("organizationId", "parentId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "spatial_nodes_organizationId_path_key" ON "spatial_nodes"("organizationId", "path");

-- CreateIndex
CREATE UNIQUE INDEX "spatial_nodes_legacyLocationId_key" ON "spatial_nodes"("legacyLocationId");

-- AddForeignKey
ALTER TABLE "spatial_nodes" ADD CONSTRAINT "spatial_nodes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spatial_nodes" ADD CONSTRAINT "spatial_nodes_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "spatial_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spatial_nodes" ADD CONSTRAINT "spatial_nodes_legacyLocationId_fkey" FOREIGN KEY ("legacyLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spatial_nodes" ADD CONSTRAINT "spatial_nodes_importProfileId_fkey" FOREIGN KEY ("importProfileId") REFERENCES "ImportProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spatial_nodes" ADD CONSTRAINT "spatial_nodes_lastImportJobId_fkey" FOREIGN KEY ("lastImportJobId") REFERENCES "ImportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
