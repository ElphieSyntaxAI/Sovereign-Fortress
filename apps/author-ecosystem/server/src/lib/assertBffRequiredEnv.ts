import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import jwt from "jsonwebtoken";

import { getMonorepoRootDir, loadMonorepoRootEnv } from "./database/loadRootEnv.js";

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
  if (!process.env.SUPABASE_JWT_SECRET?.trim()) {
    missing.push("SUPABASE_JWT_SECRET (Supabase Dashboard → Settings → API → JWT Secret)");
  }
  if (missing.length) {
    const envPath = join(monorepoRoot, ".env.local");
    const hint = [
      `monorepoRoot=${monorepoRoot}`,
      `.env exists=${existsSync(join(monorepoRoot, ".env"))}`,
      `.env.local exists=${existsSync(envPath)}`,
    ].join("; ");
    throw new Error(`BFF startup: missing required environment variables: ${missing.join(", ")} (${hint})`);
  }

  const jwtSecret = process.env.SUPABASE_JWT_SECRET!.trim();
  try {
    const tok = jwt.sign({ sub: "__bff_jwt_self_test__" }, jwtSecret, {
      algorithm: "HS256",
      expiresIn: "60s",
    });
    jwt.verify(tok, jwtSecret, { algorithms: ["HS256"] });
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
