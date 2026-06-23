-- CreateEnum
CREATE TYPE "Bim3dMapStatus" AS ENUM ('BUILDING', 'READY', 'FAILED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "bim_3d_maps" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "importJobId" UUID,
    "name" TEXT NOT NULL,
    "status" "Bim3dMapStatus" NOT NULL DEFAULT 'BUILDING',
    "mode" TEXT NOT NULL DEFAULT 'simplified',
    "sceneFileRef" TEXT,
    "summary" JSONB,
    "errorMessage" TEXT,
    "createdById" UUID,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bim_3d_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bim_3d_map_builds" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "mapId" UUID NOT NULL,
    "importJobId" UUID,
    "status" "Bim3dMapStatus" NOT NULL DEFAULT 'BUILDING',
    "mode" TEXT NOT NULL DEFAULT 'simplified',
    "sceneFileRef" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "summary" JSONB,
    "createdById" UUID,

    CONSTRAINT "bim_3d_map_builds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bim_3d_maps_organizationId_status_idx" ON "bim_3d_maps"("organizationId", "status");

-- CreateIndex
CREATE INDEX "bim_3d_maps_importJobId_idx" ON "bim_3d_maps"("importJobId");

-- CreateIndex
CREATE INDEX "bim_3d_maps_createdById_idx" ON "bim_3d_maps"("createdById");

-- CreateIndex
CREATE INDEX "bim_3d_map_builds_organizationId_status_idx" ON "bim_3d_map_builds"("organizationId", "status");

-- CreateIndex
CREATE INDEX "bim_3d_map_builds_mapId_idx" ON "bim_3d_map_builds"("mapId");

-- CreateIndex
CREATE INDEX "bim_3d_map_builds_importJobId_idx" ON "bim_3d_map_builds"("importJobId");

-- CreateIndex
CREATE INDEX "bim_3d_map_builds_createdById_idx" ON "bim_3d_map_builds"("createdById");

-- AddForeignKey
ALTER TABLE "bim_3d_maps" ADD CONSTRAINT "bim_3d_maps_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bim_3d_maps" ADD CONSTRAINT "bim_3d_maps_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bim_3d_maps" ADD CONSTRAINT "bim_3d_maps_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bim_3d_map_builds" ADD CONSTRAINT "bim_3d_map_builds_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bim_3d_map_builds" ADD CONSTRAINT "bim_3d_map_builds_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "bim_3d_maps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bim_3d_map_builds" ADD CONSTRAINT "bim_3d_map_builds_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bim_3d_map_builds" ADD CONSTRAINT "bim_3d_map_builds_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed BIM 3D permissions for existing installations.
INSERT INTO "iam_permissions" ("id", "code", "label", "description", "domain", "createdAt", "updatedAt")
VALUES
  ('20000000-0000-0000-0000-000000000501', 'bim3d.read', 'Consulter la carte 3D', 'Voir les cartes 3D simplifiees des noeuds spatiaux et equipements.', 'bim3d', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('20000000-0000-0000-0000-000000000502', 'bim3d.build', 'Generer la carte 3D', 'Generer une scene 3D simplifiee depuis les donnees spatiales et IFC4.', 'bim3d', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('20000000-0000-0000-0000-000000000503', 'bim3d.manage', 'Administrer les cartes 3D', 'Regenerer ou archiver les cartes 3D simplifiees.', 'bim3d', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "label" = EXCLUDED."label",
  "description" = EXCLUDED."description",
  "domain" = EXCLUDED."domain",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "iam_role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT
  (
    substr(hash_value, 1, 8) || '-' ||
    substr(hash_value, 9, 4) || '-' ||
    substr(hash_value, 13, 4) || '-' ||
    substr(hash_value, 17, 4) || '-' ||
    substr(hash_value, 21, 12)
  )::uuid,
  mappings.role_id,
  mappings.permission_id,
  CURRENT_TIMESTAMP
FROM (
  SELECT
    md5(concat(r.code, ':', p.code)) AS hash_value,
    r.id AS role_id,
    p.id AS permission_id
  FROM "iam_roles" r
  JOIN "iam_permissions" p ON (
    r.code = 'ADMINISTRATOR'
    OR (r.code = 'ASSET_MANAGER' AND p.code IN ('bim3d.read', 'bim3d.build', 'bim3d.manage'))
    OR (r.code IN ('INVENTORY_AGENT', 'LOGISTICS', 'CAMPAIGN_SUPERVISOR') AND p.code = 'bim3d.read')
  )
  WHERE p.code IN ('bim3d.read', 'bim3d.build', 'bim3d.manage')
) mappings
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
