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
 * Distribution Build ID: MSGF-7175065-20260515T200509Z-internal
 */
import fs from "fs";
import path from "path";

/** Same convention as `lib/msgf-vertex.ts` / `msgf-init.js` (cwd is the msgf package when running Next). */
const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), "service-account.json");

export type ConnectionLine = {
  ok: boolean;
  label: string;
  detail: string;
};

function fileConfigured(p: string | undefined): boolean {
  return Boolean(p?.trim() && fs.existsSync(path.resolve(p)));
}

/** Server-only: env / filesystem checks (no outbound calls, no secrets exposed). */
export function getSystemConnectionStatus(): {
  gcp: ConnectionLine;
  anthropic: ConnectionLine;
  stripe: ConnectionLine;
} {
  const saPresent = fs.existsSync(SERVICE_ACCOUNT_PATH);
  const gcpCreds = fileConfigured(process.env.GOOGLE_APPLICATION_CREDENTIALS);

  let gcp: ConnectionLine;
  if (saPresent) {
    gcp = {
      ok: true,
      label: "Google Cloud (Vertex)",
      detail: `service-account.json at project root`,
    };
  } else if (gcpCreds) {
    gcp = {
      ok: true,
      label: "Google Cloud (Vertex)",
      detail: "GOOGLE_APPLICATION_CREDENTIALS points to a readable key file",
    };
  } else if (process.env.GCP_PROJECT_ID?.trim()) {
    gcp = {
      ok: false,
      label: "Google Cloud (Vertex)",
      detail: "GCP_PROJECT_ID is set but no service-account.json or GOOGLE_APPLICATION_CREDENTIALS file found",
    };
  } else {
    gcp = {
      ok: false,
      label: "Google Cloud (Vertex)",
      detail: "Add service-account.json (see msgf-init) or set GOOGLE_APPLICATION_CREDENTIALS",
    };
  }

  const anthropicKey = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  const anthropic: ConnectionLine = {
    ok: anthropicKey,
    label: "Anthropic",
    detail: anthropicKey ? "ANTHROPIC_API_KEY is set" : "Set ANTHROPIC_API_KEY for narrative AI",
  };

  const secret = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  const webhook = Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
  const stripe: ConnectionLine = {
    ok: secret,
    label: "Stripe",
    detail: secret
      ? webhook
        ? "STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are set"
        : "STRIPE_SECRET_KEY set (add STRIPE_WEBHOOK_SECRET for webhooks)"
      : "Set STRIPE_SECRET_KEY (and STRIPE_WEBHOOK_SECRET for /api/webhooks/stripe)",
  };

  return { gcp, anthropic, stripe };
}
