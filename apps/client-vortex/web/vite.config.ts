import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: { port: 5175 },
  resolve: {
    alias: {
      "@msgf": path.join(root, "packages/msgf"),
    },
  },
});
