/**
 * Platform operator gate — aligned with MSGF `resolveSessionDashboardOperator`.
 * Author "platform operator" is GLOBAL_ADMIN only (cross-tenant). Individual
 * COMPANY_ADMIN sandboxes are not Author platform operators.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

function parseEmailAllowlist(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function parseGlobalAdminEmails(): string[] {
  return parseEmailAllowlist(
    process.env.MSGF_GLOBAL_ADMIN_EMAILS?.trim() ||
      process.env.NEXT_PUBLIC_MSGF_GLOBAL_ADMIN_EMAILS?.trim()
  );
}

function parseIndividualAdminEmails(): string[] {
  return parseEmailAllowlist(
    process.env.MSGF_INDIVIDUAL_ADMIN_EMAILS?.trim() ||
      process.env.NEXT_PUBLIC_MSGF_INDIVIDUAL_ADMIN_EMAILS?.trim()
  );
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

function isIndividualAdminEmail(email: string | null | undefined): boolean {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;
  if (isPlatformOperatorEmail(normalized)) return false;
  return parseIndividualAdminEmails().includes(normalized);
}

/**
 * Cross-tenant Author operator: `MSGF_GLOBAL_ADMIN_EMAILS` or leftover
 * `p4_profiles.msgf_access_role = GLOBAL_ADMIN`. Individual-admin emails never qualify.
 */
export async function resolvePlatformOperatorAccess(
  admin: SupabaseClient,
  params: { email?: string | null; userId?: string | null }
): Promise<boolean> {
  if (isIndividualAdminEmail(params.email)) return false;
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
