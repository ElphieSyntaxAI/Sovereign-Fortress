/**
 * Platform operator gate — same allowlist as MSGF admin sign-in (MSGF_GLOBAL_ADMIN_EMAILS).
 */
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

export function isPlatformOperatorEmail(email: string | null | undefined): boolean {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;
  const allow = parseGlobalAdminEmails();
  return allow.length > 0 && allow.includes(normalized);
}
