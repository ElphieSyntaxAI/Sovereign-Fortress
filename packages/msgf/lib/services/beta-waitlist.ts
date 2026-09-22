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
 * Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
 */
/**
 * Beta / foundational testing waitlist — MSGF, Author, Education interest.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isTransactionalEmailConfigured,
  parseGlobalAdminEmails,
  sendTransactionalEmail,
} from "@/lib/services/transactional-email";
import { resolveMsgfAppOrigin } from "@elphie-syntax/core";

export type BetaWaitlistProduct = "msgf" | "author" | "education";
export type BetaWaitlistStatus = "pending" | "invited" | "declined";

export type BetaWaitlistRow = {
  id: string;
  product: BetaWaitlistProduct;
  email: string;
  name: string | null;
  note: string | null;
  status: BetaWaitlistStatus;
  admin_notified_at: string | null;
  created_at: string;
  updated_at: string;
};

const PRODUCT_LABEL: Record<BetaWaitlistProduct, string> = {
  msgf: "MSGF — AI gateway (beta testing)",
  author: "Author Ecosystem (foundational testing)",
  education: "Syntax Education (in development)",
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function mapRow(row: Record<string, unknown>): BetaWaitlistRow {
  const product = row.product;
  return {
    id: String(row.id ?? ""),
    product:
      product === "author" || product === "education" || product === "msgf"
        ? product
        : "msgf",
    email: String(row.email ?? ""),
    name: typeof row.name === "string" && row.name.trim() ? row.name.trim() : null,
    note: typeof row.note === "string" && row.note.trim() ? row.note.trim() : null,
    status:
      row.status === "invited" || row.status === "declined" ? row.status : "pending",
    admin_notified_at:
      typeof row.admin_notified_at === "string" ? row.admin_notified_at : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export function betaWaitlistAdminUrl(product?: BetaWaitlistProduct): string {
  const base = resolveMsgfAppOrigin().replace(/\/$/, "");
  const q = product ? `?product=${encodeURIComponent(product)}` : "";
  return `${base}/admin/ops#beta-waitlist${q}`;
}

async function notifyAdminsSignup(row: BetaWaitlistRow): Promise<void> {
  const admins = parseGlobalAdminEmails();
  if (!admins.length || !isTransactionalEmailConfigured()) return;

  const adminUrl = betaWaitlistAdminUrl(row.product);
  const subject = `[Elphie] ${PRODUCT_LABEL[row.product]} signup — ${row.email}`;
  const html = `
<p>New waitlist signup:</p>
<ul>
  <li><strong>Product:</strong> ${PRODUCT_LABEL[row.product]}</li>
  <li><strong>Email:</strong> ${row.email}</li>
  <li><strong>Name:</strong> ${row.name ?? "—"}</li>
  <li><strong>Note:</strong> ${row.note ?? "—"}</li>
</ul>
<p><a href="${adminUrl}">Review waitlist in MSGF ops →</a></p>
`.trim();

  await sendTransactionalEmail({ to: admins, subject, html });
}

export type JoinBetaWaitlistResult =
  | { ok: true; reused: boolean; id: string }
  | { ok: false; error: string };

export async function joinBetaWaitlist(
  admin: SupabaseClient,
  input: {
    product: BetaWaitlistProduct;
    email: string;
    name?: string | null;
    note?: string | null;
  }
): Promise<JoinBetaWaitlistResult> {
  const email = normalizeEmail(input.email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const name =
    typeof input.name === "string" && input.name.trim() ? input.name.trim() : null;
  const note =
    typeof input.note === "string" && input.note.trim() ? input.note.trim() : null;

  const { data: existing, error: lookupError } = await admin
    .from("beta_waitlist")
    .select("*")
    .eq("product", input.product)
    .ilike("email", email)
    .maybeSingle();

  if (lookupError) {
    return { ok: false, error: lookupError.message };
  }

  if (existing) {
    return { ok: true, reused: true, id: String(existing.id) };
  }

  const { data, error } = await admin
    .from("beta_waitlist")
    .insert({
      product: input.product,
      email,
      name,
      note,
      status: "pending",
    })
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not save signup." };
  }

  const row = mapRow(data as Record<string, unknown>);
  void (async () => {
    await notifyAdminsSignup(row);
    await admin
      .from("beta_waitlist")
      .update({ admin_notified_at: new Date().toISOString() })
      .eq("id", row.id);
  })();

  const welcome = await sendTransactionalEmail({
    to: email,
    subject: `You're on the ${PRODUCT_LABEL[input.product]} list`,
    html: `
<p>Thanks for your interest in <strong>${PRODUCT_LABEL[input.product]}</strong>.</p>
<p>We review signups manually during ${input.product === "msgf" ? "beta testing" : input.product === "author" ? "foundational testing" : "early access"}. You'll get an invite link when a seat opens.</p>
<p>— Elphie Syntax LLC</p>
`.trim(),
    text: `Thanks — you're on the ${PRODUCT_LABEL[input.product]} waitlist. We'll email you when a seat opens.`,
  });

  if (!welcome.ok && !welcome.skipped) {
    console.warn("[beta-waitlist] welcome email failed:", welcome.error);
  }

  return { ok: true, reused: false, id: row.id };
}

export async function listBetaWaitlist(
  admin: SupabaseClient,
  opts: {
    product?: BetaWaitlistProduct | "all";
    status?: BetaWaitlistStatus | "all";
    limit?: number;
  } = {}
): Promise<{ rows: BetaWaitlistRow[]; count: number }> {
  let q = admin
    .from("beta_waitlist")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (opts.product && opts.product !== "all") {
    q = q.eq("product", opts.product);
  }
  if (opts.status && opts.status !== "all") {
    q = q.eq("status", opts.status);
  }

  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const { data, error, count } = await q.limit(limit);
  if (error) throw new Error(error.message);

  return {
    rows: (data ?? []).map((r) => mapRow(r as Record<string, unknown>)),
    count: count ?? 0,
  };
}

export async function patchBetaWaitlistStatus(
  admin: SupabaseClient,
  input: {
    id: string;
    status: BetaWaitlistStatus;
  }
): Promise<BetaWaitlistRow> {
  const { data, error } = await admin
    .from("beta_waitlist")
    .update({ status: input.status })
    .eq("id", input.id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Update failed.");
  }
  return mapRow(data as Record<string, unknown>);
}
