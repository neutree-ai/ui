import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";

const NODE_IP = process.env.NODE_IP || "localhost";
const analyze = process.env.ANALYZE === "true";

// Vite >= 4.5.6 rejects dev-server requests whose Host header it does not
// recognise, which guards against DNS-rebinding attacks. That check also blocks
// remote preview setups (tunnels, cloud sandboxes, LAN hostnames), where the
// browser reaches the dev server under a hostname Vite cannot infer. Opt those
// hostnames in explicitly, e.g. VITE_ALLOWED_HOSTS="my-preview.example.dev".
// Leaving the variable unset keeps Vite's default, strict behaviour.
const allowedHosts = process.env.VITE_ALLOWED_HOSTS?.split(",")
  .map((host) => host.trim())
  .filter(Boolean);

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
    allowedHosts,
    proxy: {
      "/api/v1": {
        target: `http://${NODE_IP}`,
        // Send the target's own Host header instead of the dev server's, so
        // NODE_IP can point at a backend that routes by virtual host.
        changeOrigin: true,
      },
    },
  },
});
