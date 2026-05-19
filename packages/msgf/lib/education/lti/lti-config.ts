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
 * Distribution Build ID: MSGF-2790974-20260519T053954Z-internal
 */
/**
 * Canvas LTI 1.3 configuration (P3 Entity Profiles).
 */
import { resolveOperationalTenantId } from "@/lib/platform-persona-auth";

export type LtiDeploymentConfig = {
  tenantId: string;
  issuer: string;
  clientId: string;
  deploymentId: string;
  platformAuthUrl: string;
  platformTokenUrl: string;
  platformJwksUrl: string;
  toolLaunchUrl: string;
  toolLoginUrl: string;
};

const LTI_CLAIM = "https://purl.imsglobal.org/spec/lti";
export const LTI_AGS_CLAIM = `${LTI_CLAIM}/ags/claim/endpoint`;
export const LTI_NRPS_CLAIM = `${LTI_CLAIM}/nrps/claim/namesroleservice`;
export const LTI_DEPLOYMENT_ID_CLAIM = `${LTI_CLAIM}/claim/deployment_id`;
export const LTI_MESSAGE_TYPE_CLAIM = `${LTI_CLAIM}/claim/message_type`;
export const LTI_VERSION_CLAIM = `${LTI_CLAIM}/claim/version`;
export const LTI_ROLES_CLAIM = `${LTI_CLAIM}/claim/roles`;
export const LTI_CONTEXT_CLAIM = `${LTI_CLAIM}/claim/context`;
export const LTI_RESOURCE_LINK_CLAIM = `${LTI_CLAIM}/claim/resource_link`;
export const LTI_TARGET_LINK_URI_CLAIM = `${LTI_CLAIM}/claim/target_link_uri`;

export function educationTenantId(): string {
  return resolveOperationalTenantId("education");
}

export function ltiToolBaseUrl(): string {
  return (
    process.env.MSGF_LTI_TOOL_BASE_URL?.trim() ||
    process.env.MSGF_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_MSGF_APP_URL?.trim() ||
    "http://127.0.0.1:3000"
  ).replace(/\/$/, "");
}

export function ltiToolLoginUrl(): string {
  return (
    process.env.CANVAS_LTI_TOOL_LOGIN_URL?.trim() ||
    `${ltiToolBaseUrl()}/api/education/lti/login`
  );
}

export function ltiToolLaunchUrl(): string {
  return (
    process.env.CANVAS_LTI_TOOL_LAUNCH_URL?.trim() ||
    `${ltiToolBaseUrl()}/api/education/lti/launch`
  );
}

export function teacherDashboardBaseUrl(): string {
  return (
    process.env.EDUCATION_TEACHER_DASHBOARD_URL?.trim() ||
    process.env.NEXT_PUBLIC_EDUCATION_TEACHER_DASHBOARD_URL?.trim() ||
    `${process.env.EDUCATION_APP_URL?.trim() || "https://syntaxeducates.elphiesyntax.com"}/teacher`
  ).replace(/\/$/, "");
}

export function privacyGateSecret(): string {
  const secret =
    process.env.EDUCATION_PRIVACY_GATE_SECRET?.trim() ||
    process.env.MSGF_LTI_SESSION_SECRET?.trim() ||
    process.env.SUPABASE_JWT_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "EDUCATION_PRIVACY_GATE_SECRET or MSGF_LTI_SESSION_SECRET is required for LTI privacy tokens."
    );
  }
  return secret;
}

export function ltiSessionSecret(): string {
  return (
    process.env.MSGF_LTI_SESSION_SECRET?.trim() ||
    process.env.EDUCATION_PRIVACY_GATE_SECRET?.trim() ||
    privacyGateSecret()
  );
}

/**
 * Resolve active Canvas deployment from env (single-tenant MVP).
 * Production: load from `education_lti_deployments` by issuer + client_id.
 */
export function resolveLtiDeploymentFromEnv(): LtiDeploymentConfig {
  const issuer =
    process.env.CANVAS_LTI_ISSUER?.trim() || "https://canvas.instructure.com";
  const clientId = process.env.CANVAS_LTI_CLIENT_ID?.trim();
  const deploymentId = process.env.CANVAS_LTI_DEPLOYMENT_ID?.trim();

  if (!clientId || !deploymentId) {
    throw new Error("CANVAS_LTI_CLIENT_ID and CANVAS_LTI_DEPLOYMENT_ID are required.");
  }

  const canvasBase = issuer.replace(/\/$/, "");

  return {
    tenantId: educationTenantId(),
    issuer: canvasBase,
    clientId,
    deploymentId,
    platformAuthUrl:
      process.env.CANVAS_LTI_PLATFORM_AUTH_URL?.trim() ||
      `${canvasBase}/api/lti/authorize_redirect`,
    platformTokenUrl:
      process.env.CANVAS_LTI_PLATFORM_TOKEN_URL?.trim() ||
      `${canvasBase}/login/oauth2/token`,
    platformJwksUrl:
      process.env.CANVAS_LTI_PLATFORM_JWKS_URL?.trim() ||
      `${canvasBase}/api/lti/security/jwks`,
    toolLaunchUrl: ltiToolLaunchUrl(),
    toolLoginUrl: ltiToolLoginUrl(),
  };
}

export function ltiToolPrivateKeyPem(): string {
  const raw =
    process.env.CANVAS_LTI_TOOL_PRIVATE_KEY?.trim() ||
    process.env.CANVAS_LTI_TOOL_PRIVATE_KEY_PEM?.trim();
  if (!raw) {
    throw new Error("CANVAS_LTI_TOOL_PRIVATE_KEY (PEM) is required for AGS OAuth.");
  }
  if (raw.includes("BEGIN")) return raw.replace(/\\n/g, "\n");
  return Buffer.from(raw, "base64").toString("utf8");
}

export function ltiToolKeyId(): string {
  return process.env.CANVAS_LTI_TOOL_KID?.trim() || "syntax-education-lti-key";
}
