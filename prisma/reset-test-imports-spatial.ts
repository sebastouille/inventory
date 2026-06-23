import { PrismaClient } from "@prisma/client";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const prisma = new PrismaClient();

function requireConfirmation() {
  if (process.env.CONFIRM_RESET_TEST_DATA !== "RESET") {
    throw new Error(
      "Refus de lancer le reset. Definir CONFIRM_RESET_TEST_DATA=RESET pour confirmer la suppression."
    );
  }
}

function ensureLocalDatabase() {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (!databaseUrl.includes("127.0.0.1") && !databaseUrl.includes("localhost")) {
    throw new Error(
      "Refus de lancer le reset hors base locale. Definir ALLOW_NON_LOCAL_RESET=true pour forcer."
    );
  }
}

function runtimeImportsRoot() {
  return resolve(process.cwd(), ".runtime", "imports");
}

async function removeRuntimeImports() {
  await rm(runtimeImportsRoot(), { recursive: true, force: true });
}

async function main() {
  requireConfirmation();
  if (process.env.ALLOW_NON_LOCAL_RESET !== "true") {
    ensureLocalDatabase();
  }

  const scopedAssignmentScopeIds = await prisma.iamAccessScope.findMany({
    where: {
      spatialNodeId: {
        not: null
      }
    },
    select: {
      id: true
    }
  });

  const scopedScopeIds = scopedAssignmentScopeIds.map((item) => item.id);

  const result = await prisma.$transaction(async (tx) => {
    const deletedAuditLogs = await tx.auditLog.deleteMany({
      where: {
        OR: [
          {
            action: {
              startsWith: "imports."
            }
          },
          {
            entityType: "import_job"
          },
          {
            entityType: "import_profile"
          }
        ]
      }
    });

    const deletedScopedUserRoles =
      scopedScopeIds.length > 0
        ? await tx.iamUserRole.deleteMany({
            where: {
              scopeId: {
                in: scopedScopeIds
              }
            }
          })
        : { count: 0 };

    const deletedImportJobWrites = await tx.importJobWrite.deleteMany();
    const deletedImportJobs = await tx.importJob.deleteMany();
    const deletedImportProfiles = await tx.importProfile.deleteMany();
    const deletedScopes = await tx.iamAccessScope.deleteMany({
      where: {
        spatialNodeId: {
          not: null
        }
      }
    });
    const deletedSpatialNodes = await tx.spatialNode.deleteMany();

    return {
      deletedAuditLogs: deletedAuditLogs.count,
      deletedScopedUserRoles: deletedScopedUserRoles.count,
      deletedImportJobWrites: deletedImportJobWrites.count,
      deletedImportJobs: deletedImportJobs.count,
      deletedImportProfiles: deletedImportProfiles.count,
      deletedScopes: deletedScopes.count,
      deletedSpatialNodes: deletedSpatialNodes.count
    };
  });

  await removeRuntimeImports();

  console.log("Reset imports + spatial termine");
  console.table(result);
  console.log("Artefacts runtime supprimes:", runtimeImportsRoot());
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
