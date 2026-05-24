import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../..");

/** SPA fallback for /admin/sign-in, /auth/callback, etc. */
function spaFallbackPlugin() {
  return {
    name: "syntax-educates-spa-fallback",
    configureServer(server: import("vite").ViteDevServer) {
      return () => {
        server.middlewares.use((req, _res, next) => {
          const raw = req.url ?? "";
          const urlPath = raw.split("?")[0] ?? "";
          if (
            req.method !== "GET" ||
            urlPath.includes(".") ||
            urlPath.startsWith("/@") ||
            urlPath.startsWith("/node_modules")
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
  dotenv.config({ path: path.join(monorepoRoot, ".env") });
  dotenv.config({ path: path.join(monorepoRoot, ".env.local"), override: true });
  dotenv.config({ path: path.join(monorepoRoot, "packages", "msgf", ".env.local"), override: true });

  const env = loadEnv(mode, monorepoRoot, "");
  const viteMsgfAppUrl =
    env.VITE_MSGF_APP_URL ||
    env.MSGF_APP_URL ||
    env.MSGF_LOCAL_DEV_URL ||
    env.NEXT_PUBLIC_MSGF_APP_URL ||
    "http://127.0.0.1:3001";

  return {
    plugins: [tailwindcss(), react(), spaFallbackPlugin()],
    envDir: monorepoRoot,
    define: {
      "import.meta.env.VITE_MSGF_APP_URL": JSON.stringify(viteMsgfAppUrl),
    },
    server: { port: 5175, host: true },
  };
});
