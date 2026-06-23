import { Injectable } from "@nestjs/common";
import type { LocationListItem } from "@inventory/shared";
import { PrismaService } from "../prisma.service";
import { ListQueryDto } from "../common/list-query.dto";
import { matchesSearchTerm, normalizeSearchTerm, paginateItems, sortItems } from "../common/listing";
import { buildOdsExport } from "../common/ods-export";

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getListItems(organizationId: string, query: ListQueryDto) {
    const locations = await this.prisma.location.findMany({
      where: { organizationId },
      include: {
        stockItems: {
          include: {
            product: {
              select: {
                sku: true,
                name: true
              }
            }
          }
        }
      }
    });

    const search = normalizeSearchTerm(query.q);
    const mapped: LocationListItem[] = locations
      .map((location) => ({
        id: location.id,
        code: location.code,
        name: location.name,
        description: location.description ?? null,
        stockItemsCount: location.stockItems.length,
        totalUnits: location.stockItems.reduce((total, item) => total + item.quantity, 0)
      }))
      .filter((location) => matchesSearchTerm(search, [location.name, location.code, location.description]));

    return sortItems(
      mapped,
      {
        code: (item: LocationListItem) => item.code,
        totalUnits: (item: LocationListItem) => item.totalUnits,
        name: (item: LocationListItem) => item.name
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
      "Localisations",
      items.map((item) => ({
        Code: item.code,
        Nom: item.name,
        Description: item.description ?? "",
        Unites: item.totalUnits,
        Articles: item.stockItemsCount
      }))
    );

    return {
      buffer,
      filename: "localisations.ods"
    };
  }
}
