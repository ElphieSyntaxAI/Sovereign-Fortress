/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Complete Google Workspace SSO: domain allowlist → attach company_id.
 */
import type { SupabaseClient, User } from "@supabase/supabase-js";

import {
  emailDomain,
  isBlockedConsumerDomain,
  lookupCompanyIdByEmailDomain,
} from "@/lib/services/company-domains";
import {
  extractGoogleHostedDomain,
  userHasGoogleIdentity,
} from "@/lib/services/google-sso-circuit";
import { appendVaultLog } from "@/lib/services/tenant-onboarding-vault";

export type WorkspaceSsoCompleteResult =
  | {
      ok: true;
      company_id: string;
      domain: string;
      redirect?: string;
    }
  | {
      ok: false;
      reason: "not_google" | "no_email" | "consumer_domain" | "domain_unmapped" | "profile_update_failed";
      redirect: string;
      message: string;
    };

function inviteOnlyRedirect(reason: string): string {
  return `/invite-only?reason=${encodeURIComponent(reason)}`;
}

/**
 * After Google OAuth session: map email/hd → company, attach p4_profiles.company_id.
 * Unmapped / consumer → invite-only (caller should sign out).
 */
export async function completeWorkspaceSso(
  admin: SupabaseClient,
  user: User,
  opts?: { nextPath?: string | null }
): Promise<WorkspaceSsoCompleteResult> {
  if (!userHasGoogleIdentity(user)) {
    return {
      ok: false,
      reason: "not_google",
      redirect: inviteOnlyRedirect("not_google"),
      message: "Workspace SSO requires a Google identity.",
    };
  }

  const email = user.email?.trim() ?? "";
  if (!email) {
    return {
      ok: false,
      reason: "no_email",
      redirect: inviteOnlyRedirect("no_email"),
      message: "Google account has no email.",
    };
  }

  const domainFromEmail = emailDomain(email);
  if (!domainFromEmail || isBlockedConsumerDomain(domainFromEmail)) {
    return {
      ok: false,
      reason: "consumer_domain",
      redirect: inviteOnlyRedirect("consumer_domain"),
      message: "Personal Google accounts cannot join company tenancy. Use a Workspace account or accept a team invite.",
    };
  }

  const hd = extractGoogleHostedDomain(user);
  // Prefer hd when present; still allow email domain if hd missing (unit criterion).
  const lookupKey = hd || domainFromEmail;
  const mapped = await lookupCompanyIdByEmailDomain(admin, lookupKey);

  // If hd present but unmapped, also try email domain (aliases).
  const resolved =
    mapped ||
    (hd && hd !== domainFromEmail
      ? await lookupCompanyIdByEmailDomain(admin, domainFromEmail)
      : null);

  if (!resolved) {
    return {
      ok: false,
      reason: "domain_unmapped",
      redirect: inviteOnlyRedirect("domain_unmapped"),
      message: `Domain @${lookupKey} is not registered for MSGF company access.`,
    };
  }

  const now = new Date().toISOString();
  const username = email.split("@")[0] || "member";

  const { error } = await admin.from("p4_profiles").upsert(
    {
      user_id: user.id,
      username,
      company_id: resolved.company_id,
      updated_at: now,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.warn("[workspace-sso] profile upsert failed:", error.message);
    return {
      ok: false,
      reason: "profile_update_failed",
      redirect: inviteOnlyRedirect("profile_update_failed"),
      message: "Could not attach company profile.",
    };
  }

  try {
    await appendVaultLog(admin, resolved.company_id, "workspace_sso_attached", {
      user_id: user.id,
      email,
      domain: resolved.domain,
      hd: hd ?? null,
    });
  } catch (e) {
    console.warn("[workspace-sso] vault log failed:", e);
  }

  const next = opts?.nextPath?.trim();
  const redirect =
    next && next.startsWith("/") && !next.startsWith("//")
      ? next
      : "/admin/portal";

  return {
    ok: true,
    company_id: resolved.company_id,
    domain: resolved.domain,
    redirect,
  };
}

/** True when email has a pending/accepted invite (password fallback when SSO circuit open). */
export async function hasPendingTeamInviteForEmail(
  admin: SupabaseClient,
  email: string
): Promise<boolean> {
  const e = email.trim().toLowerCase();
  if (!e) return false;
  const { data } = await admin
    .from("msgf_team_invites")
    .select("id")
    .ilike("email", e)
    .in("status", ["pending", "accepted"])
    .limit(1)
    .maybeSingle();
  return Boolean(data?.id);
}
