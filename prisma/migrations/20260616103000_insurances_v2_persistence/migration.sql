-- CreateEnum
CREATE TYPE "InsuranceContractType" AS ENUM (
    'PNO',
    'MR_IMMEUBLE',
    'GLI',
    'RC_SCI',
    'PROTECTION_JURIDIQUE',
    'CYBER',
    'AUTRE'
);

-- CreateTable
CREATE TABLE "insurance_contracts" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "contractType" "InsuranceContractType" NOT NULL,
    "insurer" TEXT NOT NULL,
    "policyNumber" TEXT,
    "insuredEntity" TEXT NOT NULL,
    "assetScope" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "anniversaryDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "annualPremiumAmount" INTEGER,
    "noticeDays" INTEGER NOT NULL DEFAULT 90,
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "insurance_contracts_organizationId_idx" ON "insurance_contracts"("organizationId");

-- CreateIndex
CREATE INDEX "insurance_contracts_organizationId_contractType_idx" ON "insurance_contracts"("organizationId", "contractType");

-- CreateIndex
CREATE INDEX "insurance_contracts_organizationId_anniversaryDate_idx" ON "insurance_contracts"("organizationId", "anniversaryDate");

-- CreateIndex
CREATE INDEX "insurance_contracts_organizationId_expiryDate_idx" ON "insurance_contracts"("organizationId", "expiryDate");

-- CreateIndex
CREATE INDEX "insurance_contracts_organizationId_isDeleted_idx" ON "insurance_contracts"("organizationId", "isDeleted");

-- AddForeignKey
ALTER TABLE "insurance_contracts" ADD CONSTRAINT "insurance_contracts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
