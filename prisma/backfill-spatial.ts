import { PrismaClient, SpatialSourceKind, SpatialNodeType } from "@prisma/client";

const prisma = new PrismaClient();

function normalizeAscii(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/]+/g, "-")
    .replace(/\s+/g, "-")
    .toUpperCase()
    .trim();
}

async function main() {
  const locations = await prisma.location.findMany({
    orderBy: [{ organizationId: "asc" }, { code: "asc" }]
  });

  let createdCount = 0;
  const conflicts: Array<{ organizationId: string; locationId: string; code: string; path: string }> = [];

  for (const location of locations) {
    const existingByLegacy = await prisma.spatialNode.findFirst({
      where: {
        legacyLocationId: location.id
      }
    });
    if (existingByLegacy) {
      continue;
    }

    const code = normalizeAscii(location.code);
    const path = code;
    const conflict = await prisma.spatialNode.findFirst({
      where: {
        organizationId: location.organizationId,
        path
      }
    });
    if (conflict) {
      conflicts.push({
        organizationId: location.organizationId,
        locationId: location.id,
        code: location.code,
        path
      });
      continue;
    }

    await prisma.spatialNode.create({
      data: {
        organizationId: location.organizationId,
        type: SpatialNodeType.LOCATION,
        code,
        label: location.name,
        description: location.description,
        path,
        depth: 0,
        sortOrder: 0,
        legacyLocationId: location.id,
        externalSource: SpatialSourceKind.LEGACY,
        isActive: true
      }
    });
    createdCount += 1;
  }

  if (conflicts.length > 0) {
    console.error("Backfill spatial interrompu, conflits detectes:");
    console.error(JSON.stringify(conflicts, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify({ createdCount, conflicts }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
