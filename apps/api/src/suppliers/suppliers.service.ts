import { Injectable } from "@nestjs/common";
import type { SupplierListItem } from "@inventory/shared";
import { PrismaService } from "../prisma.service";
import { ListQueryDto } from "../common/list-query.dto";
import { buildOdsExport } from "../common/ods-export";
import { matchesSearchTerm, normalizeSearchTerm, paginateItems, sortItems } from "../common/listing";

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  private async getListItems(organizationId: string, query: ListQueryDto) {
    const suppliers = await this.prisma.supplier.findMany({
      where: { organizationId },
      include: {
        products: {
          select: { id: true }
        }
      }
    });

    const search = normalizeSearchTerm(query.q);
    const mapped: SupplierListItem[] = suppliers
      .map((supplier) => ({
        id: supplier.id,
        name: supplier.name,
        email: supplier.email ?? null,
        phone: supplier.phone ?? null,
        productsCount: supplier.products.length
      }))
      .filter((supplier) => matchesSearchTerm(search, [supplier.name, supplier.email, supplier.phone]));

    return sortItems(
      mapped,
      {
        email: (item: SupplierListItem) => item.email ?? "",
        productsCount: (item: SupplierListItem) => item.productsCount,
        name: (item: SupplierListItem) => item.name
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
      "Fournisseurs",
      items.map((item) => ({
        Nom: item.name,
        Email: item.email ?? "",
        Telephone: item.phone ?? "",
        Produits: item.productsCount
      }))
    );

    return {
      buffer,
      filename: "fournisseurs.ods"
    };
  }
}
