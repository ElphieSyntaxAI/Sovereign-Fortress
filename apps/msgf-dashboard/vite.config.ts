import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dashboardRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, "");
  const adminBearer =
    env.MSGF_ADMIN_BEARER_TOKEN?.trim() ||
    env.MSGF_ADMIN_API_KEY?.trim() ||
    env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "";
  const msgfOrigin = env.MSGF_API_ORIGIN?.trim() || "http://127.0.0.1:3000";

  return {
    plugins: [tailwindcss(), react()],
    server: {
      port: 5174,
      proxy: adminBearer
        ? {
            "/api/msgf": {
              target: msgfOrigin,
              changeOrigin: true,
              configure: (proxy) => {
                proxy.on("proxyReq", (proxyReq) => {
                  proxyReq.setHeader("Authorization", `Bearer ${adminBearer}`);
                });
              },
            },
          }
        : undefined,
    },
    resolve: {
      alias: {
        "@msgf": path.join(root, "packages/msgf"),
      },
    },
    envDir: dashboardRoot,
  };
});
