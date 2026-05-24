import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { loadMonorepoRootEnv } from "./database/loadRootEnv.js";
import { resolveSupabaseProjectUrl } from "./resolveSupabaseProjectUrl.js";
import { supabaseNodeClientOptions } from "./supabaseNodeRealtime.js";

let cached: SupabaseClient | null = null;

/** Service-role client for server-side inserts (never expose key to browsers). */
export function getSupabaseAdmin(): SupabaseClient {
  loadMonorepoRootEnv();

  if (cached) return cached;

  const url = resolveSupabaseProjectUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  cached = createClient(
    url,
    key,
    supabaseNodeClientOptions({
      auth: { persistSession: false, autoRefreshToken: false },
    })
  );
  return cached;
}
