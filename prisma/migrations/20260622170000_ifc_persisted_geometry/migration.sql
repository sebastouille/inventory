-- Persist IFC geometry extracted during strict IFC4 imports.

ALTER TABLE "spatial_nodes"
  ADD COLUMN "geometrySource" TEXT,
  ADD COLUMN "geometryMetadata" JSONB,
  ADD COLUMN "worldCenterX" DOUBLE PRECISION,
  ADD COLUMN "worldCenterY" DOUBLE PRECISION,
  ADD COLUMN "worldCenterZ" DOUBLE PRECISION,
  ADD COLUMN "worldSizeX" DOUBLE PRECISION,
  ADD COLUMN "worldSizeY" DOUBLE PRECISION,
  ADD COLUMN "worldSizeZ" DOUBLE PRECISION,
  ADD COLUMN "geometryUpdatedAt" TIMESTAMP(3);

ALTER TABLE "equipment_assets"
  ADD COLUMN "geometrySource" TEXT,
  ADD COLUMN "geometryMetadata" JSONB,
  ADD COLUMN "worldCenterX" DOUBLE PRECISION,
  ADD COLUMN "worldCenterY" DOUBLE PRECISION,
  ADD COLUMN "worldCenterZ" DOUBLE PRECISION,
  ADD COLUMN "worldSizeX" DOUBLE PRECISION,
  ADD COLUMN "worldSizeY" DOUBLE PRECISION,
  ADD COLUMN "worldSizeZ" DOUBLE PRECISION,
  ADD COLUMN "geometryUpdatedAt" TIMESTAMP(3);

CREATE INDEX "spatial_nodes_organizationId_geometrySource_idx" ON "spatial_nodes"("organizationId", "geometrySource");
CREATE INDEX "equipment_assets_organizationId_geometrySource_idx" ON "equipment_assets"("organizationId", "geometrySource");
