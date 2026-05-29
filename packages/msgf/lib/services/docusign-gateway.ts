/**
 * DocuSign Connect gateway — scaffold with mock mode for local QA.
 */

import { createHmac, timingSafeEqual } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { appendVaultLog } from "@/lib/services/tenant-onboarding-vault";

export type DocuSignConnectPayload = {
  event?: string;
  envelopeId?: string;
  inviteId?: string;
  data?: {
    envelopeId?: string;
    envelopeSummary?: {
      status?: string;
      recipients?: { signers?: Array<{ email?: string; status?: string }> };
    };
  };
};

function mockMode(): boolean {
  const v = process.env.MSGF_DOCUSIGN_MOCK?.trim().toLowerCase();
  return v === "1" || v === "true";
}

export async function createEnvelopeForInvite(
  admin: SupabaseClient,
  params: {
    inviteId: string;
    companyId: string;
    userId: string;
    email: string;
  }
): Promise<{ envelope_id: string; signing_url: string }> {
  const envelopeId = mockMode()
    ? `mock-env-${params.inviteId.slice(0, 8)}`
    : `pending-${params.inviteId}`;

  const appUrl = process.env.MSGF_APP_URL?.trim() || "http://127.0.0.1:3000";
  const signingUrl = mockMode()
    ? `${appUrl}/workspace?tab=ide&mock_docusign=1&invite=${params.inviteId}`
    : `${appUrl}/workspace?compliance=pending&invite=${params.inviteId}`;

  const { error } = await admin.from("msgf_docusign_envelopes").insert({
    invite_id: params.inviteId,
    user_id: params.userId,
    company_id: params.companyId,
    envelope_id: envelopeId,
    signing_url: signingUrl,
    status: "sent",
  });

  if (error) throw new Error(`createEnvelopeForInvite: ${error.message}`);

  return { envelope_id: envelopeId, signing_url: signingUrl };
}

export async function handleConnectWebhook(
  admin: SupabaseClient,
  payload: DocuSignConnectPayload
): Promise<{ ok: boolean; message: string }> {
  const event = payload.event?.toLowerCase() ?? "";
  const envelopeId =
    payload.envelopeId ??
    payload.data?.envelopeId ??
    (typeof payload.data?.envelopeSummary === "object"
      ? undefined
      : undefined);

  const isCompleted =
    event.includes("envelope-completed") ||
    payload.data?.envelopeSummary?.status?.toLowerCase() === "completed";

  if (!isCompleted) {
    return { ok: true, message: "event ignored" };
  }

  const inviteId = payload.inviteId;

  type EnvelopeRow = {
    id: string;
    invite_id: string;
    user_id: string | null;
    company_id: string;
    envelope_id: string;
  };

  let row: EnvelopeRow | null = null;

  if (envelopeId) {
    const { data } = await admin
      .from("msgf_docusign_envelopes")
      .select("id, invite_id, user_id, company_id, envelope_id")
      .eq("envelope_id", envelopeId)
      .maybeSingle();
    if (data) row = data as EnvelopeRow;
  }

  if (!row && inviteId) {
    const { data } = await admin
      .from("msgf_docusign_envelopes")
      .select("id, invite_id, user_id, company_id, envelope_id")
      .eq("invite_id", inviteId)
      .maybeSingle();
    if (data) row = data as EnvelopeRow;
  }

  if (!row?.user_id) {
    return { ok: false, message: "envelope not matched to user" };
  }

  await admin
    .from("msgf_docusign_envelopes")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      connect_event_id: event || "envelope-completed",
    })
    .eq("id", row.id);

  await admin
    .from("p4_profiles")
    .update({ account_status: "active", updated_at: new Date().toISOString() })
    .eq("user_id", row.user_id);

  await appendVaultLog(admin, row.company_id, "docusign_completed", {
    envelope_id: row.envelope_id,
    invite_id: row.invite_id,
    user_id: row.user_id,
    completed_at: new Date().toISOString(),
  });

  return { ok: true, message: "account activated" };
}

export function verifyDocuSignWebhookAuth(
  request: Request,
  rawBody: string
): boolean {
  if (mockMode()) return true;

  const secret = process.env.MSGF_DOCUSIGN_CONNECT_SECRET?.trim();
  if (!secret) {
    const opsSecret = process.env.MSGF_OPS_CRON_SECRET?.trim();
    const auth = request.headers.get("authorization")?.trim();
    if (opsSecret && auth === `Bearer ${opsSecret}`) return true;
    return false;
  }

  const sig = request.headers.get("x-docusign-signature-1");
  if (!sig) return false;

  try {
    const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
