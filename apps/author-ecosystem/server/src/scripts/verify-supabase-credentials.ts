/**
 * Verifies monorepo root `.env.local` loads Supabase vars and that the service-role client can read `p4_profiles`.
 *
 *   npm run test:supabase-p4
 *
 * Note: the `p4_profiles` query uses **SUPABASE_SERVICE_ROLE_KEY**, not `SUPABASE_JWT_SECRET`.
 * JWT secret is only for verifying user access tokens (BFF `readBearerUser`); a failed HS256
 * self-check is reported separately from PostgREST errors.
 */
import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";

import { getMonorepoRootDir, loadMonorepoRootEnv } from "../lib/database/loadRootEnv.js";

function mask(s: string | undefined, head = 10): string {
  const t = (s ?? "").trim();
  if (!t) return "(empty)";
  if (t.length <= head) return `${t.length} chars`;
  return `${t.slice(0, head)}… (${t.length} chars)`;
}

function describePublicUrl(s: string | undefined): string {
  const t = (s ?? "").trim();
  if (!t) return "(empty)";
  try {
    const u = new URL(t.includes("://") ? t : `https://${t}`);
    return `OK — host ${u.hostname} (${t.length} chars)`;
  } catch {
    return `set but invalid URL (${t.length} chars)`;
  }
}

async function run(): Promise<void> {
  loadMonorepoRootEnv();
  const root = getMonorepoRootDir();
  console.log(`[verify] monorepo root: ${root}`);

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim() || "";
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  const jwtSecret = process.env.SUPABASE_JWT_SECRET?.trim() || "";

  console.log(`[verify] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL: ${describePublicUrl(url)}`);
  console.log(`[verify] SUPABASE_SERVICE_ROLE_KEY: ${mask(service)}`);
  console.log(`[verify] SUPABASE_JWT_SECRET: ${mask(jwtSecret)}`);

  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL");
  if (!service) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!jwtSecret) missing.push("SUPABASE_JWT_SECRET");
  if (missing.length) {
    console.error(`[verify] FAIL: missing: ${missing.join(", ")}`);
    process.exit(1);
  }

  try {
    const tok = jwt.sign({ sub: "__p4_verify__" }, jwtSecret, { algorithm: "HS256", expiresIn: "60s" });
    jwt.verify(tok, jwtSecret, { algorithms: ["HS256"] });
    console.log("[verify] SUPABASE_JWT_SECRET: HS256 sign+verify OK (correct shape for BFF token checks)");
  } catch (e) {
    console.error(
      "[verify] SUPABASE_JWT_SECRET: HS256 self-check FAILED — use Dashboard → Settings → API → JWT Secret (not anon/service keys).",
      e instanceof Error ? e.message : e
    );
    process.exit(1);
  }

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.from("p4_profiles").select("user_id, legacy_user_id, username").limit(3);
  if (error) {
    console.error("[verify] p4_profiles query FAILED:", error.message, error.code ?? "");
    if (error.message.includes("relation") && error.message.includes("does not exist")) {
      console.error(
        "[verify] Hint: apply migrations under packages/msgf/supabase/migrations (e.g. 20260514140000_p4_profiles.sql)."
      );
    }
    console.error(
      "[verify] Note: PostgREST/table errors are unrelated to SUPABASE_JWT_SECRET; JWT is only for verifying user access tokens."
    );
    process.exit(1);
  }
  console.log("[verify] p4_profiles query OK. sample row count:", Array.isArray(data) ? data.length : 0);
  if (Array.isArray(data) && data.length) {
    console.log("[verify] sample:", JSON.stringify(data[0]));
  } else {
    console.log("[verify] table exists; zero rows (expected if no profiles yet).");
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
