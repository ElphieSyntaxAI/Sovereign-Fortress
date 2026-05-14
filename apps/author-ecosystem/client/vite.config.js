import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** SPA fallback so `/dashboard` serves `index.html` in dev (History API). */
function spaFallbackPlugin() {
  return {
    name: "author-ecosystem-spa-fallback",
    configureServer(server) {
      return () => {
        server.middlewares.use((req, _res, next) => {
          const raw = req.url ?? "";
          const path = raw.split("?")[0] ?? "";
          if (
            req.method !== "GET" ||
            path.startsWith("/api") ||
            path.startsWith("/@") ||
            path.startsWith("/node_modules") ||
            path.startsWith("/src") ||
            path.startsWith("/@fs") ||
            path.includes(".")
          ) {
            return next();
          }
          const accept = req.headers.accept ?? "";
          if (accept.includes("text/html")) {
            req.url = "/";
          }
          next();
        });
      };
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), react(), spaFallbackPlugin()],
  resolve: {
    alias: {
      /** Canonical terms folder: `apps/author-ecosystem/terms` (single source for web + BFF). */
      "@terms": path.resolve(__dirname, "../terms"),
      /** Canonical NDAs: `apps/author-ecosystem/nda` */
      "@nda": path.resolve(__dirname, "../nda"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3002", // This must match your server port
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
