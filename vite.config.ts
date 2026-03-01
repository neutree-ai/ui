import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";

const NODE_IP = process.env.NODE_IP || "localhost";
const analyze = process.env.ANALYZE === "true";

export default defineConfig({
  plugins: [
    react(),
    analyze && visualizer({ filename: "stats.html", sourcemap: true }),
  ],
  build: {
    sourcemap: analyze,
    chunkSizeWarningLimit: 1024,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api/v1": {
        target: `http://${NODE_IP}`,
      },
    },
  },
});
