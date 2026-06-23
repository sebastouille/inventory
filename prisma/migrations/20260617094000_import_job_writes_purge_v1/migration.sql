CREATE TYPE "ImportJobWriteOperation" AS ENUM ('CREATED', 'UPDATED');

CREATE TABLE "import_job_writes" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "targetDomain" "ImportTargetDomain" NOT NULL,
    "targetEntityType" TEXT NOT NULL,
    "targetEntityId" UUID NOT NULL,
    "operation" "ImportJobWriteOperation" NOT NULL,
    "targetPath" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_job_writes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "import_job_writes_organizationId_jobId_idx" ON "import_job_writes"("organizationId", "jobId");
CREATE INDEX "import_job_writes_jobId_operation_idx" ON "import_job_writes"("jobId", "operation");
CREATE INDEX "import_job_writes_organizationId_targetDomain_operation_idx" ON "import_job_writes"("organizationId", "targetDomain", "operation");
CREATE INDEX "import_job_writes_targetEntityId_idx" ON "import_job_writes"("targetEntityId");

ALTER TABLE "import_job_writes"
ADD CONSTRAINT "import_job_writes_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "import_job_writes"
ADD CONSTRAINT "import_job_writes_jobId_fkey"
FOREIGN KEY ("jobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
