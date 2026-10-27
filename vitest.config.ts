import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

process.env.TZ = "UTC";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/foundation/testing/setup.ts"],
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    coverage: {
      provider: "v8",
      all: true,
      include: ["src/**"],
      exclude: ["src/components/ui/**"],
    },
  },
});
