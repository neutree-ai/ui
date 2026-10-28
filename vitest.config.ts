import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

process.env.TZ = "UTC";

// Rendering needs a DOM; pure logic does not, and skipping jsdom setup per
// file is most of what a lib test costs. A .ts test that touches the DOM or
// browser storage opts in with a `// @vitest-environment jsdom` docblock.
const DOM_TESTS = [
  "src/**/*.test.tsx",
  "src/**/hooks/**/*.test.ts",
  "src/foundation/providers/**/*.test.ts",
];

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    setupFiles: ["./src/foundation/testing/setup.ts"],
    projects: [
      {
        extends: true,
        test: { name: "dom", environment: "jsdom", include: DOM_TESTS },
      },
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: DOM_TESTS,
        },
      },
    ],
    coverage: {
      provider: "v8",
      all: true,
      include: ["src/**"],
      exclude: ["src/components/ui/**"],
    },
  },
});
