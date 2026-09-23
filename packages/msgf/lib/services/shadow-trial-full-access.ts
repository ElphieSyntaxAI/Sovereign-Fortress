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
 * Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
 */
/**
 * Sequential 3-day Individual Pro full access after Shadow Proxy proof.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { ensureMsgfPulseProfile } from "@/lib/msgf-onboarding";
import {
  INDIVIDUAL_TRIAL_3D_HOURS,
  INDIVIDUAL_TRIAL_3D_LICENSE_TYPE,
} from "@/lib/services/individual-perpetual-license";
import { mintIdeToken } from "@/lib/services/ide-token-service";
import { MSGF_TRIAL_3D_SLICE_SOFT_CAP } from "@/lib/services/paid-individual-usage";
import {
  getShadowTrialByStatusToken,
  type ShadowTrialRow,
} from "@/lib/services/shadow-trial";
import { sendTransactionalEmail } from "@/lib/services/transactional-email";
import { resolveMsgfAppOrigin } from "@elphie-syntax/core";
import { applyDeferredShadowP7 } from "@/lib/services/p7-observe";

export const FULL_ACCESS_TRIAL_CREDITS = 5_000;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function usernameFromTrial(trial: ShadowTrialRow): string {
  if (trial.name) return trial.name.slice(0, 128);
  const local = trial.email.split("@")[0]?.trim() || "trial";
  return local.slice(0, 128);
}

function computeFullAccessExpiresAt(now: Date): Date {
  return new Date(now.getTime() + INDIVIDUAL_TRIAL_3D_HOURS * 60 * 60 * 1000);
}

function laterIso(a: string | null | undefined, b: string): string {
  if (!a) return b;
  return new Date(a).getTime() > new Date(b).getTime() ? a : b;
}

async function createTrialMagicLink(
  admin: SupabaseClient,
  email: string,
  redirectTo: string
): Promise<string> {
  const magic = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });
  const magicLink = magic.data?.properties?.action_link?.trim();
  if (!magic.error && magicLink) return magicLink;

  const invite = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo },
  });
  const inviteLink = invite.data?.properties?.action_link?.trim();
  if (!invite.error && inviteLink) return inviteLink;

  throw new Error(
    magic.error?.message ||
      invite.error?.message ||
      "Could not create a sign-in link for this email."
  );
}

export type RequestFullAccessResult =
  | {
      ok: true;
      reused: boolean;
      email_sent: boolean;
      already_granted: boolean;
      message: string;
    }
  | { ok: false; error: string };

export async function requestShadowTrialFullAccess(
  admin: SupabaseClient,
  statusToken: string
): Promise<RequestFullAccessResult> {
  const trial = await getShadowTrialByStatusToken(admin, statusToken);
  if (!trial) {
    return { ok: false, error: "Trial not found." };
  }
  if (!trial.first_eval_at) {
    return {
      ok: false,
      error: "Send at least one Shadow Proxy call first, then start 3-day full access.",
    };
  }
  if (trial.full_access_started_at) {
    return {
      ok: true,
      reused: true,
      email_sent: false,
      already_granted: true,
      message:
        "3-day full access was already started on this email. Sign in with the magic link we sent, or open the trial dashboard.",
    };
  }

  const origin = resolveMsgfAppOrigin().replace(/\/$/, "");
  const next = `/shadow-trial?t=${encodeURIComponent(statusToken.trim())}&full=1`;
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  let actionLink: string;
  try {
    actionLink = await createTrialMagicLink(admin, trial.email, redirectTo);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not send sign-in link.",
    };
  }

  const result = await sendTransactionalEmail({
    to: trial.email,
    subject: "Start your 3-day MSGF Individual Pro trial",
    html: `
<p>${trial.name ? `Hi ${trial.name},` : "Hi there,"}</p>
<p>Click to sign in and unlock <strong>3 days of Individual Pro</strong> on the same tenant as your Shadow Proxy proof — dashboard, Pulse, IDE token, Active Governance, Vault/Hall.</p>
<p>Cloud CONVERGE is capped at <strong>${MSGF_TRIAL_3D_SLICE_SOFT_CAP.toLocaleString()} verification slices</strong> during the trial.</p>
<p><a href="${actionLink}">Start 3-day full access</a></p>
<p>This link is for <strong>${trial.email}</strong> only. One grant per email.</p>
<p>— Elphie Syntax · MSGF</p>
`.trim(),
    text: [
      "Start your 3-day MSGF Individual Pro trial",
      "",
      `Open: ${actionLink}`,
      "",
      `Slice cap: ${MSGF_TRIAL_3D_SLICE_SOFT_CAP} verification slices.`,
    ].join("\n"),
  });

  if (!result.ok && !result.skipped) {
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    reused: false,
    email_sent: result.ok,
    already_granted: false,
    message: result.ok
      ? "Check your trial email for a magic link to unlock 3-day Individual Pro."
      : `Sign-in link created. Add RESEND_API_KEY to email it, or open: ${actionLink}`,
  };
}

export type ActivateFullAccessResult =
  | {
      ok: true;
      reused: boolean;
      full_access_expires_at: string;
      ide_token: string | null;
      ide_token_expires_at: string | null;
      slice_soft_cap: number;
    }
  | { ok: false; error: string };

export async function activateShadowTrialFullAccess(
  admin: SupabaseClient,
  input: { statusToken: string; userId: string; email: string }
): Promise<ActivateFullAccessResult> {
  const trial = await getShadowTrialByStatusToken(admin, input.statusToken);
  if (!trial) {
    return { ok: false, error: "Trial not found." };
  }
  if (normalizeEmail(trial.email) !== normalizeEmail(input.email)) {
    return { ok: false, error: "Sign in with the same email that started this Shadow trial." };
  }
  if (!trial.first_eval_at) {
    return {
      ok: false,
      error: "Send at least one Shadow Proxy call first, then start 3-day full access.",
    };
  }

  if (trial.full_access_started_at && trial.full_access_expires_at) {
    try {
      await applyDeferredShadowP7(admin, trial.tenant_id);
    } catch (e) {
      console.warn("[shadow-trial] deferred P7 apply failed:", e instanceof Error ? e.message : e);
    }
    return {
      ok: true,
      reused: true,
      full_access_expires_at: trial.full_access_expires_at,
      ide_token: null,
      ide_token_expires_at: null,
      slice_soft_cap: MSGF_TRIAL_3D_SLICE_SOFT_CAP,
    };
  }

  const now = new Date();
  const fullAccessExpires = computeFullAccessExpiresAt(now);
  const fullAccessExpiresIso = fullAccessExpires.toISOString();
  const startedIso = now.toISOString();
  const licenseExpiresIso = laterIso(trial.expires_at, fullAccessExpiresIso);

  const { data: claimed, error: claimError } = await admin
    .from("msgf_shadow_trials")
    .update({
      full_access_started_at: startedIso,
      full_access_expires_at: fullAccessExpiresIso,
      full_access_user_id: input.userId,
    })
    .eq("id", trial.id)
    .is("full_access_started_at", null)
    .select("id")
    .maybeSingle();

  if (claimError) {
    return { ok: false, error: claimError.message };
  }
  if (!claimed) {
    const latest = await getShadowTrialByStatusToken(admin, input.statusToken);
    return {
      ok: true,
      reused: true,
      full_access_expires_at: latest?.full_access_expires_at ?? fullAccessExpiresIso,
      ide_token: null,
      ide_token_expires_at: null,
      slice_soft_cap: MSGF_TRIAL_3D_SLICE_SOFT_CAP,
    };
  }

  try {
    await ensureMsgfPulseProfile({
      supabase: admin,
      entityId: input.userId,
      tierId: 1,
      username: usernameFromTrial(trial),
      tenantId: trial.tenant_id,
      userRole: "msgf_entity",
    });
  } catch (e) {
    await admin
      .from("msgf_shadow_trials")
      .update({
        full_access_started_at: null,
        full_access_expires_at: null,
        full_access_user_id: null,
      })
      .eq("id", trial.id);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not create Pulse profile.",
    };
  }

  const { error: profileError } = await admin
    .from("p4_profiles")
    .update({
      tenant_id: trial.tenant_id,
      license_type: INDIVIDUAL_TRIAL_3D_LICENSE_TYPE,
      billing_license_type: "lifetime",
      license_purchase_date: startedIso,
      current_credits: FULL_ACCESS_TRIAL_CREDITS,
      stripe_subscription_status: null,
      updated_at: startedIso,
    })
    .eq("user_id", input.userId);

  if (profileError) {
    return { ok: false, error: profileError.message };
  }

  await admin
    .from("msgf_licenses")
    .update({
      status: "active",
      expires_at: licenseExpiresIso,
    })
    .eq("id", trial.license_id);

  const minted = await mintIdeToken(admin, {
    userId: input.userId,
    tenantId: trial.tenant_id,
    label: "Shadow trial · 3-day Individual Pro",
  });

  let ideToken: string | null = null;
  let ideExpires: string | null = null;
  if (!("error" in minted)) {
    ideToken = minted.token;
    ideExpires = fullAccessExpiresIso;
    await admin
      .from("msgf_ide_tokens")
      .update({ expires_at: fullAccessExpiresIso })
      .eq("id", minted.token_id);
  }

  try {
    await applyDeferredShadowP7(admin, trial.tenant_id);
  } catch (e) {
    console.warn("[shadow-trial] deferred P7 apply failed:", e instanceof Error ? e.message : e);
  }

  return {
    ok: true,
    reused: false,
    full_access_expires_at: fullAccessExpiresIso,
    ide_token: ideToken,
    ide_token_expires_at: ideExpires,
    slice_soft_cap: MSGF_TRIAL_3D_SLICE_SOFT_CAP,
  };
}

/** Expiry copy for the 3-day Individual Pro window. Price matches /pricing. */
export function buildFullAccessExpiryEmail(input: { name?: string | null }): {
  subject: string;
  html: string;
  text: string;
} {
  const origin = resolveMsgfAppOrigin().replace(/\/$/, "");
  const pricingUrl = `${origin}/pricing`;
  const workspaceUrl = `${origin}/workspace?tab=projects`;
  const greeting = input.name ? `Hi ${input.name},` : "Hi there,";
  return {
    subject: "Your 3-day MSGF Individual Pro trial ended",
    html: `
<p>${greeting}</p>
<p>Your <strong>3-day Individual Pro</strong> trial has ended. Enforcement mode, ingest, and cloud consensus on that trial key are off.</p>
<p>Keep the proof — subscribe to <strong>Individual Pro for $29/mo</strong> or <strong>$290/yr</strong>: <a href="${pricingUrl}">${pricingUrl}</a></p>
<p>Then set up Pulse Guard on <a href="${workspaceUrl}">Workspace Projects</a>.</p>
<p>— Elphie Syntax · MSGF</p>
`.trim(),
    text: [
      "Your 3-day MSGF Individual Pro trial ended.",
      "",
      `Subscribe to Individual Pro — $29/mo or $290/yr: ${pricingUrl}`,
      `Set up Pulse Guard: ${workspaceUrl}`,
    ].join("\n"),
  };
}

export async function expireShadowTrialFullAccess(
  admin: SupabaseClient,
  trial: {
    id: string;
    email: string;
    name: string | null;
    license_id: string;
    tenant_id: string;
    full_access_user_id: string | null;
    full_access_expires_at: string | null;
  }
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const expiresAt = trial.full_access_expires_at;
  if (!expiresAt || new Date(expiresAt).getTime() > Date.now()) {
    return { ok: true, skipped: true };
  }

  await admin
    .from("msgf_licenses")
    .update({ status: "expired" })
    .eq("id", trial.license_id);

  let shouldEmail = false;
  if (trial.full_access_user_id) {
    const { data: demoted } = await admin
      .from("p4_profiles")
      .update({
        license_type: null,
        billing_license_type: "free",
        current_credits: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", trial.full_access_user_id)
      .eq("license_type", INDIVIDUAL_TRIAL_3D_LICENSE_TYPE)
      .select("user_id")
      .maybeSingle();
    shouldEmail = Boolean(demoted);

    await admin
      .from("msgf_ide_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", trial.full_access_user_id)
      .eq("tenant_id", trial.tenant_id)
      .is("revoked_at", null);
  }

  if (!shouldEmail) {
    return { ok: true, skipped: true };
  }

  const email = buildFullAccessExpiryEmail({ name: trial.name });
  const result = await sendTransactionalEmail({
    to: trial.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });

  if (!result.ok && !result.skipped) {
    return { ok: false, error: result.error };
  }

  return { ok: true };
}

export async function processDueShadowTrialFullAccessExpiries(
  admin: SupabaseClient
): Promise<{ expired: number; errors: string[] }> {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("msgf_shadow_trials")
    .select(
      "id, email, name, license_id, tenant_id, full_access_user_id, full_access_expires_at"
    )
    .not("full_access_started_at", "is", null)
    .lte("full_access_expires_at", now)
    .limit(50);

  if (error) {
    return { expired: 0, errors: [error.message] };
  }

  let expired = 0;
  const errors: string[] = [];
  for (const row of data ?? []) {
    const result = await expireShadowTrialFullAccess(admin, {
      id: String(row.id),
      email: String(row.email ?? ""),
      name: typeof row.name === "string" ? row.name : null,
      license_id: String(row.license_id),
      tenant_id: String(row.tenant_id),
      full_access_user_id:
        typeof row.full_access_user_id === "string" ? row.full_access_user_id : null,
      full_access_expires_at:
        typeof row.full_access_expires_at === "string"
          ? row.full_access_expires_at
          : null,
    });
    if (result.ok && !result.skipped) expired += 1;
    else if (!result.ok && result.error) {
      errors.push(`${String(row.email)}: ${result.error}`);
    }
  }

  return { expired, errors };
}
