import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({
  path: resolve(dirname(fileURLToPath(import.meta.url)), "e2e/.env"),
});

export default defineConfig({
  testDir: "./e2e/tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["./e2e/reporters/testrail-reporter.ts"]],
  outputDir: "e2e/test-results",

  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
  },

  projects: [
    {
      name: "setup",
      testDir: "./e2e/auth",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/auth/storage-state.json",
      },
      dependencies: ["setup"],
    },
  ],
});
