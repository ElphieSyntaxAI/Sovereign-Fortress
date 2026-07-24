/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-c1a5d75-20260723T221428Z-internal
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { withMsgfAuthCookieOptions } from "@/lib/msgf-auth-cookies";
import { supabaseNodeClientOptions } from "@/lib/supabase-node-realtime";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Host for cookie `Domain=` — prefer `X-Forwarded-Host` (Cloud Run / proxies). */
export function requestHostFromHeaders(headers: Headers): string | undefined {
  const xf = headers.get("x-forwarded-host");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first.split(":")[0]?.toLowerCase();
  }
  const host = headers.get("host");
  if (host) return host.split(":")[0]?.toLowerCase();
  return undefined;
}

export function requestHostFromRequest(request: Request): string | undefined {
  const xf = request.headers.get("x-forwarded-host");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first.split(":")[0]?.toLowerCase();
  }
  try {
    return new URL(request.url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

/**
 * @param requestHost — `Host` / `X-Forwarded-Host` / `URL.hostname` so `Domain=.elphiesyntax.com`
 *   is never applied on `*.run.app` (avoids rejected cookies and “stuck” sign-in).
 */
export const createClient = (
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  requestHost?: string | null
) => {
  return createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      ...supabaseNodeClientOptions(),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, withMsgfAuthCookieOptions(options, requestHost))
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
};
