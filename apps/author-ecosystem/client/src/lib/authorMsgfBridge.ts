import {
  MsgfBridge,
  type P1Standard,
  type PulseDispatchResult,
} from "msgf/connector/MsgfBridge";

import { bffAuthHeaders, bffFetch, bffUrl } from "./bffFetch";

let bridge: MsgfBridge | null = null;

/**
 * Browser MsgfBridge for Author — BFF proxy + tenant silo `author_ecosystem`.
 */
export function getAuthorMsgfBridge(): MsgfBridge {
  if (!bridge) {
    bridge = new MsgfBridge({
      tenantId:
        import.meta.env.VITE_MSGF_TENANT_ID?.trim() || "author_ecosystem",
      licenseKey: "author-bff",
      baseUrl:
        typeof window !== "undefined"
          ? bffUrl("")
          : "http://127.0.0.1:5173",
      sessionPersistence: true,
    });
  }
  return bridge;
}

/**
 * Browser-safe Author -> BFF -> MSGF Pulse dispatch. Prefer this for Pulse
 * because the BFF owns the MSGF contract license and tenant/user headers.
 */
export async function dispatchAuthorPulse(
  payload: P1Standard & { tenantId?: string; tenant_id?: string },
  accessToken?: string | null
): Promise<PulseDispatchResult> {
  const res = await bffFetch("/api/msgf/pulse", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...bffAuthHeaders(accessToken),
    },
    body: JSON.stringify(payload),
  });
  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const error =
      typeof raw.error === "string"
        ? raw.error
        : `Author MSGF Pulse proxy failed with ${res.status}.`;
    throw new Error(error);
  }
  const msgfRaw =
    raw.msgf_pulse && typeof raw.msgf_pulse === "object"
      ? (raw.msgf_pulse as Record<string, unknown>)
      : raw;
  return {
    ok: raw.ok === true,
    vaultNarrativeLogId:
      typeof msgfRaw.vault_narrative_log_id === "string"
        ? msgfRaw.vault_narrative_log_id
        : null,
    hallNarrativeLogId:
      typeof msgfRaw.hall_narrative_log_id === "string"
        ? msgfRaw.hall_narrative_log_id
        : null,
    humanTiebreakerRequired: msgfRaw.human_tiebreaker_required === true,
    baselineRequired: msgfRaw.baseline_required === true,
    ledger: typeof msgfRaw.ledger === "string" ? msgfRaw.ledger : null,
    raw,
  };
}
