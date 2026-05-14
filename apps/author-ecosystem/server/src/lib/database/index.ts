/**
 * Database bootstrap for author-ecosystem server: monorepo root env + Supabase admin client.
 */

export { loadMonorepoRootEnv, getMonorepoRootDir } from "./loadRootEnv.js";
export {
  P4_EDITOR_LEDGER,
  P4_FORENSIC_PROFILES,
  P4_HAL_LEDGER,
  P4_HAL_LEDGER_ROLLING_AVG_5,
  P4_RECALIBRATION_LOGS,
} from "./canonicalIdentifiers.js";
export { getSupabaseAdmin } from "../supabaseAdmin.js";
