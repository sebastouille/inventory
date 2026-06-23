import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const activeLocationAssignments = await prisma.equipmentAssignment.findMany({
    where: {
      assignmentType: "LOCATION",
      endsAt: null,
      targetLocationId: {
        not: null
      }
    },
    select: {
      id: true,
      equipmentId: true,
      organizationId: true,
      targetLocationId: true
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  const byEquipment = new Map<string, typeof activeLocationAssignments>();
  for (const assignment of activeLocationAssignments) {
    const current = byEquipment.get(assignment.equipmentId) ?? [];
    current.push(assignment);
    byEquipment.set(assignment.equipmentId, current);
  }

  const conflicts: Array<{ equipmentId: string; assignmentIds: string[] }> = [];
  for (const [equipmentId, assignments] of byEquipment.entries()) {
    if (assignments.length > 1) {
      conflicts.push({
        equipmentId,
        assignmentIds: assignments.map((item) => item.id)
      });
    }
  }

  if (conflicts.length > 0) {
    throw new Error(
      `Backfill equipment spatial blocked: multiple active LOCATION assignments detected for ${conflicts.length} equipment(s): ${JSON.stringify(conflicts)}`
    );
  }

  let updated = 0;
  for (const assignment of activeLocationAssignments) {
    const spatialNode = await prisma.spatialNode.findFirst({
      where: {
        organizationId: assignment.organizationId,
        legacyLocationId: assignment.targetLocationId ?? undefined
      },
      select: {
        id: true
      }
    });

    if (!spatialNode) {
      throw new Error(
        `Backfill equipment spatial blocked: no SpatialNode found for legacy Location ${assignment.targetLocationId} on equipment ${assignment.equipmentId}`
      );
    }

    await prisma.equipment.update({
      where: {
        id: assignment.equipmentId
      },
      data: {
        currentSpatialNodeId: spatialNode.id
      }
    });
    updated += 1;
  }

  console.log(
    JSON.stringify({
      scannedAssignments: activeLocationAssignments.length,
      updatedEquipments: updated,
      conflicts: 0
    })
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
