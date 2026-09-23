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
 * Optional transactional email via Resend (beta waitlist, Shadow trial reports).
 */

export type SendTransactionalEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export type SendTransactionalEmailResult =
  | { ok: true; id: string }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped: false; error: string };

function resolveFromAddress(): string | null {
  const from =
    process.env.MSGF_TRANSACTIONAL_FROM?.trim() ||
    process.env.RESEND_FROM?.trim() ||
    null;
  return from;
}

function resolveApiKey(): string | null {
  return process.env.RESEND_API_KEY?.trim() || null;
}

export function isTransactionalEmailConfigured(): boolean {
  return Boolean(resolveApiKey() && resolveFromAddress());
}

export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput
): Promise<SendTransactionalEmailResult> {
  const apiKey = resolveApiKey();
  const from = resolveFromAddress();
  if (!apiKey || !from) {
    return {
      ok: false,
      skipped: true,
      reason:
        "RESEND_API_KEY and MSGF_TRANSACTIONAL_FROM (or RESEND_FROM) are not configured.",
    };
  }

  const recipients = Array.isArray(input.to) ? input.to : [input.to];
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: input.replyTo,
      }),
    });

    const json = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
    };

    if (!res.ok) {
      return {
        ok: false,
        skipped: false,
        error: json.message ?? `Resend HTTP ${res.status}`,
      };
    }

    return { ok: true, id: json.id ?? "sent" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Resend request failed";
    return { ok: false, skipped: false, error: msg };
  }
}

export function parseGlobalAdminEmails(): string[] {
  const raw =
    process.env.MSGF_GLOBAL_ADMIN_EMAILS?.trim() ||
    process.env.NEXT_PUBLIC_MSGF_GLOBAL_ADMIN_EMAILS?.trim() ||
    "";
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
