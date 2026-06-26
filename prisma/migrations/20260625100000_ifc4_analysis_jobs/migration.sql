ALTER TYPE "ImportTargetDomain" ADD VALUE IF NOT EXISTS 'IFC4_ANALYSIS';

CREATE TYPE "ImportJobLogLevel" AS ENUM ('DEBUG', 'INFO', 'WARNING', 'ERROR');

CREATE TABLE "import_job_logs" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "level" "ImportJobLogLevel" NOT NULL DEFAULT 'INFO',
    "step" TEXT,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_job_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "import_job_logs_organizationId_jobId_createdAt_idx" ON "import_job_logs"("organizationId", "jobId", "createdAt");
CREATE INDEX "import_job_logs_jobId_level_idx" ON "import_job_logs"("jobId", "level");

ALTER TABLE "import_job_logs" ADD CONSTRAINT "import_job_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "import_job_logs" ADD CONSTRAINT "import_job_logs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
