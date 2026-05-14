import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Monorepo root (`ElphieSyntaxLLC/`), resolved from `server/src/lib/database/`.
 * Keeps Supabase and optional DB_* vars aligned with `packages/msgf` and root `.env`.
 */
export function getMonorepoRootDir(): string {
  return join(__dirname, "..", "..", "..", "..", "..", "..");
}

let rootEnvLoaded = false;

/**
 * Loads root `.env` then `.env.local` (override) so `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
 * and `SUPABASE_SERVICE_ROLE_KEY` match the MSGF / root workspace configuration.
 *
 * When the TS BFF (`src/main.ts`) proxies `/api/rag` and `/api/lore-git` to the legacy Express
 * app, use the same `JWT_SECRET` as `verifyTokens` / legacy `msgf_legacy_users` auth so Bearer tokens verify on both stacks.
 */
export function loadMonorepoRootEnv(): void {
  if (rootEnvLoaded) return;
  rootEnvLoaded = true;
  const root = getMonorepoRootDir();
  dotenv.config({ path: join(root, ".env") });
  dotenv.config({ path: join(root, ".env.local"), override: true });
}
