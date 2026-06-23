-- Add scan metadata for equipment inventory observations.
CREATE TYPE "InventoryScanSource" AS ENUM ('CAMERA', 'HID', 'MANUAL');

ALTER TABLE "inventory_observations"
  ADD COLUMN "scanSource" "InventoryScanSource",
  ADD COLUMN "deviceHint" TEXT,
  ADD COLUMN "clientObservedAt" TIMESTAMP(3);

CREATE INDEX "inventory_observations_scanSource_idx" ON "inventory_observations"("scanSource");
