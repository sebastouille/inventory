ALTER TABLE "equipment_assets"
ADD COLUMN "currentSpatialNodeId" UUID,
ADD COLUMN "initializedByImportJobId" UUID,
ADD COLUMN "receivedAt" TIMESTAMP(3),
ADD COLUMN "commissionedAt" TIMESTAMP(3),
ADD COLUMN "lastInventoryAt" TIMESTAMP(3);

ALTER TABLE "equipment_assets"
ALTER COLUMN "serialNumber" DROP NOT NULL;

DROP INDEX IF EXISTS "equipment_assets_organizationId_barcode_key";
DROP INDEX IF EXISTS "equipment_assets_organizationId_qrCode_key";

ALTER TABLE "equipment_assets"
DROP COLUMN IF EXISTS "barcode",
DROP COLUMN IF EXISTS "qrCode";

CREATE INDEX "equipment_assets_organizationId_currentSpatialNodeId_idx"
ON "equipment_assets"("organizationId", "currentSpatialNodeId");

CREATE INDEX "equipment_assets_initializedByImportJobId_idx"
ON "equipment_assets"("initializedByImportJobId");

ALTER TABLE "equipment_assets"
ADD CONSTRAINT "equipment_assets_currentSpatialNodeId_fkey"
FOREIGN KEY ("currentSpatialNodeId") REFERENCES "spatial_nodes"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "equipment_assets"
ADD CONSTRAINT "equipment_assets_initializedByImportJobId_fkey"
FOREIGN KEY ("initializedByImportJobId") REFERENCES "ImportJob"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
