import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: ["**/e2e.spec.ts"],
  use: {
    baseURL: "http://localhost:3010",
    headless: true
  }
});
