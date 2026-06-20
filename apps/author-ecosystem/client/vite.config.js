import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
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
  // Match packages/msgf/next.config.ts — keys often live in packages/msgf/.env.local only.
  dotenv.config({ path: path.join(monorepoRoot, ".env") });
  dotenv.config({ path: path.join(monorepoRoot, ".env.local"), override: true });
  dotenv.config({ path: path.join(monorepoRoot, "packages", "msgf", ".env") });
  dotenv.config({
    path: path.join(monorepoRoot, "packages", "msgf", ".env.local"),
    override: true,
  });

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
  const viteAuthorBffUrl =
    env.VITE_AUTHOR_BFF_URL ||
    env.AUTHOR_BFF_URL ||
    env.NEXT_PUBLIC_AUTHOR_BFF_URL ||
    (mode === "development" ? "http://127.0.0.1:3002" : "");
  const viteAuthorAppUrl =
    env.VITE_AUTHOR_APP_URL ||
    env.AUTHOR_APP_URL ||
    env.NEXT_PUBLIC_AUTHOR_APP_URL ||
    "";
  const viteEducationAppUrl =
    env.VITE_EDUCATION_APP_URL ||
    env.EDUCATION_APP_URL ||
    env.NEXT_PUBLIC_EDUCATION_APP_URL ||
    "";
  const viteMsgfAppUrl =
    env.VITE_MSGF_APP_URL ||
    env.MSGF_APP_URL ||
    env.MSGF_LOCAL_DEV_URL ||
    env.NEXT_PUBLIC_MSGF_APP_URL ||
    "http://127.0.0.1:3001";

  return {
    plugins: [tailwindcss(), react(), spaFallbackPlugin()],
    envDir: monorepoRoot,
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, "index.html"),
        },
      },
    },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(viteSupabaseUrl),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(viteSupabaseAnon),
      "import.meta.env.VITE_AUTHOR_BFF_URL": JSON.stringify(viteAuthorBffUrl),
      "import.meta.env.VITE_AUTHOR_APP_URL": JSON.stringify(viteAuthorAppUrl),
      "import.meta.env.VITE_EDUCATION_APP_URL": JSON.stringify(viteEducationAppUrl),
      "import.meta.env.VITE_MSGF_APP_URL": JSON.stringify(viteMsgfAppUrl),
    },
    resolve: {
      /** Use `development` exports (TypeScript source) — `dist/*.js` is not built in every clone. */
      conditions: ["development", "browser", "import", "module", "default"],
      alias: {
        /** Avoid pulling education + `node:crypto` handoff code through the UI package barrel. */
        "@elphie-syntax/ui/dashboard": path.resolve(
          monorepoRoot,
          "packages/ui/src/dashboard.ts"
        ),
        /**
         * `msgf` workspace package uses `@/` imports; map them when Vite prebundles msgf from
         * `packages/msgf` (Author client does not use `@/` for its own sources).
         */
        "@": path.resolve(monorepoRoot, "packages/msgf"),
        "msgf/lib/platform-persona-auth": path.resolve(
          monorepoRoot,
          "packages/msgf/lib/platform-persona-auth.ts"
        ),
        "msgf/connector/MsgfBridge": path.resolve(
          monorepoRoot,
          "packages/msgf/lib/connector/MsgfBridge.ts"
        ),
        "msgf/connector": path.resolve(monorepoRoot, "packages/msgf/lib/connector/client.ts"),
        "msgf/connector/client": path.resolve(monorepoRoot, "packages/msgf/lib/connector/client.ts"),
        "@elphie-syntax/ui/pillar-health": path.resolve(
          monorepoRoot,
          "packages/ui/src/pillar-health.ts"
        ),
        "msgf/ui": path.resolve(monorepoRoot, "packages/msgf/ui/index.ts"),
        /** Canonical terms folder: `apps/author-ecosystem/terms` (single source for web + BFF). */
        "@terms": path.resolve(__dirname, "../terms"),
        /** Canonical NDAs: `apps/author-ecosystem/nda` */
        "@nda": path.resolve(__dirname, "../nda"),
      },
    },
    optimizeDeps: {
      exclude: [
        "msgf/lib/platform-persona-auth",
        "msgf/connector",
        "msgf/ui",
        "@elphie-syntax/ui",
        "@elphie-syntax/ui/dashboard",
        "@elphie-syntax/ui/pillar-health",
        "msgf/connector/MsgfBridge",
        "@elphie-syntax/core",
      ],
    },
    server: {
      host: true,
      port: 5173,
      /** Fail fast if 5173 is taken — MSGF handoff + cookies expect this port (not 5174). */
      strictPort: true,
      proxy: {
        "/api": {
          target: env.VITE_AUTHOR_BFF_URL || env.AUTHOR_BFF_URL || "http://127.0.0.1:3002",
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
