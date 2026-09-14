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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
/**
 * Free 7-day Shadow Proxy trials — mint keys, start clock on first eval, end-of-window reports.
 */

import { createHash, randomBytes } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getShadowEvalSummary24h,
  listRecentShadowEvaluations,
  listShadowEvaluationsForProof,
  type ShadowEvalSummary24h,
} from "@/lib/shadow-eval/shadow-ledger";
import {
  computeShadowProof,
  EMPTY_SHADOW_PROOF,
  SHADOW_PROOF_SCOPE_DISCLAIMER,
  type ShadowProofLedger,
} from "@/lib/shadow-eval/shadow-proof";
import {
  computeShadowTrialActivationExpiresAt,
  computeShadowTrialWindowExpiresAt,
  evaluateShadowTrialClock,
  isShadowTrialFullAccessLive,
  isShadowTrialTenantId,
  SHADOW_TRIAL_ACTIVATION_DAYS,
  SHADOW_TRIAL_CREDITS,
  SHADOW_TRIAL_TIER,
  shouldExpireUnusedShadowTrial,
  shouldSendShadowTrialProofReport,
} from "@/lib/services/shadow-trial-clock";
import {
  isTransactionalEmailConfigured,
  parseGlobalAdminEmails,
  sendTransactionalEmail,
} from "@/lib/services/transactional-email";
import { resolveMsgfAppOrigin } from "@elphie-syntax/core";

export {
  computeShadowTrialActivationExpiresAt,
  computeShadowTrialWindowExpiresAt,
  evaluateShadowTrialClock,
  isShadowTrialFullAccessLive,
  isShadowTrialLicenseTier,
  isShadowTrialTenantId,
  resolveEffectiveGatewayMode,
  SHADOW_TRIAL_ACTIVATION_DAYS,
  SHADOW_TRIAL_CREDITS,
  SHADOW_TRIAL_HOURS,
  SHADOW_TRIAL_TIER,
  shouldExpireUnusedShadowTrial,
  shouldSendShadowTrialProofReport,
} from "@/lib/services/shadow-trial-clock";

export type ShadowTrialRow = {
  id: string;
  email: string;
  name: string | null;
  tenant_id: string;
  license_id: string;
  started_at: string;
  expires_at: string;
  report_sent_at: string | null;
  welcome_sent_at: string | null;
  first_eval_at: string | null;
  activation_expires_at: string | null;
  full_access_started_at: string | null;
  full_access_expires_at: string | null;
  full_access_user_id: string | null;
};

function sha256HexUtf8(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function mintTestKey(): string {
  return `msgf_test_${randomBytes(32).toString("base64url")}`;
}

function mintStatusToken(): string {
  return randomBytes(32).toString("base64url");
}

function mintTrialTenantId(): string {
  return `shadow_trial_${randomBytes(4).toString("hex")}`;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function optionalIso(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function mapTrialRow(row: Record<string, unknown>): ShadowTrialRow {
  return {
    id: String(row.id ?? ""),
    email: String(row.email ?? ""),
    name: typeof row.name === "string" && row.name.trim() ? row.name.trim() : null,
    tenant_id: String(row.tenant_id ?? ""),
    license_id: String(row.license_id ?? ""),
    started_at: String(row.started_at ?? ""),
    expires_at: String(row.expires_at ?? ""),
    report_sent_at:
      typeof row.report_sent_at === "string" ? row.report_sent_at : null,
    welcome_sent_at:
      typeof row.welcome_sent_at === "string" ? row.welcome_sent_at : null,
    first_eval_at: optionalIso(row.first_eval_at),
    activation_expires_at: optionalIso(row.activation_expires_at),
    full_access_started_at: optionalIso(row.full_access_started_at),
    full_access_expires_at: optionalIso(row.full_access_expires_at),
    full_access_user_id: optionalIso(row.full_access_user_id),
  };
}

export function buildShadowTrialStatusUrl(statusToken: string): string {
  const origin = resolveMsgfAppOrigin().replace(/\/$/, "");
  return `${origin}/shadow-trial?t=${encodeURIComponent(statusToken)}`;
}

export function formatUsd(value: number): string {
  return `$${value.toFixed(4)}`;
}

export type ShadowTrialSummary = ShadowEvalSummary24h & {
  expired: boolean;
  expires_at: string;
  started_at: string;
  email: string;
  report_sent: boolean;
  proof: ShadowProofLedger;
  awaiting_first_eval: boolean;
  first_eval_at: string | null;
  activation_expires_at: string | null;
  full_access_started: boolean;
  full_access_live: boolean;
  full_access_expires_at: string | null;
};

export async function findTrialByEmail(
  admin: SupabaseClient,
  email: string
): Promise<ShadowTrialRow | null> {
  const normalized = normalizeEmail(email);
  const { data, error } = await admin
    .from("msgf_shadow_trials")
    .select("*")
    .ilike("email", normalized)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return data ? mapTrialRow(data as Record<string, unknown>) : null;
}

export async function findActiveTrialByEmail(
  admin: SupabaseClient,
  email: string
): Promise<ShadowTrialRow | null> {
  const existing = await findTrialByEmail(admin, email);
  if (!existing) return null;
  const clock = evaluateShadowTrialClock(existing);
  if (clock.expired && !isShadowTrialFullAccessLive(existing.full_access_expires_at)) {
    return null;
  }
  return existing;
}

export async function getShadowTrialByStatusToken(
  admin: SupabaseClient,
  statusToken: string
): Promise<ShadowTrialRow | null> {
  const token = statusToken.trim();
  if (!token) return null;
  const hash = sha256HexUtf8(token);
  const { data, error } = await admin
    .from("msgf_shadow_trials")
    .select("*")
    .eq("status_token_hash", hash)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapTrialRow(data as Record<string, unknown>) : null;
}

export async function getShadowTrialSummary(
  admin: SupabaseClient,
  trial: ShadowTrialRow
): Promise<ShadowTrialSummary> {
  const [summary, recent, proofRows] = await Promise.all([
    getShadowEvalSummary24h(trial.tenant_id),
    listRecentShadowEvaluations(admin, trial.tenant_id, 25),
    listShadowEvaluationsForProof(admin, trial.tenant_id, trial.started_at),
  ]);

  const proof =
    proofRows.length > 0 ? computeShadowProof(proofRows) : EMPTY_SHADOW_PROOF;
  const clock = evaluateShadowTrialClock(trial);
  const fullAccessLive = isShadowTrialFullAccessLive(trial.full_access_expires_at);

  const meta = {
    expired: clock.expired,
    expires_at: trial.expires_at,
    started_at: trial.started_at,
    email: trial.email,
    report_sent: Boolean(trial.report_sent_at),
    proof,
    awaiting_first_eval: clock.awaitingFirstEval,
    first_eval_at: trial.first_eval_at,
    activation_expires_at: trial.activation_expires_at,
    full_access_started: Boolean(trial.full_access_started_at),
    full_access_live: fullAccessLive,
    full_access_expires_at: trial.full_access_expires_at,
  };

  // When Redis window rolled off, fall back to PG for trial lifetime totals.
  if (summary.evaluation_count === 0 && recent.length > 0) {
    let evaluation_count = recent.length;
    let actual_cost_usd = 0;
    let projected_savings_usd = 0;
    for (const row of recent) {
      actual_cost_usd += Number(row.actual_cost_usd ?? 0) || 0;
      projected_savings_usd += Number(row.savings_potential_usd ?? 0) || 0;
    }
    const { count } = await admin
      .from("msgf_shadow_evaluation_logs")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", trial.tenant_id)
      .gte("observed_at", trial.started_at);
    if (typeof count === "number" && count > evaluation_count) {
      evaluation_count = count;
    }
    return {
      tenant_id: trial.tenant_id,
      window_hours: 24,
      evaluation_count,
      actual_cost_usd: Math.round(actual_cost_usd * 1_000_000) / 1_000_000,
      projected_savings_usd:
        Math.round(projected_savings_usd * 1_000_000) / 1_000_000,
      ...meta,
    };
  }

  return {
    ...summary,
    ...meta,
  };
}

export async function markShadowTrialFirstEval(
  admin: SupabaseClient,
  tenantId: string,
  at: Date = new Date()
): Promise<{ started: boolean; expires_at: string | null }> {
  const tid = tenantId.trim();
  if (!isShadowTrialTenantId(tid)) {
    return { started: false, expires_at: null };
  }

  const { data, error } = await admin
    .from("msgf_shadow_trials")
    .select("id, license_id, first_eval_at, expires_at")
    .eq("tenant_id", tid)
    .maybeSingle();

  if (error || !data) {
    return { started: false, expires_at: null };
  }
  if (data.first_eval_at) {
    return {
      started: false,
      expires_at: typeof data.expires_at === "string" ? data.expires_at : null,
    };
  }

  const expiresAt = computeShadowTrialWindowExpiresAt(at).toISOString();
  const nowIso = at.toISOString();

  const { data: updated, error: updateError } = await admin
    .from("msgf_shadow_trials")
    .update({ first_eval_at: nowIso, expires_at: expiresAt })
    .eq("id", data.id)
    .is("first_eval_at", null)
    .select("id")
    .maybeSingle();

  if (updateError || !updated) {
    return { started: false, expires_at: expiresAt };
  }

  await admin
    .from("msgf_licenses")
    .update({ expires_at: expiresAt, status: "active" })
    .eq("id", data.license_id);

  return { started: true, expires_at: expiresAt };
}

function buildWelcomeEmailHtml(input: {
  name: string | null;
  msgfKey: string;
  statusUrl: string;
  activationExpiresAt: string;
}): string {
  const greeting = input.name ? `Hi ${input.name},` : "Hi there,";
  const unusedBy = new Date(input.activationExpiresAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return `
<p>${greeting}</p>
<p>Your <strong>free Shadow Proxy trial</strong> is live — up to <strong>7 days</strong>, starting on your first Shadow call (not signup). Point OpenAI or Anthropic SDKs at MSGF with <code>x-msgf-mode: shadow</code> — zero extra latency. We count duplicate calls, retry loops, and policy-risk prompts in the background.</p>
<p><strong>MSGF key (save this — shown once):</strong><br/><code>${input.msgfKey}</code></p>
<p><strong>Live savings dashboard:</strong><br/><a href="${input.statusUrl}">${input.statusUrl}</a></p>
<p>If the key is unused, it expires ${unusedBy}. After your first call we email a proof report when the 7-day window closes, with a CTA to start 3-day Individual Pro full access.</p>
<p>— Elphie Syntax · MSGF Gated AI</p>
`.trim();
}

function buildReportEmailHtml(input: {
  name: string | null;
  summary: ShadowTrialSummary;
  statusUrl: string;
}): string {
  const greeting = input.name ? `Hi ${input.name},` : "Hi there,";
  const proof = input.summary.proof;
  const fullCta = `${input.statusUrl}${input.statusUrl.includes("?") ? "&" : "?"}full=1`;
  return `
<p>${greeting}</p>
<p>Your <strong>7-day Shadow Proxy</strong> window has ended.</p>
<p><strong>${proof.headline}</strong></p>
<ul>
  <li><strong>Duplicate calls skipped:</strong> ${proof.duplicate_calls.toLocaleString()} (${formatUsd(proof.duplicate_cost_usd)} you already paid twice)</li>
  <li><strong>Retry-loop prompts:</strong> ${proof.retry_loop_prompts.toLocaleString()} (Hall would have stopped the known-bad path)</li>
  <li><strong>Policy-risk prompts:</strong> ${proof.policy_flags.toLocaleString()} (DEFEND would have flagged before the model answered)</li>
  <li><strong>Oversized context dumps:</strong> ${proof.fat_context_calls.toLocaleString()}</li>
</ul>
<p>Token projection (footnote — not the headline): ${input.summary.evaluation_count.toLocaleString()} evals · pass-through ${formatUsd(input.summary.actual_cost_usd)} · projected ${formatUsd(input.summary.projected_savings_usd)}. Projected ≠ proven eco. Duplicate $ is what you already spent on identical prompts.</p>
<p><em>Disclaimer:</em> ${SHADOW_PROOF_SCOPE_DISCLAIMER}</p>
<p>Review the live ledger: <a href="${input.statusUrl}">${input.statusUrl}</a></p>
<p><strong>Next:</strong> <a href="${fullCta}">Start 3-day full access</a> — Individual Pro cloud (dashboard, Pulse, IDE token, Active Governance, Vault/Hall) on the same tenant as this proof ledger.</p>
<p>— Elphie Syntax · MSGF Gated AI</p>
`.trim();
}

function buildReportEmailText(input: {
  summary: ShadowTrialSummary;
  statusUrl: string;
}): string {
  const proof = input.summary.proof;
  const fullCta = `${input.statusUrl}${input.statusUrl.includes("?") ? "&" : "?"}full=1`;
  return [
    "MSGF Shadow Proxy — trial proof report",
    "",
    proof.headline,
    "",
    `Duplicate calls: ${proof.duplicate_calls} (${formatUsd(proof.duplicate_cost_usd)})`,
    `Retry-loop prompts: ${proof.retry_loop_prompts}`,
    `Policy-risk prompts: ${proof.policy_flags}`,
    `Oversized context dumps: ${proof.fat_context_calls}`,
    "",
    `Evals: ${input.summary.evaluation_count}`,
    `Pass-through: ${formatUsd(input.summary.actual_cost_usd)}`,
    `Projected token savings (footnote): ${formatUsd(input.summary.projected_savings_usd)}`,
    "",
    `Disclaimer: ${SHADOW_PROOF_SCOPE_DISCLAIMER}`,
    "",
    `Dashboard: ${input.statusUrl}`,
    `Start 3-day full access: ${fullCta}`,
    "",
    "Duplicate $ is money already spent on identical prompts. Hall/policy counts are pattern matches — not a hallucination detector.",
  ].join("\n");
}

export async function notifyAdminsNewShadowTrial(input: {
  email: string;
  name: string | null;
  tenantId: string;
  statusUrl: string;
  expiresAt: string;
}): Promise<void> {
  const admins = parseGlobalAdminEmails();
  if (!admins.length || !isTransactionalEmailConfigured()) return;

  const subject = `[MSGF] Shadow trial started — ${input.email}`;
  const html = `
<p>New 7-day Shadow Proxy trial (clock starts on first eval; unused key dies in ${SHADOW_TRIAL_ACTIVATION_DAYS} days):</p>
<ul>
  <li>Email: ${input.email}</li>
  <li>Name: ${input.name ?? "—"}</li>
  <li>Tenant: ${input.tenantId}</li>
  <li>Activation deadline: ${input.expiresAt}</li>
</ul>
<p><a href="${input.statusUrl}">Open live savings dashboard</a></p>
`.trim();

  await sendTransactionalEmail({ to: admins, subject, html });
}

export type StartShadowTrialResult =
  | {
      ok: true;
      reused: false;
      msgf_key: string;
      status_token: string;
      status_url: string;
      tenant_id: string;
      expires_at: string;
      email_sent: boolean;
    }
  | {
      ok: true;
      reused: true;
      status_url: string;
      tenant_id: string;
      expires_at: string;
      message: string;
    }
  | { ok: false; error: string };

export async function startShadowTrial(
  admin: SupabaseClient,
  input: { email: string; name?: string | null }
): Promise<StartShadowTrialResult> {
  const email = normalizeEmail(input.email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const existing = await findTrialByEmail(admin, email);
  if (existing) {
    const clock = evaluateShadowTrialClock(existing);
    const fallbackStatusUrl = `${resolveMsgfAppOrigin().replace(/\/$/, "")}/shadow-trial`;
    if (!clock.expired || isShadowTrialFullAccessLive(existing.full_access_expires_at)) {
      return {
        ok: true,
        reused: true,
        status_url: fallbackStatusUrl,
        tenant_id: existing.tenant_id,
        expires_at: existing.expires_at,
        message:
          "You already have an active Shadow Proxy trial on this email. Check your inbox for the status link and MSGF key.",
      };
    }
    return {
      ok: false,
      error: "This email already used the free Shadow Proxy trial (one per email).",
    };
  }

  const plainKey = mintTestKey();
  const licenseKeyHash = sha256HexUtf8(plainKey);
  const statusToken = mintStatusToken();
  const statusTokenHash = sha256HexUtf8(statusToken);
  const tenantId = mintTrialTenantId();
  const now = new Date();
  const activationExpiresAt = computeShadowTrialActivationExpiresAt(now);

  const { data: license, error: licenseError } = await admin
    .from("msgf_licenses")
    .insert({
      license_key_hash: licenseKeyHash,
      tenant_id: tenantId,
      tier_id: SHADOW_TRIAL_TIER,
      credits_total: SHADOW_TRIAL_CREDITS,
      credits_used: 0,
      status: "active",
      expires_at: activationExpiresAt.toISOString(),
    })
    .select("id")
    .single();

  if (licenseError || !license?.id) {
    return {
      ok: false,
      error: licenseError?.message ?? "Could not mint trial license.",
    };
  }

  const name =
    typeof input.name === "string" && input.name.trim() ? input.name.trim() : null;

  const { error: trialError } = await admin.from("msgf_shadow_trials").insert({
    email,
    name,
    tenant_id: tenantId,
    license_id: license.id,
    status_token_hash: statusTokenHash,
    expires_at: activationExpiresAt.toISOString(),
    activation_expires_at: activationExpiresAt.toISOString(),
  });

  if (trialError) {
    await admin.from("msgf_licenses").delete().eq("id", license.id);
    return { ok: false, error: trialError.message };
  }

  const statusUrl = buildShadowTrialStatusUrl(statusToken);
  let emailSent = false;

  const welcome = await sendTransactionalEmail({
    to: email,
    subject: "Your free 7-day MSGF Shadow Proxy trial",
    html: buildWelcomeEmailHtml({
      name,
      msgfKey: plainKey,
      statusUrl,
      activationExpiresAt: activationExpiresAt.toISOString(),
    }),
    text: [
      "Your free Shadow Proxy trial is live — up to 7 days, starting on your first call.",
      "",
      `MSGF key (save this): ${plainKey}`,
      `Live dashboard: ${statusUrl}`,
      "",
      `Unused key expires ${activationExpiresAt.toISOString()} (${SHADOW_TRIAL_ACTIVATION_DAYS} days from signup).`,
    ].join("\n"),
  });

  if (welcome.ok) {
    emailSent = true;
    await admin
      .from("msgf_shadow_trials")
      .update({ welcome_sent_at: new Date().toISOString() })
      .eq("status_token_hash", statusTokenHash);
  }

  void notifyAdminsNewShadowTrial({
    email,
    name,
    tenantId,
    statusUrl,
    expiresAt: activationExpiresAt.toISOString(),
  });

  return {
    ok: true,
    reused: false,
    msgf_key: plainKey,
    status_token: statusToken,
    status_url: statusUrl,
    tenant_id: tenantId,
    expires_at: activationExpiresAt.toISOString(),
    email_sent: emailSent,
  };
}

export async function sendShadowTrialReport(
  admin: SupabaseClient,
  trial: ShadowTrialRow,
  statusToken?: string
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  if (trial.report_sent_at) {
    return { ok: true, skipped: true };
  }
  if (!shouldSendShadowTrialProofReport(trial)) {
    return { ok: true, skipped: true };
  }

  const summary = await getShadowTrialSummary(admin, trial);
  const statusUrl = statusToken
    ? buildShadowTrialStatusUrl(statusToken)
    : buildShadowTrialStatusUrl("your-status-link");

  const result = await sendTransactionalEmail({
    to: trial.email,
    subject: "Your MSGF Shadow Proxy proof report",
    html: buildReportEmailHtml({ name: trial.name, summary, statusUrl }),
    text: buildReportEmailText({ summary, statusUrl }),
  });

  if (!result.ok) {
    if (result.skipped) {
      return { ok: false, skipped: true, error: result.reason };
    }
    return { ok: false, error: result.error };
  }

  await admin
    .from("msgf_shadow_trials")
    .update({ report_sent_at: new Date().toISOString() })
    .eq("id", trial.id);

  if (!isShadowTrialFullAccessLive(trial.full_access_expires_at)) {
    await admin
      .from("msgf_licenses")
      .update({ status: "expired" })
      .eq("id", trial.license_id);
  }

  return { ok: true };
}

async function expireUnusedShadowTrials(
  admin: SupabaseClient
): Promise<{ expired: number; errors: string[] }> {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("msgf_shadow_trials")
    .select("*")
    .is("first_eval_at", null)
    .lte("expires_at", now)
    .limit(50);

  if (error) {
    return { expired: 0, errors: [error.message] };
  }

  const rows = (data ?? []).map((r) => mapTrialRow(r as Record<string, unknown>));
  let expired = 0;
  const errors: string[] = [];

  for (const trial of rows) {
    if (!shouldExpireUnusedShadowTrial(trial)) continue;
    const { error: licenseError } = await admin
      .from("msgf_licenses")
      .update({ status: "expired" })
      .eq("id", trial.license_id);
    if (licenseError) {
      errors.push(`${trial.email}: ${licenseError.message}`);
      continue;
    }
    expired += 1;
  }

  return { expired, errors };
}

export async function processDueShadowTrialReports(
  admin: SupabaseClient
): Promise<{
  processed: number;
  emailed: number;
  unused_expired: number;
  errors: string[];
}> {
  const unused = await expireUnusedShadowTrials(admin);

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("msgf_shadow_trials")
    .select("*")
    .is("report_sent_at", null)
    .not("first_eval_at", "is", null)
    .lte("expires_at", now)
    .order("expires_at", { ascending: true })
    .limit(50);

  if (error) {
    return {
      processed: 0,
      emailed: 0,
      unused_expired: unused.expired,
      errors: [...unused.errors, error.message],
    };
  }

  const rows = (data ?? []).map((r) => mapTrialRow(r as Record<string, unknown>));
  let emailed = 0;
  const errors: string[] = [...unused.errors];

  for (const trial of rows) {
    const result = await sendShadowTrialReport(admin, trial);
    if (result.ok && !result.skipped) emailed += 1;
    else if (!result.ok && result.error && !result.skipped) {
      errors.push(`${trial.email}: ${result.error}`);
    }
  }

  return {
    processed: rows.length,
    emailed,
    unused_expired: unused.expired,
    errors,
  };
}
