CREATE TYPE "EquipmentMovementType" AS ENUM (
    'INITIAL_STATE',
    'LOCATION_CHANGED',
    'ASSIGNMENT_ADDED',
    'ASSIGNMENT_REMOVED',
    'ASSIGNMENT_CHANGED'
);

CREATE TYPE "EquipmentMovementTriggerType" AS ENUM (
    'EQUIPMENT_CREATED',
    'EQUIPMENT_UPDATED',
    'ASSIGNMENTS_REPLACED',
    'IMPORT_EXECUTED',
    'SYSTEM_BACKFILL'
);

CREATE TYPE "EquipmentMovementSource" AS ENUM (
    'USER',
    'IMPORT',
    'SYSTEM'
);

CREATE TABLE "equipment_movements" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "equipmentId" UUID NOT NULL,
    "movementType" "EquipmentMovementType" NOT NULL,
    "triggerType" "EquipmentMovementTriggerType" NOT NULL,
    "source" "EquipmentMovementSource" NOT NULL,
    "fromSpatialNodeId" UUID,
    "toSpatialNodeId" UUID,
    "fromSpatialSnapshot" JSONB,
    "toSpatialSnapshot" JSONB,
    "fromAssignmentSnapshot" JSONB,
    "toAssignmentSnapshot" JSONB,
    "reason" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_movements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "equipment_movements_organizationId_idx"
ON "equipment_movements"("organizationId");

CREATE INDEX "equipment_movements_equipmentId_idx"
ON "equipment_movements"("equipmentId");

CREATE INDEX "equipment_movements_organizationId_equipmentId_createdAt_idx"
ON "equipment_movements"("organizationId", "equipmentId", "createdAt");

CREATE INDEX "equipment_movements_organizationId_movementType_idx"
ON "equipment_movements"("organizationId", "movementType");

CREATE INDEX "equipment_movements_organizationId_source_idx"
ON "equipment_movements"("organizationId", "source");

CREATE INDEX "equipment_movements_fromSpatialNodeId_idx"
ON "equipment_movements"("fromSpatialNodeId");

CREATE INDEX "equipment_movements_toSpatialNodeId_idx"
ON "equipment_movements"("toSpatialNodeId");

CREATE INDEX "equipment_movements_createdById_idx"
ON "equipment_movements"("createdById");

ALTER TABLE "equipment_movements"
ADD CONSTRAINT "equipment_movements_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "equipment_movements"
ADD CONSTRAINT "equipment_movements_equipmentId_fkey"
FOREIGN KEY ("equipmentId") REFERENCES "equipment_assets"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "equipment_movements"
ADD CONSTRAINT "equipment_movements_fromSpatialNodeId_fkey"
FOREIGN KEY ("fromSpatialNodeId") REFERENCES "spatial_nodes"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "equipment_movements"
ADD CONSTRAINT "equipment_movements_toSpatialNodeId_fkey"
FOREIGN KEY ("toSpatialNodeId") REFERENCES "spatial_nodes"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "equipment_movements"
ADD CONSTRAINT "equipment_movements_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
