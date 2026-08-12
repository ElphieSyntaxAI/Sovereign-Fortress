/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */
/**
 * Free 24h Shadow Proxy trials — mint keys, status tokens, end-of-trial reports.
 */

import { createHash, randomBytes } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getShadowEvalSummary24h,
  listRecentShadowEvaluations,
  type ShadowEvalSummary24h,
} from "@/lib/shadow-eval/shadow-ledger";
import {
  isTransactionalEmailConfigured,
  parseGlobalAdminEmails,
  sendTransactionalEmail,
} from "@/lib/services/transactional-email";
import { resolveMsgfAppOrigin } from "@elphie-syntax/core";

export const SHADOW_TRIAL_HOURS = 24;
export const SHADOW_TRIAL_TIER = "shadow_trial_24h";
export const SHADOW_TRIAL_CREDITS = 50_000;

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
  };
}

export function buildShadowTrialStatusUrl(statusToken: string): string {
  const origin = resolveMsgfAppOrigin("msgf").replace(/\/$/, "");
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
};

export async function findActiveTrialByEmail(
  admin: SupabaseClient,
  email: string
): Promise<ShadowTrialRow | null> {
  const normalized = normalizeEmail(email);
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("msgf_shadow_trials")
    .select("*")
    .ilike("email", normalized)
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return data ? mapTrialRow(data as Record<string, unknown>) : null;
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
  const [summary, recent] = await Promise.all([
    getShadowEvalSummary24h(trial.tenant_id),
    listRecentShadowEvaluations(admin, trial.tenant_id, 25),
  ]);

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
      expired: new Date(trial.expires_at).getTime() <= Date.now(),
      expires_at: trial.expires_at,
      started_at: trial.started_at,
      email: trial.email,
      report_sent: Boolean(trial.report_sent_at),
    };
  }

  return {
    ...summary,
    expired: new Date(trial.expires_at).getTime() <= Date.now(),
    expires_at: trial.expires_at,
    started_at: trial.started_at,
    email: trial.email,
    report_sent: Boolean(trial.report_sent_at),
  };
}

function buildWelcomeEmailHtml(input: {
  name: string | null;
  msgfKey: string;
  statusUrl: string;
  expiresAt: string;
}): string {
  const greeting = input.name ? `Hi ${input.name},` : "Hi there,";
  const expires = new Date(input.expiresAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return `
<p>${greeting}</p>
<p>Your <strong>free 24-hour Shadow Proxy</strong> is live. Point OpenAI or Anthropic SDKs at MSGF with <code>x-msgf-mode: shadow</code> — zero latency pass-through, projected savings recorded in the background.</p>
<p><strong>MSGF key (save this — shown once):</strong><br/><code>${input.msgfKey}</code></p>
<p><strong>Live savings dashboard:</strong><br/><a href="${input.statusUrl}">${input.statusUrl}</a></p>
<p>Trial ends ${expires}. We will email your Shadow Proxy savings report when the window closes.</p>
<p>— Elphie Syntax · MSGF Gated AI</p>
`.trim();
}

function buildReportEmailHtml(input: {
  name: string | null;
  summary: ShadowTrialSummary;
  statusUrl: string;
}): string {
  const greeting = input.name ? `Hi ${input.name},` : "Hi there,";
  return `
<p>${greeting}</p>
<p>Your <strong>24-hour Shadow Proxy trial</strong> has ended. Here is your projected savings summary (simulated bill drop — not proven eco):</p>
<ul>
  <li><strong>Shadow evaluations:</strong> ${input.summary.evaluation_count.toLocaleString()}</li>
  <li><strong>Actual pass-through cost:</strong> ${formatUsd(input.summary.actual_cost_usd)}</li>
  <li><strong>Projected savings:</strong> ${formatUsd(input.summary.projected_savings_usd)}</li>
</ul>
<p>Review details anytime: <a href="${input.statusUrl}">${input.statusUrl}</a></p>
<p>Ready for Active Governance or a full MSGF beta seat? Reply to this email or join the beta at <a href="${resolveMsgfAppOrigin("msgf").replace(/\/$/, "")}/sign-up">elphiesgatedai.elphiesyntax.com/sign-up</a>.</p>
<p>— Elphie Syntax · MSGF Gated AI</p>
`.trim();
}

function buildReportEmailText(input: {
  summary: ShadowTrialSummary;
  statusUrl: string;
}): string {
  return [
    "MSGF Shadow Proxy — 24h trial report",
    "",
    `Evaluations: ${input.summary.evaluation_count}`,
    `Actual pass-through: ${formatUsd(input.summary.actual_cost_usd)}`,
    `Projected savings: ${formatUsd(input.summary.projected_savings_usd)}`,
    "",
    `Dashboard: ${input.statusUrl}`,
    "",
    "Projected ≠ proven. Flip to Active Governance when ROI is credible.",
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
<p>New 24h Shadow Proxy trial:</p>
<ul>
  <li>Email: ${input.email}</li>
  <li>Name: ${input.name ?? "—"}</li>
  <li>Tenant: ${input.tenantId}</li>
  <li>Expires: ${input.expiresAt}</li>
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

  const existing = await findActiveTrialByEmail(admin, email);
  if (existing) {
    return {
      ok: true,
      reused: true,
      tenant_id: existing.tenant_id,
      expires_at: existing.expires_at,
      message:
        "You already have an active Shadow Proxy trial on this email. Check your inbox for the status link and MSGF key.",
    };
  }

  const plainKey = mintTestKey();
  const licenseKeyHash = sha256HexUtf8(plainKey);
  const statusToken = mintStatusToken();
  const statusTokenHash = sha256HexUtf8(statusToken);
  const tenantId = mintTrialTenantId();
  const expiresAt = new Date(Date.now() + SHADOW_TRIAL_HOURS * 60 * 60 * 1000);

  const { data: license, error: licenseError } = await admin
    .from("msgf_licenses")
    .insert({
      license_key_hash: licenseKeyHash,
      tenant_id: tenantId,
      tier_id: SHADOW_TRIAL_TIER,
      credits_total: SHADOW_TRIAL_CREDITS,
      credits_used: 0,
      status: "active",
      expires_at: expiresAt.toISOString(),
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
    expires_at: expiresAt.toISOString(),
  });

  if (trialError) {
    await admin.from("msgf_licenses").delete().eq("id", license.id);
    return { ok: false, error: trialError.message };
  }

  const statusUrl = buildShadowTrialStatusUrl(statusToken);
  let emailSent = false;

  const welcome = await sendTransactionalEmail({
    to: email,
    subject: "Your free 24h MSGF Shadow Proxy trial",
    html: buildWelcomeEmailHtml({
      name,
      msgfKey: plainKey,
      statusUrl,
      expiresAt: expiresAt.toISOString(),
    }),
    text: [
      "Your free 24h Shadow Proxy trial is live.",
      "",
      `MSGF key (save this): ${plainKey}`,
      `Live dashboard: ${statusUrl}`,
      "",
      `Trial ends ${expiresAt.toISOString()}.`,
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
    expiresAt: expiresAt.toISOString(),
  });

  return {
    ok: true,
    reused: false,
    msgf_key: plainKey,
    status_token: statusToken,
    status_url: statusUrl,
    tenant_id: tenantId,
    expires_at: expiresAt.toISOString(),
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

  const summary = await getShadowTrialSummary(admin, trial);
  const statusUrl = statusToken
    ? buildShadowTrialStatusUrl(statusToken)
    : buildShadowTrialStatusUrl("your-status-link");

  const result = await sendTransactionalEmail({
    to: trial.email,
    subject: "Your MSGF Shadow Proxy 24h savings report",
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

  await admin
    .from("msgf_licenses")
    .update({ status: "expired" })
    .eq("id", trial.license_id);

  return { ok: true };
}

export async function processDueShadowTrialReports(
  admin: SupabaseClient
): Promise<{ processed: number; emailed: number; errors: string[] }> {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("msgf_shadow_trials")
    .select("*")
    .is("report_sent_at", null)
    .lte("expires_at", now)
    .order("expires_at", { ascending: true })
    .limit(50);

  if (error) {
    return { processed: 0, emailed: 0, errors: [error.message] };
  }

  const rows = (data ?? []).map((r) => mapTrialRow(r as Record<string, unknown>));
  let emailed = 0;
  const errors: string[] = [];

  for (const trial of rows) {
    const result = await sendShadowTrialReport(admin, trial);
    if (result.ok && !result.skipped) emailed += 1;
    else if (!result.ok && result.error && !result.skipped) {
      errors.push(`${trial.email}: ${result.error}`);
    }
  }

  return { processed: rows.length, emailed, errors };
}
