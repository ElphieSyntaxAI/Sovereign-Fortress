/**

 * Quick check that monorepo root `.env.local` / `.env` satisfy BFF startup (including SUPABASE_JWT_SECRET).

 * Also reports Author ↔ MSGF bridge readiness and dashboard URLs for token-savings visibility.

 *

 *   npm run verify:bff-env

 */

import { getMonorepoRootDir } from "../lib/database/loadRootEnv.js";

import { assertBffRequiredEnv } from "../lib/assertBffRequiredEnv.js";

import { getAuthorMsgfMappingStatus } from "../lib/authorMsgfMapping.js";



try {
  assertBffRequiredEnv();
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}

const mapping = getAuthorMsgfMappingStatus();



console.log(`[verify-bff-env] monorepo root: ${getMonorepoRootDir()}`);

console.log("[verify-bff-env] All required variables present (publishable + service role; JWT secret optional).");

console.log(

  `[verify-bff-env] MSGF bridge: ${mapping.ready ? "ready" : "incomplete"} tenant=${mapping.tenant_id} origin=${mapping.project_origin}`

);

if (!mapping.ready) {

  console.log(`[verify-bff-env] Missing: ${mapping.missing.join(", ")}`);

  console.log(`[verify-bff-env] Mint license: ${mapping.stress_test_commands.mint_license}`);

}

if (mapping.dashboard_links.token_savings) {

  console.log(`[verify-bff-env] Token savings: ${mapping.dashboard_links.token_savings}`);

}

if (mapping.msgf_app_url) {
  const rootUrl = mapping.msgf_app_url.replace(/\/+$/, "");
  fetch(rootUrl, { redirect: "manual" })
    .then((r) => {
      console.log(`[verify-bff-env] MSGF reachable: ${r.status} ${rootUrl}`);
    })
    .catch((e) => {
      console.warn(
        `[verify-bff-env] MSGF unreachable (${rootUrl}):`,
        e instanceof Error ? e.message : e
      );
    });
}

