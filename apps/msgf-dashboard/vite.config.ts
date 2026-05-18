import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import type { ProxyOptions } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dashboardRoot = path.dirname(fileURLToPath(import.meta.url));

/** MSGF Next app env (same file `next.config.ts` loads for local API). */
const MSGF_BACKEND_ENV_LOCAL = path.join(root, "packages/msgf/.env.local");

/** Live Cloud Run MSGF API — keep in sync with `MSGF_PRODUCTION_API_ORIGIN` in msgf-admin-api.ts */
const MSGF_CLOUD_RUN_ORIGIN = "https://msgf-api-bkracxai6q-uc.a.run.app";

function loadMsgfBackendEnvLocal(): Record<string, string> {
  if (!fs.existsSync(MSGF_BACKEND_ENV_LOCAL)) {
    return {};
  }
  try {
    return dotenv.parse(fs.readFileSync(MSGF_BACKEND_ENV_LOCAL));
  } catch (e) {
    console.warn(
      `[msgf-dashboard] Could not parse ${MSGF_BACKEND_ENV_LOCAL}:`,
      e instanceof Error ? e.message : e
    );
    return {};
  }
}

function resolveAdminBearer(
  viteEnv: Record<string, string>,
  msgfBackendEnv: Record<string, string>
): string {
  return (
    viteEnv.MSGF_ADMIN_BEARER_TOKEN?.trim() ||
    viteEnv.MSGF_ADMIN_API_KEY?.trim() ||
    msgfBackendEnv.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    ""
  );
}

function createMsgfApiProxy(target: string, adminBearer: string): ProxyOptions {
  return {
    target,
    changeOrigin: true,
    secure: true,
    configure: (proxy) => {
      if (!adminBearer) return;
      proxy.on("proxyReq", (proxyReq) => {
        proxyReq.setHeader("Authorization", `Bearer ${adminBearer}`);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = {
    ...loadEnv(mode, root, ""),
    ...loadEnv(mode, dashboardRoot, ""),
  };
  const msgfBackendEnv = loadMsgfBackendEnvLocal();
  const adminBearer = resolveAdminBearer(env, msgfBackendEnv);
  if (!adminBearer && mode === "development") {
    console.warn(
      `[msgf-dashboard] No admin Bearer for /api proxy. Add SUPABASE_SERVICE_ROLE_KEY to ${MSGF_BACKEND_ENV_LOCAL}`
    );
  }
  const msgfOrigin =
    env.VITE_MSGF_API_BASE_URL?.trim() ||
    env.MSGF_API_ORIGIN?.trim() ||
    MSGF_CLOUD_RUN_ORIGIN;

  const msgfProxy = createMsgfApiProxy(msgfOrigin, adminBearer);

  return {
    plugins: [tailwindcss(), react()],
    server: {
      /** Avoid collision with Next/MSGF (:3000) and other local apps. */
      port: 8080,
      strictPort: true,
      proxy: {
        // More specific prefix first so `/api/msgf/*` is not swallowed by `/api`.
        "/api/msgf": msgfProxy,
        "/api": msgfProxy,
      },
    },
    resolve: {
      alias: {
        "@msgf": path.join(root, "packages/msgf"),
      },
    },
    envDir: dashboardRoot,
  };
});
