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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
/**
 * Who may see Elphie Syntax internal monorepo workspace presets on /setup/projects.
 * External customers (e.g. @dealstar.io) get an empty list and use custom project mapping only.
 */

function parseEmailSuffixAllowlist(): string[] {
  const raw = process.env.MSGF_MONOREPO_PRESET_EMAIL_SUFFIXES?.trim();
  if (raw) {
    return raw
      .split(",")
      .map((s) => s.trim().toLowerCase().replace(/^@+/, ""))
      .filter(Boolean);
  }
  return ["elphiesyntax.com"];
}

function globalAdminEmailAllowlist(): Set<string> {
  const raw =
    process.env.MSGF_GLOBAL_ADMIN_EMAILS?.trim() ||
    process.env.NEXT_PUBLIC_MSGF_GLOBAL_ADMIN_EMAILS?.trim() ||
    "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

function emailMatchesSuffix(email: string, suffix: string): boolean {
  const normalized = email.trim().toLowerCase();
  const suf = suffix.trim().toLowerCase().replace(/^@+/, "");
  if (!normalized.includes("@") || !suf) return false;
  return normalized === suf || normalized.endsWith(`@${suf}`);
}

/**
 * True when the signed-in user may see `MONOREPO_WORKSPACE_PRESETS` in project setup.
 */
export function shouldShowMonorepoWorkspacePresets(email: string | null | undefined): boolean {
  const force =
    process.env.MSGF_SHOW_MONOREPO_PRESETS?.trim().toLowerCase() === "1" ||
    process.env.MSGF_SHOW_MONOREPO_PRESETS?.trim().toLowerCase() === "true";
  if (force) return true;

  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;

  if (globalAdminEmailAllowlist().has(normalized)) return true;

  return parseEmailSuffixAllowlist().some((suffix) => emailMatchesSuffix(normalized, suffix));
}
