import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const schemaName = `prisma_guard_${randomUUID().replace(/-/g, "_")}`;
const baseDatabaseUrl = process.env.PRISMA_GUARD_DATABASE_URL ?? "postgresql://inventory:inventory@127.0.0.1:5560/inventory";
const temporaryDatabaseUrl = `${baseDatabaseUrl}${baseDatabaseUrl.includes("?") ? "&" : "?"}schema=${schemaName}`;
const schemaPath = join(process.cwd(), "..", "..", "prisma", "schema.prisma");

describe("Prisma IAM migrations", () => {
  beforeAll(
    () => {
    execSync(`npx prisma db execute --schema "${schemaPath}" --stdin`, {
      input: `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE; CREATE SCHEMA "${schemaName}";`,
      env: {
        ...process.env,
        DATABASE_URL: baseDatabaseUrl
      },
      stdio: "pipe"
    });
    },
    20000
  );

  afterAll(
    () => {
    execSync(`npx prisma db execute --schema "${schemaPath}" --stdin`, {
      input: `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`,
      env: {
        ...process.env,
        DATABASE_URL: baseDatabaseUrl
      },
      stdio: "pipe"
    });
    },
    20000
  );

  it("applies the IAM migrations on an empty database schema", { timeout: 20000 }, () => {
    expect(() =>
      execSync(`npx prisma migrate deploy --schema "${schemaPath}"`, {
        env: {
          ...process.env,
          DATABASE_URL: temporaryDatabaseUrl
        },
        stdio: "pipe"
      })
    ).not.toThrow();
  });
});
