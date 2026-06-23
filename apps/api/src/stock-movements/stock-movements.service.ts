import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { StockMovementType } from "@prisma/client";
import type { StockMovementListItem } from "@inventory/shared";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CreateStockMovementDto } from "./create-stock-movement.dto";
import { ListQueryDto } from "../common/list-query.dto";
import { buildOdsExport } from "../common/ods-export";
import { matchesSearchTerm, normalizeSearchTerm, paginateItems, sortItems } from "../common/listing";

@Injectable()
export class StockMovementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  private async getListItems(organizationId: string, query: ListQueryDto) {
    const movements = await this.prisma.stockMovement.findMany({
      where: { organizationId },
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true
          }
        }
      }
    });

    const search = normalizeSearchTerm(query.q);
    const mapped: StockMovementListItem[] = movements
      .map((movement) => ({
        id: movement.id,
        type: movement.type,
        quantity: movement.quantity,
        reason: movement.reason ?? null,
        createdAt: movement.createdAt.toISOString(),
        product: movement.product
      }))
      .filter((movement) =>
        matchesSearchTerm(search, [
          movement.product.name,
          movement.product.sku,
          movement.type,
          movement.reason
        ])
      );

    return sortItems(
      mapped,
      {
        type: (item: StockMovementListItem) => item.type,
        quantity: (item: StockMovementListItem) => item.quantity,
        createdAt: (item: StockMovementListItem) => item.createdAt
      }[query.sort ?? "createdAt"],
      query.direction ?? "desc"
    );
  }

  async list(organizationId: string, query: ListQueryDto) {
    const items = await this.getListItems(organizationId, query);
    return paginateItems(items, query.page, query.pageSize);
  }

  async export(organizationId: string, query: ListQueryDto) {
    const items = await this.getListItems(organizationId, query);
    const buffer = buildOdsExport(
      "Mouvements",
      items.map((item) => ({
        Date: item.createdAt,
        Type: item.type,
        Produit: item.product.name,
        SKU: item.product.sku,
        Quantite: item.quantity,
        Raison: item.reason ?? ""
      }))
    );

    return {
      buffer,
      filename: "mouvements.ods"
    };
  }

  async create(auth: AuthenticatedUser, dto: CreateStockMovementDto) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: dto.productId,
        organizationId: auth.organizationId
      }
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    const validateLocation = async (locationId?: string) => {
      if (!locationId) {
        return null;
      }
      const location = await this.prisma.location.findFirst({
        where: {
          id: locationId,
          organizationId: auth.organizationId
        }
      });
      if (!location) {
        throw new NotFoundException("Location not found");
      }
      return location;
    };

    const fromLocation = await validateLocation(dto.fromLocationId);
    const toLocation = await validateLocation(dto.toLocationId);

    if (dto.type === StockMovementType.IN && !toLocation) {
      throw new BadRequestException("IN movements require toLocationId");
    }
    if (dto.type === StockMovementType.OUT && !fromLocation) {
      throw new BadRequestException("OUT movements require fromLocationId");
    }
    if (dto.type === StockMovementType.TRANSFER && (!fromLocation || !toLocation)) {
      throw new BadRequestException("TRANSFER movements require both fromLocationId and toLocationId");
    }
    if (dto.quantity === 0) {
      throw new BadRequestException("Quantity must be non-zero");
    }

    return this.prisma.$transaction(async (tx) => {
      const adjustStock = async (locationId: string, delta: number) => {
        const existing = await tx.stockItem.findUnique({
          where: {
            productId_locationId: {
              productId: product.id,
              locationId
            }
          }
        });

        const nextQuantity = (existing?.quantity ?? 0) + delta;
        if (nextQuantity < 0) {
          throw new BadRequestException("Insufficient stock for movement");
        }

        return tx.stockItem.upsert({
          where: {
            productId_locationId: {
              productId: product.id,
              locationId
            }
          },
          update: {
            quantity: nextQuantity
          },
          create: {
            productId: product.id,
            locationId,
            quantity: nextQuantity
          }
        });
      };

      switch (dto.type) {
        case StockMovementType.IN:
          await adjustStock(toLocation!.id, dto.quantity);
          break;
        case StockMovementType.OUT:
          await adjustStock(fromLocation!.id, -dto.quantity);
          break;
        case StockMovementType.TRANSFER:
          await adjustStock(fromLocation!.id, -dto.quantity);
          await adjustStock(toLocation!.id, dto.quantity);
          break;
        case StockMovementType.ADJUSTMENT:
          if (!toLocation && !fromLocation) {
            throw new BadRequestException("ADJUSTMENT movements require a location");
          }
          await adjustStock((toLocation ?? fromLocation)!.id, dto.quantity);
          break;
        default:
          throw new BadRequestException("Unsupported movement type");
      }

      const movement = await tx.stockMovement.create({
        data: {
          organizationId: auth.organizationId,
          productId: product.id,
          type: dto.type,
          quantity: dto.quantity,
          fromLocationId: fromLocation?.id,
          toLocationId: toLocation?.id,
          reason: dto.reason,
          createdById: auth.sub
        },
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true
            }
          }
        }
      });

      await this.auditService.log({
        db: tx,
        organizationId: auth.organizationId,
        userId: auth.sub,
        action: "stock_movement.created",
        entityType: "StockMovement",
        entityId: movement.id,
        metadata: {
          type: dto.type,
          quantity: dto.quantity,
          productId: product.id
        }
      });

      return movement;
    });
  }
}
