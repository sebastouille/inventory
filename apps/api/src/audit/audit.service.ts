import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";

interface AuditEntryInput {
  organizationId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  db?: PrismaService | Prisma.TransactionClient;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(entry: AuditEntryInput) {
    const db = entry.db ?? this.prisma;
    return db.auditLog.create({
      data: {
        organizationId: entry.organizationId,
        userId: entry.userId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata ?? undefined
      }
    });
  }
}
