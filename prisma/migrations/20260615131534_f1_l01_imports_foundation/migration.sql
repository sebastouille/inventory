-- CreateEnum
CREATE TYPE "ImportTargetDomain" AS ENUM ('SPATIAL_NODES', 'EQUIPMENTS', 'IMMOBILIZATIONS');

-- CreateEnum
CREATE TYPE "ImportSourceKind" AS ENUM ('CSV', 'XLSX');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('DRAFT', 'UPLOADED', 'MAPPED', 'VALIDATED', 'READY', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ImportProfile" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "targetDomain" "ImportTargetDomain" NOT NULL,
    "name" TEXT NOT NULL,
    "sourceKind" "ImportSourceKind" NOT NULL,
    "sheetName" TEXT,
    "headerRowIndex" INTEGER NOT NULL DEFAULT 1,
    "mappings" JSONB NOT NULL,
    "options" JSONB,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "profileId" UUID,
    "targetDomain" "ImportTargetDomain" NOT NULL,
    "sourceKind" "ImportSourceKind",
    "status" "ImportJobStatus" NOT NULL DEFAULT 'DRAFT',
    "originalFilename" TEXT,
    "storedFileRef" TEXT,
    "storedMimeType" TEXT,
    "sheetName" TEXT,
    "sourceSnapshot" JSONB,
    "mappings" JSONB,
    "options" JSONB,
    "summary" JSONB,
    "report" JSONB,
    "createdById" UUID,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportProfile_organizationId_idx" ON "ImportProfile"("organizationId");

-- CreateIndex
CREATE INDEX "ImportProfile_organizationId_targetDomain_isArchived_idx" ON "ImportProfile"("organizationId", "targetDomain", "isArchived");

-- CreateIndex
CREATE INDEX "ImportProfile_createdById_idx" ON "ImportProfile"("createdById");

-- CreateIndex
CREATE INDEX "ImportJob_organizationId_idx" ON "ImportJob"("organizationId");

-- CreateIndex
CREATE INDEX "ImportJob_organizationId_targetDomain_status_idx" ON "ImportJob"("organizationId", "targetDomain", "status");

-- CreateIndex
CREATE INDEX "ImportJob_profileId_idx" ON "ImportJob"("profileId");

-- CreateIndex
CREATE INDEX "ImportJob_createdById_idx" ON "ImportJob"("createdById");

-- AddForeignKey
ALTER TABLE "ImportProfile" ADD CONSTRAINT "ImportProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportProfile" ADD CONSTRAINT "ImportProfile_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ImportProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "equipment_family_attachment_rules_organizationId_sourceFamilyId" RENAME TO "equipment_family_attachment_rules_organizationId_sourceFami_key";
