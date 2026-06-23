ALTER TABLE "iam_access_scopes"
ADD COLUMN "spatialNodeId" UUID;

ALTER TABLE "iam_access_scopes"
ADD CONSTRAINT "iam_access_scopes_spatialNodeId_fkey"
FOREIGN KEY ("spatialNodeId") REFERENCES "spatial_nodes"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE UNIQUE INDEX "iam_access_scopes_spatialNodeId_key"
ON "iam_access_scopes"("spatialNodeId");

CREATE INDEX "iam_access_scopes_spatialNodeId_idx"
ON "iam_access_scopes"("spatialNodeId");
