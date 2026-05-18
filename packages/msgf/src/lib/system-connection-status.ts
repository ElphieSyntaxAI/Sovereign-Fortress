/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 */
import fs from "fs";
import path from "path";

// FORCE NEXT.JS TO EVALUATE THIS LIVE AT RUNTIME, NOT BUILD TIME
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), "service-account.json");

export type ConnectionLine = {
  ok: boolean;
  label: string;
  detail: string;
};

function fileConfigured(p: string | undefined): boolean {
  return Boolean(p?.trim() && fs.existsSync(path.resolve(p)));
}

export function getSystemConnectionStatus(): {
  gcp: ConnectionLine;
  anthropic: ConnectionLine;
  stripe: ConnectionLine;
} {
  // 1. Google Vertex Fallback (Accepts your plain text GCP_API_KEY variable too)
  const saPresent = fs.existsSync(SERVICE_ACCOUNT_PATH);
  const gcpCreds = fileConfigured(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  const gcpKeyPresent = Boolean(process.env.GCP_API_KEY?.trim() || process.env.MASTER_GEMINI_KEY?.trim());

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
  } else if (gcpKeyPresent) {
    gcp = {
      ok: true,
      label: "Google Cloud (Vertex)",
      detail: "Connected via GCP_API_KEY runtime variable",
    };
  } else if (process.env.GCP_PROJECT_ID?.trim()) {
    gcp = {
      ok: false,
      label: "Google Cloud (Vertex)",
      detail: "GCP_PROJECT_ID is set but no configuration found",
    };
  } else {
    gcp = {
      ok: false,
      label: "Google Cloud (Vertex)",
      detail: "Add service-account.json (see msgf-init) or set GOOGLE_APPLICATION_CREDENTIALS",
    };
  }

  // 2. Anthropic Runtime Check
  const anthropicKey = Boolean(process.env.ANTHROPIC_API_KEY?.trim() || process.env.MASTER_ANTHROPIC_KEY?.trim());
  const anthropic: ConnectionLine = {
    ok: anthropicKey,
    label: "Anthropic",
    detail: anthropicKey ? "ANTHROPIC_API_KEY is active" : "Set ANTHROPIC_API_KEY for narrative AI",
  };

  // 3. Stripe Runtime Check
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