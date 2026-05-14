import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../..");

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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, monorepoRoot, "");
  const viteSupabaseUrl =
    env.VITE_SUPABASE_URL ||
    env.NEXT_PUBLIC_SUPABASE_URL ||
    env.SUPABASE_URL ||
    "";
  const viteSupabaseAnon =
    env.VITE_SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    "";

  return {
    plugins: [tailwindcss(), react(), spaFallbackPlugin()],
    envDir: monorepoRoot,
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(viteSupabaseUrl),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(viteSupabaseAnon),
    },
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
  };
});
