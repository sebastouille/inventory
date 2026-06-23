import { Injectable } from "@nestjs/common";
import { InventoryAnomalyStatus, InventoryCampaignStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(organizationId: string) {
    const staleInventoryThreshold = new Date();
    staleInventoryThreshold.setMonth(staleInventoryThreshold.getMonth() - 12);

    const [openCampaignsCount, openAnomaliesCount, unreconciledImmobilizationsCount, staleInventoryCount] =
      await Promise.all([
        this.prisma.inventoryCampaign.count({
          where: {
            organizationId,
            status: InventoryCampaignStatus.OPEN
          }
        }),
        this.prisma.inventoryAnomaly.count({
          where: {
            organizationId,
            status: InventoryAnomalyStatus.OPEN
          }
        }),
        this.prisma.immobilization.count({
          where: {
            organizationId,
            isActive: true,
            equipments: {
              none: {}
            }
          }
        }),
        this.prisma.equipment.count({
          where: {
            organizationId,
            isDeleted: false,
            OR: [{ lastInventoryAt: null }, { lastInventoryAt: { lt: staleInventoryThreshold } }]
          }
        })
      ]);

    return {
      metrics: {
        openCampaignsCount,
        openAnomaliesCount,
        unreconciledImmobilizationsCount,
        staleInventoryCount
      }
    };
  }
}
