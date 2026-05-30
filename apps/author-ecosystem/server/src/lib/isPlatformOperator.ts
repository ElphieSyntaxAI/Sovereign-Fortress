/**
 * Platform operator gate — aligned with MSGF `resolveSessionDashboardOperator`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export function parseGlobalAdminEmails(): string[] {
  const raw =
    process.env.MSGF_GLOBAL_ADMIN_EMAILS?.trim() ||
    process.env.NEXT_PUBLIC_MSGF_GLOBAL_ADMIN_EMAILS?.trim() ||
    "";
  if (!raw) return [];
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function isGlobalAdminRole(raw: unknown): boolean {
  const s = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  return s === "GLOBAL_ADMIN" || s === "GLOBAL" || s === "ADMIN" || s === "OWNER";
}

export function isPlatformOperatorEmail(email: string | null | undefined): boolean {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;
  const allow = parseGlobalAdminEmails();
  return allow.length > 0 && allow.includes(normalized);
}

/**
 * Email allowlist or `p4_profiles.msgf_access_role` (same sources as MSGF admin sign-in).
 */
export async function resolvePlatformOperatorAccess(
  admin: SupabaseClient,
  params: { email?: string | null; userId?: string | null }
): Promise<boolean> {
  if (isPlatformOperatorEmail(params.email)) return true;

  const userId = params.userId?.trim();
  if (!userId) return false;

  const { data, error } = await admin
    .from("p4_profiles")
    .select("msgf_access_role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[resolvePlatformOperatorAccess] profile lookup failed:", error.message);
    return false;
  }

  return isGlobalAdminRole(data?.msgf_access_role);
}
