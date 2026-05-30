import { createHmac, timingSafeEqual } from "node:crypto";

import {
  type OperatorHandoffPayload,
  buildMsgfAuthorHandoffUrl,
  sanitizeAuthorReturnToUrl,
} from "./operator-handoff-url.js";

export type { OperatorHandoffPayload } from "./operator-handoff-url.js";
export { buildMsgfAuthorHandoffUrl, sanitizeAuthorReturnToUrl };

/** Browser redirect + entitlement sync — 60s was too tight for cold BFF / slow networks. */
const DEFAULT_TTL_MS = 300_000;

function encodePayload(payload: OperatorHandoffPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(encoded: string): OperatorHandoffPayload {
  const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as OperatorHandoffPayload;
  if (
    typeof parsed.access_token !== "string" ||
    typeof parsed.refresh_token !== "string" ||
    typeof parsed.email !== "string" ||
    typeof parsed.exp !== "number"
  ) {
    throw new Error("Invalid handoff payload shape.");
  }
  return parsed;
}

export function signOperatorHandoffToken(
  input: Pick<OperatorHandoffPayload, "access_token" | "refresh_token" | "email">,
  secret: string,
  ttlMs: number = DEFAULT_TTL_MS
): string {
  const key = secret.trim();
  if (!key) throw new Error("Operator handoff secret is not configured.");

  const payload: OperatorHandoffPayload = {
    ...input,
    exp: Date.now() + ttlMs,
  };
  const body = encodePayload(payload);
  const sig = createHmac("sha256", key).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyOperatorHandoffToken(token: string, secret: string): OperatorHandoffPayload {
  const key = secret.trim();
  if (!key) throw new Error("Operator handoff secret is not configured.");

  const parts = token.split(".");
  if (parts.length !== 2) throw new Error("Malformed handoff token.");

  const [body, sig] = parts;
  const expected = createHmac("sha256", key).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Invalid handoff signature.");
  }

  const payload = decodePayload(body);
  if (payload.exp < Date.now()) {
    throw new Error("Handoff token expired. Return to MSGF admin portal and try again.");
  }
  return payload;
}
