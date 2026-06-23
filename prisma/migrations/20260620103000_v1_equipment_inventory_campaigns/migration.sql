CREATE TYPE "InventoryCampaignStatus" AS ENUM (
    'DRAFT',
    'READY',
    'OPEN',
    'REVIEW',
    'CLOSED',
    'ARCHIVED'
);

CREATE TYPE "InventoryObservationResult" AS ENUM (
    'MATCH',
    'WRONG_LOCATION',
    'UNKNOWN_CODE',
    'DUPLICATE',
    'OUT_OF_SCOPE'
);

CREATE TYPE "InventoryAnomalyType" AS ENUM (
    'WRONG_LOCATION',
    'UNKNOWN_CODE',
    'MISSING',
    'DUPLICATE',
    'OUT_OF_SCOPE'
);

CREATE TYPE "InventoryAnomalyStatus" AS ENUM (
    'OPEN',
    'REVIEWING',
    'RESOLVED',
    'DISMISSED'
);

CREATE TYPE "InventoryCorrectionType" AS ENUM (
    'LOCATION_CHANGE',
    'STATUS_CHANGE',
    'RELABEL_REQUEST',
    'MANUAL_IMMOBILIZATION_LINK'
);

CREATE TYPE "InventoryCorrectionStatus" AS ENUM (
    'PROPOSED',
    'APPROVED',
    'REJECTED',
    'APPLIED',
    'FAILED'
);

CREATE TYPE "InventoryAttachmentKind" AS ENUM (
    'PHOTO',
    'DOCUMENT'
);

CREATE TABLE "inventory_campaigns" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "InventoryCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "plannedStartAt" TIMESTAMP(3),
    "plannedEndAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "reviewStartedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdById" UUID,
    "responsibleUserId" UUID,
    "expectedItemsCount" INTEGER NOT NULL DEFAULT 0,
    "observationsCount" INTEGER NOT NULL DEFAULT 0,
    "anomaliesCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_campaign_scopes" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "spatialNodeId" UUID NOT NULL,
    "includeChildren" BOOLEAN NOT NULL DEFAULT true,
    "snapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_campaign_scopes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_campaign_family_filters" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "categoryId" UUID,
    "familyId" UUID,
    "subfamilyId" UUID,
    "typeId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_campaign_family_filters_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_campaign_expected_items" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "equipmentId" UUID NOT NULL,
    "expectedSpatialNodeId" UUID,
    "expectedSpatialPath" TEXT,
    "equipmentSnapshot" JSONB NOT NULL,
    "isSeen" BOOLEAN NOT NULL DEFAULT false,
    "seenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_campaign_expected_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_sync_batches" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "userId" UUID,
    "activeSpatialNodeId" UUID,
    "clientBatchId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_sync_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_observations" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "expectedItemId" UUID,
    "equipmentId" UUID,
    "observedSpatialNodeId" UUID,
    "syncBatchId" UUID,
    "clientObservationId" TEXT NOT NULL,
    "scannedPayload" TEXT NOT NULL,
    "scannedCode" TEXT,
    "result" "InventoryObservationResult" NOT NULL,
    "comment" TEXT,
    "photoRequired" BOOLEAN NOT NULL DEFAULT false,
    "isSynced" BOOLEAN NOT NULL DEFAULT true,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_observations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_anomalies" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "observationId" UUID,
    "expectedItemId" UUID,
    "equipmentId" UUID,
    "type" "InventoryAnomalyType" NOT NULL,
    "status" "InventoryAnomalyStatus" NOT NULL DEFAULT 'OPEN',
    "scannedCode" TEXT,
    "expectedSpatialNodeId" UUID,
    "observedSpatialNodeId" UUID,
    "expectedSnapshot" JSONB,
    "observedSnapshot" JSONB,
    "notes" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_anomalies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_corrections" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "campaignId" UUID,
    "anomalyId" UUID,
    "equipmentId" UUID,
    "correctionType" "InventoryCorrectionType" NOT NULL,
    "status" "InventoryCorrectionStatus" NOT NULL DEFAULT 'PROPOSED',
    "fromSnapshot" JSONB,
    "toSnapshot" JSONB,
    "targetSpatialNodeId" UUID,
    "targetEquipmentStatusId" UUID,
    "targetImmobilizationId" UUID,
    "notes" TEXT,
    "proposedById" UUID,
    "approvedById" UUID,
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "failureReason" TEXT,

    CONSTRAINT "inventory_corrections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_attachments" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "campaignId" UUID,
    "anomalyId" UUID,
    "observationId" UUID,
    "correctionId" UUID,
    "uploadedById" UUID,
    "kind" "InventoryAttachmentKind" NOT NULL DEFAULT 'PHOTO',
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inventory_campaigns_organizationId_status_idx" ON "inventory_campaigns"("organizationId", "status");
CREATE INDEX "inventory_campaigns_createdById_idx" ON "inventory_campaigns"("createdById");
CREATE INDEX "inventory_campaigns_responsibleUserId_idx" ON "inventory_campaigns"("responsibleUserId");

CREATE UNIQUE INDEX "inventory_campaign_scopes_campaignId_spatialNodeId_key" ON "inventory_campaign_scopes"("campaignId", "spatialNodeId");
CREATE INDEX "inventory_campaign_scopes_organizationId_campaignId_idx" ON "inventory_campaign_scopes"("organizationId", "campaignId");
CREATE INDEX "inventory_campaign_scopes_spatialNodeId_idx" ON "inventory_campaign_scopes"("spatialNodeId");

CREATE INDEX "inventory_campaign_family_filters_organizationId_campaignId_idx" ON "inventory_campaign_family_filters"("organizationId", "campaignId");
CREATE INDEX "inventory_campaign_family_filters_categoryId_idx" ON "inventory_campaign_family_filters"("categoryId");
CREATE INDEX "inventory_campaign_family_filters_familyId_idx" ON "inventory_campaign_family_filters"("familyId");
CREATE INDEX "inventory_campaign_family_filters_subfamilyId_idx" ON "inventory_campaign_family_filters"("subfamilyId");
CREATE INDEX "inventory_campaign_family_filters_typeId_idx" ON "inventory_campaign_family_filters"("typeId");

CREATE UNIQUE INDEX "inventory_campaign_expected_items_campaignId_equipmentId_key" ON "inventory_campaign_expected_items"("campaignId", "equipmentId");
CREATE INDEX "inventory_campaign_expected_items_organizationId_campaignId_idx" ON "inventory_campaign_expected_items"("organizationId", "campaignId");
CREATE INDEX "inventory_campaign_expected_items_equipmentId_idx" ON "inventory_campaign_expected_items"("equipmentId");
CREATE INDEX "inventory_campaign_expected_items_expectedSpatialNodeId_idx" ON "inventory_campaign_expected_items"("expectedSpatialNodeId");

CREATE UNIQUE INDEX "inventory_sync_batches_campaignId_clientBatchId_key" ON "inventory_sync_batches"("campaignId", "clientBatchId");
CREATE INDEX "inventory_sync_batches_organizationId_campaignId_idx" ON "inventory_sync_batches"("organizationId", "campaignId");
CREATE INDEX "inventory_sync_batches_userId_idx" ON "inventory_sync_batches"("userId");

CREATE UNIQUE INDEX "inventory_observations_campaignId_clientObservationId_key" ON "inventory_observations"("campaignId", "clientObservationId");
CREATE INDEX "inventory_observations_organizationId_campaignId_idx" ON "inventory_observations"("organizationId", "campaignId");
CREATE INDEX "inventory_observations_equipmentId_idx" ON "inventory_observations"("equipmentId");
CREATE INDEX "inventory_observations_observedSpatialNodeId_idx" ON "inventory_observations"("observedSpatialNodeId");
CREATE INDEX "inventory_observations_result_idx" ON "inventory_observations"("result");
CREATE INDEX "inventory_observations_createdById_idx" ON "inventory_observations"("createdById");

CREATE INDEX "inventory_anomalies_organizationId_campaignId_idx" ON "inventory_anomalies"("organizationId", "campaignId");
CREATE INDEX "inventory_anomalies_type_status_idx" ON "inventory_anomalies"("type", "status");
CREATE INDEX "inventory_anomalies_equipmentId_idx" ON "inventory_anomalies"("equipmentId");
CREATE INDEX "inventory_anomalies_observationId_idx" ON "inventory_anomalies"("observationId");

CREATE INDEX "inventory_corrections_organizationId_status_idx" ON "inventory_corrections"("organizationId", "status");
CREATE INDEX "inventory_corrections_campaignId_idx" ON "inventory_corrections"("campaignId");
CREATE INDEX "inventory_corrections_anomalyId_idx" ON "inventory_corrections"("anomalyId");
CREATE INDEX "inventory_corrections_equipmentId_idx" ON "inventory_corrections"("equipmentId");

CREATE INDEX "inventory_attachments_organizationId_campaignId_idx" ON "inventory_attachments"("organizationId", "campaignId");
CREATE INDEX "inventory_attachments_anomalyId_idx" ON "inventory_attachments"("anomalyId");
CREATE INDEX "inventory_attachments_observationId_idx" ON "inventory_attachments"("observationId");
CREATE INDEX "inventory_attachments_correctionId_idx" ON "inventory_attachments"("correctionId");

ALTER TABLE "inventory_campaigns" ADD CONSTRAINT "inventory_campaigns_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_campaigns" ADD CONSTRAINT "inventory_campaigns_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_campaigns" ADD CONSTRAINT "inventory_campaigns_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inventory_campaign_scopes" ADD CONSTRAINT "inventory_campaign_scopes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_campaign_scopes" ADD CONSTRAINT "inventory_campaign_scopes_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "inventory_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_campaign_scopes" ADD CONSTRAINT "inventory_campaign_scopes_spatialNodeId_fkey" FOREIGN KEY ("spatialNodeId") REFERENCES "spatial_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_campaign_family_filters" ADD CONSTRAINT "inventory_campaign_family_filters_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_campaign_family_filters" ADD CONSTRAINT "inventory_campaign_family_filters_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "inventory_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_campaign_expected_items" ADD CONSTRAINT "inventory_campaign_expected_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_campaign_expected_items" ADD CONSTRAINT "inventory_campaign_expected_items_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "inventory_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_campaign_expected_items" ADD CONSTRAINT "inventory_campaign_expected_items_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_campaign_expected_items" ADD CONSTRAINT "inventory_campaign_expected_items_expectedSpatialNodeId_fkey" FOREIGN KEY ("expectedSpatialNodeId") REFERENCES "spatial_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inventory_sync_batches" ADD CONSTRAINT "inventory_sync_batches_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_sync_batches" ADD CONSTRAINT "inventory_sync_batches_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "inventory_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_sync_batches" ADD CONSTRAINT "inventory_sync_batches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inventory_observations" ADD CONSTRAINT "inventory_observations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_observations" ADD CONSTRAINT "inventory_observations_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "inventory_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_observations" ADD CONSTRAINT "inventory_observations_expectedItemId_fkey" FOREIGN KEY ("expectedItemId") REFERENCES "inventory_campaign_expected_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_observations" ADD CONSTRAINT "inventory_observations_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_observations" ADD CONSTRAINT "inventory_observations_observedSpatialNodeId_fkey" FOREIGN KEY ("observedSpatialNodeId") REFERENCES "spatial_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_observations" ADD CONSTRAINT "inventory_observations_syncBatchId_fkey" FOREIGN KEY ("syncBatchId") REFERENCES "inventory_sync_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_observations" ADD CONSTRAINT "inventory_observations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inventory_anomalies" ADD CONSTRAINT "inventory_anomalies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_anomalies" ADD CONSTRAINT "inventory_anomalies_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "inventory_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_anomalies" ADD CONSTRAINT "inventory_anomalies_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "inventory_observations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_anomalies" ADD CONSTRAINT "inventory_anomalies_expectedItemId_fkey" FOREIGN KEY ("expectedItemId") REFERENCES "inventory_campaign_expected_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_anomalies" ADD CONSTRAINT "inventory_anomalies_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_anomalies" ADD CONSTRAINT "inventory_anomalies_expectedSpatialNodeId_fkey" FOREIGN KEY ("expectedSpatialNodeId") REFERENCES "spatial_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_anomalies" ADD CONSTRAINT "inventory_anomalies_observedSpatialNodeId_fkey" FOREIGN KEY ("observedSpatialNodeId") REFERENCES "spatial_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inventory_corrections" ADD CONSTRAINT "inventory_corrections_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_corrections" ADD CONSTRAINT "inventory_corrections_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "inventory_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_corrections" ADD CONSTRAINT "inventory_corrections_anomalyId_fkey" FOREIGN KEY ("anomalyId") REFERENCES "inventory_anomalies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_corrections" ADD CONSTRAINT "inventory_corrections_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_corrections" ADD CONSTRAINT "inventory_corrections_targetSpatialNodeId_fkey" FOREIGN KEY ("targetSpatialNodeId") REFERENCES "spatial_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_corrections" ADD CONSTRAINT "inventory_corrections_targetEquipmentStatusId_fkey" FOREIGN KEY ("targetEquipmentStatusId") REFERENCES "equipment_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_corrections" ADD CONSTRAINT "inventory_corrections_targetImmobilizationId_fkey" FOREIGN KEY ("targetImmobilizationId") REFERENCES "immobilizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_corrections" ADD CONSTRAINT "inventory_corrections_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_corrections" ADD CONSTRAINT "inventory_corrections_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inventory_attachments" ADD CONSTRAINT "inventory_attachments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_attachments" ADD CONSTRAINT "inventory_attachments_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "inventory_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_attachments" ADD CONSTRAINT "inventory_attachments_anomalyId_fkey" FOREIGN KEY ("anomalyId") REFERENCES "inventory_anomalies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_attachments" ADD CONSTRAINT "inventory_attachments_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "inventory_observations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_attachments" ADD CONSTRAINT "inventory_attachments_correctionId_fkey" FOREIGN KEY ("correctionId") REFERENCES "inventory_corrections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_attachments" ADD CONSTRAINT "inventory_attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
