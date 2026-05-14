/**
 * Quick check that monorepo root `.env.local` / `.env` satisfy BFF startup (including SUPABASE_JWT_SECRET).
 *
 *   npm run verify:bff-env
 */
import { getMonorepoRootDir } from "../lib/database/loadRootEnv.js";
import { assertBffRequiredEnv } from "../lib/assertBffRequiredEnv.js";

assertBffRequiredEnv();
console.log(`[verify-bff-env] monorepo root: ${getMonorepoRootDir()}`);
console.log("[verify-bff-env] All required variables present and SUPABASE_JWT_SECRET passed HS256 self-check.");
