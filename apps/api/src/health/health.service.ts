import { Injectable } from "@nestjs/common";
import type { ApiHealthResponse } from "@inventory/shared";
import { PrismaService } from "../prisma.service";

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth(): Promise<{ code: number; body: ApiHealthResponse }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        code: 200,
        body: {
          status: "ok",
          api: "up",
          database: "up",
          timestamp: new Date().toISOString()
        }
      };
    } catch {
      return {
        code: 503,
        body: {
          status: "degraded",
          api: "up",
          database: "down",
          timestamp: new Date().toISOString()
        }
      };
    }
  }
}
