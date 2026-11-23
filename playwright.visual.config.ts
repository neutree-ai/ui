import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Captures of pages rendered from mock data, for `yarn visual:report`.
export default defineConfig({
  testDir: "./e2e/visual",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: true,
  workers: 4,
  retries: 0,
  reporter: [["list"]],
  outputDir: path.resolve(
    process.env.VISUAL_OUT_DIR ?? "visual-out",
    ".playwright",
  ),
  timeout: 60_000,
  expect: { timeout: 20_000 },

  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.VISUAL_BASE_URL ?? "http://localhost:4173",
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "UTC",
    colorScheme: "light",
    reducedMotion: "reduce",
    actionTimeout: 10_000,
  },
});
