import { Injectable } from "@nestjs/common";
import type { ProductListItem } from "@inventory/shared";
import { PrismaService } from "../prisma.service";
import { buildOdsExport } from "../common/ods-export";
import { ListQueryDto } from "../common/list-query.dto";
import { matchesSearchTerm, normalizeSearchTerm, paginateItems, sortItems } from "../common/listing";

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getListItems(organizationId: string, query: ListQueryDto) {
    const products = await this.prisma.product.findMany({
      where: { organizationId },
      include: {
        category: true,
        supplier: true,
        stockItems: {
          include: {
            location: true
          }
        }
      }
    });

    const search = normalizeSearchTerm(query.q);
    const mapped: ProductListItem[] = products
      .map((product) => ({
        id: product.id,
        sku: product.sku,
        name: product.name,
        minStock: product.minStock,
        totalQuantity: product.stockItems.reduce((total, item) => total + item.quantity, 0),
        active: product.active,
        categoryName: product.category?.name ?? null,
        supplierName: product.supplier?.name ?? null
      }))
      .filter((product) =>
        matchesSearchTerm(search, [product.name, product.sku, product.categoryName, product.supplierName])
      );

    return sortItems(
      mapped,
      {
        sku: (item: ProductListItem) => item.sku,
        minStock: (item: ProductListItem) => item.minStock,
        totalQuantity: (item: ProductListItem) => item.totalQuantity,
        name: (item: ProductListItem) => item.name
      }[query.sort ?? "name"],
      query.direction ?? "asc"
    );
  }

  async list(organizationId: string, query: ListQueryDto) {
    const items = await this.getListItems(organizationId, query);
    return paginateItems(items, query.page, query.pageSize);
  }

  async export(organizationId: string, query: ListQueryDto) {
    const items = await this.getListItems(organizationId, query);
    const buffer = buildOdsExport(
      "Produits",
      items.map((item) => ({
        SKU: item.sku,
        Nom: item.name,
        Categorie: item.categoryName ?? "",
        Fournisseur: item.supplierName ?? "",
        Stock: item.totalQuantity,
        StockMin: item.minStock,
        Actif: item.active ? "Oui" : "Non"
      }))
    );

    return {
      buffer,
      filename: "produits.ods"
    };
  }
}
