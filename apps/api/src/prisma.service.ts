import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

function isCompsDatabaseUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.pathname.replace(/^\/+/, "").split("/")[0] === "comps";
  } catch {
    return value.includes("/comps");
  }
}

function resolveDatabaseUrl() {
  const localUrl = "postgresql://inventory:inventory@127.0.0.1:5560/inventory";
  const envUrl = process.env.DATABASE_URL?.trim();

  if (process.env.NODE_ENV === "production") {
    if (!envUrl) {
      throw new Error("DATABASE_URL is required in production");
    }

    if (isCompsDatabaseUrl(envUrl)) {
      throw new Error("DATABASE_URL must not point to the comps database in production");
    }

    return envUrl;
  }

  return !envUrl || isCompsDatabaseUrl(envUrl) ? localUrl : envUrl;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      datasources: {
        db: { url: resolveDatabaseUrl() }
      }
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
