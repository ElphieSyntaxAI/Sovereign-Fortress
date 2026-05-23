/**
 * Mint Author Ecosystem MSGF pulse license + print BFF env lines.
 *
 *   npm run bootstrap:author-msgf -w msgf
 *
 * Requires: Supabase service role + licensing migration applied.
 * Copy printed MSGF_AUTHOR_PULSE_LICENSE_KEY into apps/author-ecosystem/server/.env
 * (or monorepo .env.local) alongside MSGF_APP_URL from packages/msgf/.env.local.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveMsgfLocalOrigin } from "./lib/msgf-local-origin.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mintScript = path.join(__dirname, "mint-license.mjs");
const tenant = process.env.MSGF_AUTHOR_TENANT_ID?.trim() || "author_ecosystem";
const credits = process.env.MSGF_AUTHOR_LICENSE_CREDITS?.trim() || "50000";

const nodeArgs = [
  mintScript,
  `--tenant=${tenant}`,
  "--tier=brain_contract",
  `--credits=${credits}`,
];

console.log("[bootstrap:author-msgf] Minting pulse license for tenant:", tenant);
const result = spawnSync(process.execPath, nodeArgs, {
  stdio: "inherit",
  env: process.env,
  cwd: path.join(__dirname, ".."),
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const appUrl = resolveMsgfLocalOrigin();

console.log(`
--- Author BFF (.env) ---

MSGF_APP_URL=${appUrl}
MSGF_AUTHOR_TENANT_ID=${tenant}
MSGF_AUTHOR_PULSE_LICENSE_KEY=<paste key printed above>
MSGF_AUTHOR_HAL_PULSE_ENABLED=1
MSGF_AUTHOR_DEV_SESSION=1

--- Observe token savings (MSGF dashboard) ---

${appUrl}/dashboard#token-savings?tenant_id=${encodeURIComponent(tenant)}

--- Stress test ---

npm run dev -w msgf
npm run dev --prefix apps/author-ecosystem/server
npm run probe:author-ecosystem -w msgf
npm run track:author-tokens:live -w msgf
`);
