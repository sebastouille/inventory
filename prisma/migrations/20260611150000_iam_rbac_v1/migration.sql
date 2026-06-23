-- CreateEnum
CREATE TYPE "IamAccessScopeType" AS ENUM ('SITE', 'BUILDING', 'FLOOR', 'ZONE', 'ROOM', 'LOCATION');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "iam_roles" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iam_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iam_permissions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iam_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iam_role_permissions" (
    "id" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "iam_role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iam_access_scopes" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "type" "IamAccessScopeType" NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "parentScopeId" UUID,
    "externalRef" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iam_access_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iam_user_roles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "scopeId" UUID,
    "assignedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "iam_user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "iam_roles_code_key" ON "iam_roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "iam_permissions_code_key" ON "iam_permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "iam_role_permissions_roleId_permissionId_key" ON "iam_role_permissions"("roleId", "permissionId");

-- CreateIndex
CREATE INDEX "iam_role_permissions_permissionId_idx" ON "iam_role_permissions"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "iam_access_scopes_organizationId_type_code_key" ON "iam_access_scopes"("organizationId", "type", "code");

-- CreateIndex
CREATE INDEX "iam_access_scopes_organizationId_idx" ON "iam_access_scopes"("organizationId");

-- CreateIndex
CREATE INDEX "iam_access_scopes_parentScopeId_idx" ON "iam_access_scopes"("parentScopeId");

-- CreateIndex
CREATE INDEX "iam_user_roles_userId_idx" ON "iam_user_roles"("userId");

-- CreateIndex
CREATE INDEX "iam_user_roles_roleId_idx" ON "iam_user_roles"("roleId");

-- CreateIndex
CREATE INDEX "iam_user_roles_scopeId_idx" ON "iam_user_roles"("scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "iam_user_roles_userId_roleId_global_key"
ON "iam_user_roles"("userId", "roleId")
WHERE "scopeId" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "iam_user_roles_userId_roleId_scopeId_scoped_key"
ON "iam_user_roles"("userId", "roleId", "scopeId")
WHERE "scopeId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "iam_role_permissions" ADD CONSTRAINT "iam_role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "iam_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iam_role_permissions" ADD CONSTRAINT "iam_role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "iam_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iam_access_scopes" ADD CONSTRAINT "iam_access_scopes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iam_access_scopes" ADD CONSTRAINT "iam_access_scopes_parentScopeId_fkey" FOREIGN KEY ("parentScopeId") REFERENCES "iam_access_scopes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iam_user_roles" ADD CONSTRAINT "iam_user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iam_user_roles" ADD CONSTRAINT "iam_user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "iam_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iam_user_roles" ADD CONSTRAINT "iam_user_roles_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "iam_access_scopes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iam_user_roles" ADD CONSTRAINT "iam_user_roles_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed roles
INSERT INTO "iam_roles" ("id", "code", "label", "description", "isSystem", "createdAt", "updatedAt")
VALUES
  ('10000000-0000-0000-0000-000000000001', 'ADMINISTRATOR', 'Administrateur', 'Administration de la plateforme, des habilitations et de la configuration.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('10000000-0000-0000-0000-000000000002', 'ASSET_MANAGER', 'Gestionnaire patrimoine', 'Pilotage des biens, des localisations et du suivi patrimonial.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('10000000-0000-0000-0000-000000000003', 'INVENTORY_AGENT', 'Agent inventaire', 'Execution des inventaires terrain et des constats sur site.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('10000000-0000-0000-0000-000000000004', 'ACCOUNTING', 'Comptabilite', 'Consultation des donnees necessaires au rapprochement comptable.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('10000000-0000-0000-0000-000000000005', 'LOGISTICS', 'Logistique', 'Gestion des flux physiques, des mouvements et des stocks.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('10000000-0000-0000-0000-000000000006', 'EXTERNAL_PROVIDER', 'Prestataire externe', 'Intervention encadree sur un perimetre attribue.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('10000000-0000-0000-0000-000000000007', 'CAMPAIGN_SUPERVISOR', 'Superviseur campagne', 'Supervision des campagnes d''inventaire et du suivi d''avancement.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Seed permissions
INSERT INTO "iam_permissions" ("id", "code", "label", "description", "domain", "createdAt", "updatedAt")
VALUES
  ('20000000-0000-0000-0000-000000000001', 'iam.users.read', 'Consulter les utilisateurs', 'Voir la liste des utilisateurs et leurs habilitations.', 'iam', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('20000000-0000-0000-0000-000000000002', 'iam.users.create', 'Creer des utilisateurs', 'Creer des utilisateurs et initialiser leurs habilitations.', 'iam', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('20000000-0000-0000-0000-000000000003', 'iam.users.update', 'Modifier les habilitations', 'Modifier les roles, perimetres et l''etat d''un utilisateur.', 'iam', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('20000000-0000-0000-0000-000000000004', 'iam.roles.read', 'Consulter les roles', 'Voir le catalogue des roles.', 'iam', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('20000000-0000-0000-0000-000000000005', 'iam.permissions.read', 'Consulter les permissions', 'Voir la matrice des permissions.', 'iam', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('20000000-0000-0000-0000-000000000006', 'iam.scopes.read', 'Consulter les perimetres', 'Voir les perimetres disponibles.', 'iam', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('20000000-0000-0000-0000-000000000007', 'organizations.read', 'Consulter l''organisation', 'Voir le contexte organisationnel courant.', 'inventory', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('20000000-0000-0000-0000-000000000008', 'inventory.overview.read', 'Consulter la synthese inventaire', 'Voir les indicateurs globaux de l''inventaire.', 'inventory', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('20000000-0000-0000-0000-000000000009', 'locations.read', 'Consulter les localisations', 'Voir les localisations et leurs stocks.', 'inventory', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('20000000-0000-0000-0000-000000000010', 'products.read', 'Consulter les biens', 'Voir les biens et leurs caracteristiques.', 'inventory', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('20000000-0000-0000-0000-000000000011', 'suppliers.read', 'Consulter les fournisseurs', 'Voir les fournisseurs rattaches au tenant.', 'inventory', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('20000000-0000-0000-0000-000000000012', 'movements.read', 'Consulter les mouvements', 'Voir l''historique des mouvements.', 'movements', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('20000000-0000-0000-0000-000000000013', 'movements.create', 'Creer des mouvements', 'Enregistrer un mouvement de stock.', 'movements', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('20000000-0000-0000-0000-000000000014', 'campaigns.read', 'Consulter les campagnes', 'Voir les campagnes d''inventaire.', 'campaigns', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('20000000-0000-0000-0000-000000000015', 'anomalies.read', 'Consulter les anomalies', 'Voir les anomalies et ecarts constates.', 'anomalies', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('20000000-0000-0000-0000-000000000016', 'integrations.archicad.read', 'Consulter l''integration Archicad', 'Voir les informations d''import Archicad.', 'integrations.archicad', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('20000000-0000-0000-0000-000000000017', 'integrations.sap.read', 'Consulter l''integration SAP', 'Voir les informations d''import SINERGI/SAP.', 'integrations.sap', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('20000000-0000-0000-0000-000000000018', 'reconciliation.read', 'Consulter le rapprochement', 'Voir les donnees de rapprochement physique/comptable.', 'reconciliation', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('20000000-0000-0000-0000-000000000019', 'audit.read', 'Consulter l''audit', 'Voir les journaux d''audit.', 'audit', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Seed role-permission mappings
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
    OR (r.code = 'ASSET_MANAGER' AND p.code IN ('organizations.read', 'inventory.overview.read', 'locations.read', 'products.read', 'suppliers.read', 'movements.read', 'campaigns.read', 'anomalies.read', 'integrations.archicad.read', 'integrations.sap.read', 'reconciliation.read'))
    OR (r.code = 'INVENTORY_AGENT' AND p.code IN ('inventory.overview.read', 'locations.read', 'products.read', 'movements.read', 'movements.create', 'campaigns.read', 'anomalies.read'))
    OR (r.code = 'ACCOUNTING' AND p.code IN ('inventory.overview.read', 'movements.read', 'integrations.sap.read', 'reconciliation.read', 'audit.read'))
    OR (r.code = 'LOGISTICS' AND p.code IN ('inventory.overview.read', 'locations.read', 'products.read', 'suppliers.read', 'movements.read', 'movements.create'))
    OR (r.code = 'EXTERNAL_PROVIDER' AND p.code IN ('locations.read', 'products.read', 'movements.read', 'campaigns.read'))
    OR (r.code = 'CAMPAIGN_SUPERVISOR' AND p.code IN ('inventory.overview.read', 'locations.read', 'products.read', 'movements.read', 'campaigns.read', 'anomalies.read'))
  )
) mappings;

-- Backfill legacy user roles
INSERT INTO "iam_user_roles" ("id", "userId", "roleId", "scopeId", "assignedById", "createdAt")
SELECT
  (
    substr(hash_value, 1, 8) || '-' ||
    substr(hash_value, 9, 4) || '-' ||
    substr(hash_value, 13, 4) || '-' ||
    substr(hash_value, 17, 4) || '-' ||
    substr(hash_value, 21, 12)
  )::uuid,
  backfill.user_id,
  backfill.role_id,
  NULL,
  backfill.user_id,
  CURRENT_TIMESTAMP
FROM (
  SELECT
    md5(concat(u.id::text, ':', r.id::text, ':global')) AS hash_value,
    u.id AS user_id,
    r.id AS role_id
  FROM "User" u
  JOIN "iam_roles" r ON r.code = CASE
    WHEN u."role" IN ('OWNER', 'ADMIN') THEN 'ADMINISTRATOR'
    WHEN u."role" = 'MANAGER' THEN 'ASSET_MANAGER'
    WHEN u."role" = 'OPERATOR' THEN 'INVENTORY_AGENT'
    WHEN u."role" = 'VIEWER' THEN 'ACCOUNTING'
    ELSE 'INVENTORY_AGENT'
  END
) backfill;

-- Remove legacy role column
ALTER TABLE "User" DROP COLUMN "role";

-- DropEnum
DROP TYPE "UserRole";
