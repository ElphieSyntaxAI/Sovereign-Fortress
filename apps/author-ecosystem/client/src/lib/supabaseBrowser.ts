import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (cached) return cached;
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
  if (!url || !key) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY (set at monorepo root .env.local).");
  }
  cached = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return cached;
}
