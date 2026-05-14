/**
 * Prefer a Supabase access token for `Authorization: Bearer` on BFF calls so the server validates
 * with `SUPABASE_JWT_SECRET` before falling back to legacy `JWT_SECRET` cookies.
 */
export async function getPreferredBffBearer(): Promise<string | null> {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
  if (!url || !key) return null;
  try {
    const { getSupabaseBrowserClient } = await import("./supabaseBrowser");
    const { data } = await getSupabaseBrowserClient().auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}
