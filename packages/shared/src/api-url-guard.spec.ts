import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const forbiddenValues = [
  "http://localhost:3011/api",
  "http://api:3011/api"
];

const allowedSuffix = "/api/v1";

const filesToCheck = [
  "../../../docker-compose.prod.yml",
  "../../../apps/web/app/page.tsx",
  "../../../apps/web/app/settings/page.tsx",
  "../../../apps/web/lib/api.ts",
  "../../../apps/admin/lib/api.ts",
  "../../../README.md"
];

describe("API URL guard", () => {
  it("does not leave legacy API base URLs outside /api/v1", () => {
    for (const relativePath of filesToCheck) {
      const filePath = resolve(__dirname, relativePath);
      const content = readFileSync(filePath, "utf8");

      for (const forbiddenValue of forbiddenValues) {
        const legacyPattern = `${forbiddenValue}"`;
        const legacyTickPattern = `${forbiddenValue}\``;
        const legacySpacePattern = `${forbiddenValue} `;

        expect(content).not.toContain(legacyPattern);
        expect(content).not.toContain(legacyTickPattern);
        expect(content).not.toContain(legacySpacePattern);
      }

      if (content.includes("localhost:3011/api/v1") || content.includes("api:3011/api/v1")) {
        expect(content).toContain(allowedSuffix);
      }
    }
  });
});
