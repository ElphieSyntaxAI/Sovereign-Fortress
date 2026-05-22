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
 * Distribution Build ID: MSGF-1013d7a-20260522T022234Z-internal
 */
/**
 * LTI Assignment and Grade Services (AGS) — Human Effort Certificate pass-back to SpeedGrader.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { LtiDeploymentConfig } from "@/lib/education/lti/lti-config";
import { teacherDashboardBaseUrl } from "@/lib/education/lti/lti-config";
import {
  newCertificateId,
  signHumanEffortCertificateDigest,
} from "@/lib/education/privacy-gate";
import { signToolClientAssertion } from "@/lib/education/lti/lti-jwt";

const AGS_SCOPE =
  "https://purl.imsglobal.org/spec/lti-ags/scope/score https://purl.imsglobal.org/spec/lti-ags/scope/lineitem";

export type AgsEndpointClaims = {
  lineitems?: string;
  lineitem?: string;
  scope?: string[];
};

export type HumanEffortCertificateInput = {
  admin: SupabaseClient;
  tenantId: string;
  entityId: string;
  privacyVaultId: string;
  canvasUserId: string;
  lineItemUrl: string;
  resourceLinkId?: string;
  halScore: number;
  deployment: LtiDeploymentConfig;
  metadata?: Record<string, unknown>;
};

export type HumanEffortCertificateResult = {
  certificateId: string;
  certificateDigest: string;
  teacherDashboardUrl: string;
  agsStatus: "submitted" | "failed" | "pending";
  agsError?: string;
};

async function fetchPlatformAccessToken(
  deployment: LtiDeploymentConfig
): Promise<string> {
  const clientAssertion = await signToolClientAssertion({
    deployment,
    scope: AGS_SCOPE,
  });

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_assertion_type:
      "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: clientAssertion,
    scope: AGS_SCOPE,
  });

  const res = await fetch(deployment.platformTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LTI token endpoint ${res.status}: ${text.slice(0, 400)}`);
  }

  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new Error("LTI token response missing access_token.");
  }
  return json.access_token;
}

function buildSpeedGraderComment(input: {
  certificateId: string;
  digest: string;
  halScore: number;
  teacherDashboardUrl: string;
}): string {
  return [
    "Syntax Education — Human Effort Certificate",
    `HAL Score: ${input.halScore.toFixed(1)} / 100`,
    `Certificate: ${input.certificateId}`,
    `Integrity digest: ${input.digest.slice(0, 16)}…`,
    `Teacher dashboard: ${input.teacherDashboardUrl}`,
  ].join("\n");
}

/**
 * Publish score + certificate comment to Canvas via AGS, persist row in cold layer.
 */
export async function passbackHumanEffortCertificateToCanvas(
  input: HumanEffortCertificateInput
): Promise<HumanEffortCertificateResult> {
  const certificateId = newCertificateId();
  const issuedAt = new Date().toISOString();
  const halScore = Math.max(0, Math.min(100, input.halScore));
  const digest = signHumanEffortCertificateDigest({
    certificateId,
    entityId: input.entityId,
    halScore,
    issuedAt,
  });

  const teacherDashboardUrl = `${teacherDashboardBaseUrl()}?certificate=${certificateId}&entity=${input.entityId}`;

  const { data: certRow, error: certErr } = await input.admin
    .from("education_human_effort_certificates")
    .insert({
      id: certificateId,
      tenant_id: input.tenantId,
      entity_id: input.entityId,
      privacy_vault_id: input.privacyVaultId,
      resource_link_id: input.resourceLinkId ?? null,
      line_item_url: input.lineItemUrl,
      hal_score: halScore,
      certificate_digest: digest,
      teacher_dashboard_url: teacherDashboardUrl,
      ags_status: "pending",
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();

  if (certErr) {
    throw new Error(`certificate insert: ${certErr.message}`);
  }

  const scoresUrl = `${input.lineItemUrl.replace(/\/$/, "")}/scores`;

  let agsStatus: HumanEffortCertificateResult["agsStatus"] = "pending";
  let agsError: string | undefined;

  try {
    const accessToken = await fetchPlatformAccessToken(input.deployment);

    const scorePayload = {
      userId: input.canvasUserId,
      scoreGiven: halScore,
      scoreMaximum: 100,
      comment: buildSpeedGraderComment({
        certificateId,
        digest,
        halScore,
        teacherDashboardUrl,
      }),
      activityProgress: "Completed",
      gradingProgress: "FullyGraded",
      timestamp: issuedAt,
    };

    const res = await fetch(scoresUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/vnd.ims.lis.v1.score+json",
      },
      body: JSON.stringify(scorePayload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AGS score POST ${res.status}: ${text.slice(0, 500)}`);
    }

    agsStatus = "submitted";
    await input.admin
      .from("education_human_effort_certificates")
      .update({
        ags_status: "submitted",
        ags_submitted_at: new Date().toISOString(),
      })
      .eq("id", certRow.id);
  } catch (e) {
    agsStatus = "failed";
    agsError = e instanceof Error ? e.message : String(e);
    await input.admin
      .from("education_human_effort_certificates")
      .update({
        ags_status: "failed",
        ags_error: agsError,
      })
      .eq("id", certRow.id);
  }

  return {
    certificateId,
    certificateDigest: digest,
    teacherDashboardUrl,
    agsStatus,
    agsError,
  };
}

export function extractAgsEndpoints(
  claims: Record<string, unknown>
): AgsEndpointClaims | null {
  const ags = claims["https://purl.imsglobal.org/spec/lti-ags/claim/endpoint"];
  if (!ags || typeof ags !== "object") return null;
  const o = ags as Record<string, unknown>;
  return {
    lineitems: typeof o.lineitems === "string" ? o.lineitems : undefined,
    lineitem: typeof o.lineitem === "string" ? o.lineitem : undefined,
    scope: Array.isArray(o.scope) ? o.scope.map(String) : undefined,
  };
}
