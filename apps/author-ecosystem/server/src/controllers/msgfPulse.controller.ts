import { Router, type Request, type Response } from "express";

import { readBearerUser } from "../lib/readBearerJwtUser.js";
import { forwardAuthorPulseToMsgf, resolveAuthorMsgfTenantId } from "../lib/msgfPulseBridge.js";

export const msgfPulseController = Router();

/**
 * POST /api/msgf/pulse
 * Author session -> Author BFF -> MSGF Pulse.
 *
 * The browser never receives the MSGF contract license. The BFF authenticates
 * the Author user, converts the call into a trusted IDE-style MSGF Pulse, and
 * tags the request with Author tenant/user context.
 */
msgfPulseController.post("/api/msgf/pulse", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const body = (req.body ?? {}) as Record<string, unknown>;
  const tenantId = resolveAuthorMsgfTenantId(
    typeof body.tenantId === "string"
      ? body.tenantId
      : typeof body.tenant_id === "string"
        ? body.tenant_id
        : null
  );
  const idempotencyKey =
    typeof req.headers["idempotency-key"] === "string"
      ? req.headers["idempotency-key"]
      : typeof req.headers["x-msgf-idempotency-key"] === "string"
        ? req.headers["x-msgf-idempotency-key"]
        : null;

  try {
    const result = await forwardAuthorPulseToMsgf({
      userId: user.userId,
      tenantId,
      body,
      idempotencyKey,
    });

    if (!result.configured) {
      return res.status(500).json({ ok: false, error: result.error, msgf_pulse: result });
    }

    return res.status(result.status ?? 502).json({
      ok: result.ok,
      proxied_by: "author-bff",
      tenant_id: tenantId,
      msgf_pulse: result.response,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Author MSGF Pulse proxy failed.";
    console.error("[api/msgf/pulse]", e);
    return res.status(400).json({ ok: false, error: msg });
  }
});
