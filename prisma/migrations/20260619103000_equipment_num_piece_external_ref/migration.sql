ALTER TABLE "equipment_assets"
ADD COLUMN "numPiece" TEXT,
ADD COLUMN "externalRef" TEXT;

CREATE INDEX "equipment_assets_organizationId_externalRef_idx"
ON "equipment_assets"("organizationId", "externalRef");
