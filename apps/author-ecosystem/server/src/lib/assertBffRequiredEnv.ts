import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import jwt from "jsonwebtoken";

import { getMonorepoRootDir, loadMonorepoRootEnv } from "./database/loadRootEnv.js";

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
 * do not half-start. `JWT_SECRET` is optional (legacy JWT fallback only).
 *
 * `SUPABASE_JWT_SECRET` is required: it must match **Project Settings → API → JWT Secret** (used to
 * verify HS256 access tokens from `author_bff_jwt` / `Authorization: Bearer`).
 *
 * Env files are read from the **resolved monorepo root** (absolute path), not `process.cwd()`.
 */
export function assertBffRequiredEnv(): void {
  loadMonorepoRootEnv();
  const monorepoRoot = resolve(getMonorepoRootDir());

  const missing: string[] = [];
  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!supabaseUrl) missing.push("SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)");
  if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()) {
    missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  const jwtSecret = resolveSupabaseJwtSecret();
  if (!jwtSecret) {
    missing.push(
      "SUPABASE_JWT_SECRET (Supabase Dashboard → Settings → API → JWT Secret; or legacy JWT_SECRET in packages/msgf/.env.local)"
    );
  }
  if (missing.length) {
    const rootLocal = join(monorepoRoot, ".env.local");
    const msgfLocal = join(monorepoRoot, "packages", "msgf", ".env.local");
    const hint = [
      `monorepoRoot=${monorepoRoot}`,
      `root .env.local=${existsSync(rootLocal)}`,
      `packages/msgf/.env.local=${existsSync(msgfLocal)}`,
    ].join("; ");
    throw new Error(`BFF startup: missing required environment variables: ${missing.join(", ")} (${hint})`);
  }

  const jwtSecretResolved = jwtSecret!;
  try {
    const tok = jwt.sign({ sub: "__bff_jwt_self_test__" }, jwtSecretResolved, {
      algorithm: "HS256",
      expiresIn: "60s",
    });
    jwt.verify(tok, jwtSecretResolved, { algorithms: ["HS256"] });
  } catch (e) {
    throw new Error(
      `SUPABASE_JWT_SECRET is set but is not usable as an HS256 signing key (must match Supabase JWT Secret). ` +
        (e instanceof Error ? e.message : String(e))
    );
  }

  console.log(
    `[bff] env OK (root=${monorepoRoot}): Supabase URL + publishable + service role + SUPABASE_JWT_SECRET (HS256 self-check passed)`
  );
}
