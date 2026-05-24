const PLACEHOLDER_SUPABASE_HOSTS = new Set(["your-project.supabase.co"]);

/** True for `.env.example` placeholders that must not override `packages/msgf/.env.local`. */
export function isPlaceholderSupabaseUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed || trimmed.includes("change_me")) return true;
  try {
    return PLACEHOLDER_SUPABASE_HOSTS.has(new URL(trimmed).host);
  } catch {
    return true;
  }
}

/**
 * Canonical Supabase project URL for Author BFF / service-role clients.
 * MSGF SSOT is `NEXT_PUBLIC_SUPABASE_URL` in `packages/msgf/.env.local`.
 */
export function resolveSupabaseProjectUrl(): string {
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const legacy = process.env.SUPABASE_URL?.trim() ?? "";

  if (publishable && !isPlaceholderSupabaseUrl(publishable)) return publishable;
  if (legacy && !isPlaceholderSupabaseUrl(legacy)) return legacy;
  return publishable || legacy;
}

/** Align `SUPABASE_URL` with the resolved project URL after dotenv load. */
export function reconcileSupabaseEnv(): void {
  const resolved = resolveSupabaseProjectUrl();
  if (!resolved) return;

  const legacy = process.env.SUPABASE_URL?.trim() ?? "";
  if (!legacy || isPlaceholderSupabaseUrl(legacy) || legacy !== resolved) {
    process.env.SUPABASE_URL = resolved;
  }

  const publishable = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  if (!publishable || isPlaceholderSupabaseUrl(publishable)) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = resolved;
  }
}
