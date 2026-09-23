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
 * Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
 */
/**
 * DocuSign eSignature REST (JWT grant) — used when MSGF_DOCUSIGN_MOCK is off.
 */

import { createPrivateKey } from "node:crypto";

import { SignJWT } from "jose";

export type DocuSignEnvelopeResult = {
  envelope_id: string;
  signing_url: string;
};

function integrationKey(): string | null {
  return process.env.DOCUSIGN_INTEGRATION_KEY?.trim() || null;
}

function impersonatedUserId(): string | null {
  return process.env.DOCUSIGN_USER_ID?.trim() || null;
}

function accountId(): string | null {
  return process.env.DOCUSIGN_ACCOUNT_ID?.trim() || null;
}

function oauthHost(): string {
  return (
    process.env.DOCUSIGN_OAUTH_HOST?.trim() ||
    (process.env.DOCUSIGN_USE_DEMO?.trim() === "0" ? "account.docusign.com" : "account-d.docusign.com")
  );
}

function apiBase(): string {
  return (
    process.env.DOCUSIGN_API_BASE?.trim() ||
    (process.env.DOCUSIGN_USE_DEMO?.trim() === "0"
      ? "https://na4.docusign.net"
      : "https://demo.docusign.net")
  );
}

function privateKeyPem(): string | null {
  const raw = process.env.DOCUSIGN_RSA_PRIVATE_KEY?.trim();
  if (!raw) return null;
  if (raw.includes("BEGIN")) return raw.replace(/\\n/g, "\n");
  return `-----BEGIN RSA PRIVATE KEY-----\n${raw.replace(/\\n/g, "\n")}\n-----END RSA PRIVATE KEY-----`;
}

export function isDocuSignConfigured(): boolean {
  return Boolean(integrationKey() && impersonatedUserId() && accountId() && privateKeyPem());
}

async function fetchAccessToken(): Promise<string> {
  const iss = integrationKey();
  const sub = impersonatedUserId();
  const pem = privateKeyPem();
  if (!iss || !sub || !pem) {
    throw new Error("DocuSign is not configured (DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID, DOCUSIGN_RSA_PRIVATE_KEY, DOCUSIGN_ACCOUNT_ID).");
  }

  const key = createPrivateKey(pem);
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({
    scope: "signature impersonation",
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(iss)
    .setSubject(sub)
    .setAudience(oauthHost())
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const tokenRes = await fetch(`https://${oauthHost()}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(tokenJson.error ?? `DocuSign token failed (${tokenRes.status})`);
  }
  return tokenJson.access_token;
}

const DEFAULT_HTML = `
<h1>MSGF Team Compliance Agreement</h1>
<p>By signing, you agree to MSGF governance policies for your assigned workspace projects,
including IDE token use, Vault/Hall learning boundaries, and company security review requirements.</p>
`.trim();

export async function createTeamComplianceEnvelope(params: {
  signerEmail: string;
  signerName: string;
  clientUserId: string;
  returnUrl: string;
}): Promise<DocuSignEnvelopeResult> {
  const acct = accountId();
  if (!acct) throw new Error("DOCUSIGN_ACCOUNT_ID is required.");

  const accessToken = await fetchAccessToken();
  const templateId = process.env.DOCUSIGN_TEAM_TEMPLATE_ID?.trim();

  const envelopeBody = templateId
    ? {
        templateId,
        templateRoles: [
          {
            email: params.signerEmail,
            name: params.signerName || params.signerEmail,
            roleName: process.env.DOCUSIGN_TEMPLATE_ROLE_NAME?.trim() || "Signer",
            clientUserId: params.clientUserId,
          },
        ],
        status: "sent",
      }
    : {
        emailSubject: "MSGF — Team compliance signature required",
        documents: [
          {
            documentBase64: Buffer.from(DEFAULT_HTML, "utf8").toString("base64"),
            name: "MSGF_Team_Compliance.html",
            fileExtension: "html",
            documentId: "1",
          },
        ],
        recipients: {
          signers: [
            {
              email: params.signerEmail,
              name: params.signerName || params.signerEmail,
              recipientId: "1",
              clientUserId: params.clientUserId,
              routingOrder: "1",
            },
          ],
        },
        status: "sent",
      };

  const envRes = await fetch(`${apiBase()}/restapi/v2.1/accounts/${acct}/envelopes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(envelopeBody),
  });

  const envJson = (await envRes.json()) as { envelopeId?: string; message?: string };
  if (!envRes.ok || !envJson.envelopeId) {
    throw new Error(envJson.message ?? `DocuSign envelope create failed (${envRes.status})`);
  }

  const viewRes = await fetch(
    `${apiBase()}/restapi/v2.1/accounts/${acct}/envelopes/${envJson.envelopeId}/views/recipient`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        returnUrl: params.returnUrl,
        authenticationMethod: "none",
        email: params.signerEmail,
        userName: params.signerName || params.signerEmail,
        clientUserId: params.clientUserId,
        recipientId: "1",
      }),
    }
  );

  const viewJson = (await viewRes.json()) as { url?: string; message?: string };
  if (!viewRes.ok || !viewJson.url) {
    throw new Error(viewJson.message ?? `DocuSign signing view failed (${viewRes.status})`);
  }

  return { envelope_id: envJson.envelopeId, signing_url: viewJson.url };
}
