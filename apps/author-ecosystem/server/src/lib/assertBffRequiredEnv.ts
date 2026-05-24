import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import jwt from "jsonwebtoken";

import { getMonorepoRootDir, loadMonorepoRootEnv } from "./database/loadRootEnv.js";
import {
  isPlaceholderSupabaseUrl,
  resolveSupabaseProjectUrl,
} from "./resolveSupabaseProjectUrl.js";

function resolveSupabaseJwtSecret(): string | null {
  const primary = process.env.SUPABASE_JWT_SECRET?.trim();
  if (primary) return primary;
  const legacy = process.env.JWT_SECRET?.trim();
  if (legacy) {
    console.warn(
      "[bff] Using legacy JWT_SECRET from env; set SUPABASE_JWT_SECRET to Supabase Dashboard → API → JWT Secret."
    );
    return legacy;
  }
  return null;
}

/**
 * Fail fast on missing secrets so Supabase-backed auth (`@supabase/ssr` + admin) and routes
 * do not half-start.
 *
 * **Required:** project URL, publishable key, service role key (new `sb_publishable_` / `sb_secret_`
 * or legacy anon / service_role from Dashboard → API Keys).
 *
 * **Optional:** `SUPABASE_JWT_SECRET` — only for local HS256 verify of Bearer tokens. New Supabase
 * projects often omit a separate JWT secret; the BFF validates sessions via Auth API + SSR cookies.
 */
export function assertBffRequiredEnv(): void {
  loadMonorepoRootEnv();
  const monorepoRoot = resolve(getMonorepoRootDir());

  const missing: string[] = [];
  const supabaseUrl = resolveSupabaseProjectUrl();
  if (!supabaseUrl) missing.push("SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)");
  if (supabaseUrl && isPlaceholderSupabaseUrl(supabaseUrl)) {
    missing.push(
      "real Supabase project URL in packages/msgf/.env.local (NEXT_PUBLIC_SUPABASE_URL; not your-project.supabase.co)"
    );
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()) {
    missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  if (missing.length) {
    const msgfLocal = join(monorepoRoot, "packages", "msgf", ".env.local");
    const hint = [
      `monorepoRoot=${monorepoRoot}`,
      `packages/msgf/.env.local exists=${existsSync(msgfLocal)}`,
    ].join("; ");
    throw new Error(
      `BFF startup: missing required environment variables: ${missing.join(", ")} (${hint})`
    );
  }

  const jwtSecret = resolveSupabaseJwtSecret();
  if (jwtSecret) {
    try {
      const tok = jwt.sign({ sub: "__bff_jwt_self_test__" }, jwtSecret, {
        algorithm: "HS256",
        expiresIn: "60s",
      });
      jwt.verify(tok, jwtSecret, { algorithms: ["HS256"] });
      console.log(
        `[bff] env OK (root=${monorepoRoot}): Supabase URL + publishable + service role + SUPABASE_JWT_SECRET (local HS256 verify)`
      );
    } catch (e) {
      throw new Error(
        `SUPABASE_JWT_SECRET is set but is not usable as an HS256 signing key. ` +
          (e instanceof Error ? e.message : String(e))
      );
    }
  } else {
    console.log(
      `[bff] env OK (root=${monorepoRoot}): Supabase URL + publishable + service role (Auth API session verify; no JWT secret in env)`
    );
  }
}
