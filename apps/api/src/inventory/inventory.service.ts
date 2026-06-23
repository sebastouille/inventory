import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(organizationId: string) {
    const [products, locations, suppliers, recentMovements] = await Promise.all([
      this.prisma.product.findMany({
        where: { organizationId },
        include: { stockItems: true }
      }),
      this.prisma.location.count({ where: { organizationId } }),
      this.prisma.supplier.count({ where: { organizationId } }),
      this.prisma.stockMovement.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          product: {
            select: { id: true, name: true, sku: true }
          }
        }
      })
    ]);

    const totalUnits = products.reduce(
      (sum, product) => sum + product.stockItems.reduce((inner, item) => inner + item.quantity, 0),
      0
    );
    const lowStock = products
      .map((product) => ({
        id: product.id,
        sku: product.sku,
        name: product.name,
        minStock: product.minStock,
        quantity: product.stockItems.reduce((sum, item) => sum + item.quantity, 0)
      }))
      .filter((product) => product.quantity <= product.minStock);

    return {
      metrics: {
        products: products.length,
        locations,
        suppliers,
        totalUnits,
        lowStockCount: lowStock.length
      },
      lowStock,
      recentMovements
    };
  }
}
