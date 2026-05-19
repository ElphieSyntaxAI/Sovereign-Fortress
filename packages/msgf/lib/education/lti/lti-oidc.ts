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
 * Distribution Build ID: MSGF-81e8259-20260519T153428Z-internal
 */
/**
 * LTI 1.3 OIDC third-party login — initiation + authorization redirect.
 */
import type { LtiDeploymentConfig } from "@/lib/education/lti/lti-config";
import {
  generateOidcNonce,
  generateOidcState,
  storeOidcState,
} from "@/lib/education/lti/lti-oidc-state";

export type LtiLoginInitParams = {
  iss: string;
  loginHint?: string;
  targetLinkUri: string;
  ltiMessageHint?: string;
  clientId: string;
  ltiDeploymentId?: string;
};

export function assertLoginInitMatchesDeployment(
  params: LtiLoginInitParams,
  deployment: LtiDeploymentConfig
): void {
  if (params.iss.replace(/\/$/, "") !== deployment.issuer.replace(/\/$/, "")) {
    throw new Error("LTI issuer mismatch.");
  }
  if (params.clientId !== deployment.clientId) {
    throw new Error("LTI client_id mismatch.");
  }
  if (
    params.ltiDeploymentId &&
    params.ltiDeploymentId !== deployment.deploymentId
  ) {
    throw new Error("LTI deployment_id mismatch.");
  }
  if (!params.targetLinkUri.startsWith("http")) {
    throw new Error("Invalid target_link_uri.");
  }
}

export async function buildOidcAuthorizationRedirect(
  params: LtiLoginInitParams,
  deployment: LtiDeploymentConfig
): Promise<string> {
  assertLoginInitMatchesDeployment(params, deployment);

  const state = generateOidcState();
  const nonce = generateOidcNonce();

  await storeOidcState({
    state,
    nonce,
    targetLinkUri: params.targetLinkUri,
    loginHint: params.loginHint,
    ltiMessageHint: params.ltiMessageHint,
    clientId: params.clientId,
    issuer: deployment.issuer,
    deploymentId: deployment.deploymentId,
    tenantId: deployment.tenantId,
    createdAt: new Date().toISOString(),
  });

  const authUrl = new URL(deployment.platformAuthUrl);
  authUrl.searchParams.set("scope", "openid");
  authUrl.searchParams.set("response_type", "id_token");
  authUrl.searchParams.set("response_mode", "form_post");
  authUrl.searchParams.set("prompt", "none");
  authUrl.searchParams.set("client_id", deployment.clientId);
  authUrl.searchParams.set("redirect_uri", deployment.toolLaunchUrl);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("nonce", nonce);

  if (params.loginHint) {
    authUrl.searchParams.set("login_hint", params.loginHint);
  }
  if (params.ltiMessageHint) {
    authUrl.searchParams.set("lti_message_hint", params.ltiMessageHint);
  }

  return authUrl.toString();
}
