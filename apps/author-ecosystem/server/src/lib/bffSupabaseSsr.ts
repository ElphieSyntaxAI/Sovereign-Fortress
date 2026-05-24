import { createServerClient } from "@supabase/ssr";
import type { CookieOptions, Request, Response } from "express";

import { parseCookieHeader } from "./bffAuthCookies.js";
import { withBffSupabaseCookieOptions } from "./bffSupabaseCookieOptions.js";
import { loadMonorepoRootEnv } from "./database/loadRootEnv.js";
import { supabaseNodeClientOptions } from "./supabaseNodeRealtime.js";

/**
 * Browser-facing Supabase client for the author BFF (publishable key + cookie session).
 * Cookie read/write matches `@supabase/ssr` usage in `packages/msgf` so session storage is compatible.
 */
export function createBffSupabaseServerClient(req: Request, res: Response) {
  loadMonorepoRootEnv();
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY for BFF Supabase SSR"
    );
  }

  return createServerClient(supabaseUrl, supabaseKey, {
    ...supabaseNodeClientOptions(),
    cookies: {
      getAll() {
        const jar = parseCookieHeader(req.headers.cookie);
        return Object.entries(jar).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        const xf = req.headers["x-forwarded-host"];
        const forwarded = Array.isArray(xf) ? xf[0] : xf;
        const requestHost =
          typeof forwarded === "string"
            ? forwarded.split(",")[0]?.trim().split(":")[0]
            : req.headers.host?.split(":")[0];
        for (const { name, value, options } of cookiesToSet) {
          const merged = withBffSupabaseCookieOptions(
            options as Record<string, unknown> | undefined,
            requestHost
          );
          const path = merged.path ?? "/";
          const sameSite = merged.sameSite ?? "lax";
          const secure = Boolean(merged.secure);
          const httpOnly = Boolean((options as { httpOnly?: boolean } | undefined)?.httpOnly ?? true);
          const domain = merged.domain as string | undefined;
          const clearOpts = {
            path,
            httpOnly,
            sameSite: sameSite as "lax" | "strict" | "none",
            secure,
            ...(domain ? { domain } : {}),
          };
          if (!value) {
            res.clearCookie(name, clearOpts);
            continue;
          }
          const rawMaxAge = (options as { maxAge?: number } | undefined)?.maxAge;
          const cookieOpts: CookieOptions = { ...clearOpts };
          if (typeof rawMaxAge === "number" && rawMaxAge > 0) {
            // @supabase/ssr passes max-age in **seconds** (Set-Cookie); Express expects milliseconds.
            cookieOpts.maxAge = rawMaxAge * 1000;
          }
          res.cookie(name, value, cookieOpts);
        }
      },
    },
  });
}
