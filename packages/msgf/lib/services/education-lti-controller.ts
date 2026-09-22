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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
 */
/**
 * Canvas LTI 1.3 controller — OIDC login, launch, P3 privacy gate, profile bind.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  applyCryptographicPrivacyGate,
  stripPiiFromLaunchClaims,
  type RawLtiIdentity,
} from "@/lib/education/privacy-gate";
import {
  extractAgsEndpoints,
  type AgsEndpointClaims,
} from "@/lib/education/lti/lti-ags";
import { buildOidcAuthorizationRedirect, type LtiLoginInitParams } from "@/lib/education/lti/lti-oidc";
import { consumeOidcState } from "@/lib/education/lti/lti-oidc-state";
import { verifyPlatformIdToken } from "@/lib/education/lti/lti-jwt";
import {
  LTI_CONTEXT_CLAIM,
  LTI_RESOURCE_LINK_CLAIM,
  LTI_ROLES_CLAIM,
  resolveLtiDeploymentFromEnv,
  type LtiDeploymentConfig,
} from "@/lib/education/lti/lti-config";
import { mapLtiRolesToPersona } from "@/lib/education/lti/lti-roles";
import { sealLtiSession, type LtiSessionPayload } from "@/lib/education/lti/lti-session";
import { syncPlatformEntitlement } from "@/lib/msgf-onboarding";
import { createAdminClient } from "@/utils/supabase/admin";

export type LtiLaunchResult = {
  sessionToken: string;
  session: LtiSessionPayload;
  redirectUrl: string;
  privacyVaultId: string;
  ags: AgsEndpointClaims | null;
};

function educationAppRedirect(persona: string): string {
  const base =
    process.env.EDUCATION_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_EDUCATION_APP_URL?.trim() ||
    "https://syntaxeducates.elphiesyntax.com";
  if (persona === "teacher" || persona === "administration_it") {
    return `${base.replace(/\/$/, "")}/teacher`;
  }
  return `${base.replace(/\/$/, "")}/sandbox`;
}

export async function handleLtiLoginInitiation(
  params: LtiLoginInitParams
): Promise<string> {
  const deployment = resolveLtiDeploymentFromEnv();
  return buildOidcAuthorizationRedirect(params, deployment);
}

export async function handleLtiLaunch(params: {
  idToken: string;
  state: string;
  supabase?: SupabaseClient;
}): Promise<LtiLaunchResult> {
  const oidcState = await consumeOidcState(params.state);
  if (!oidcState) {
    throw new Error("Invalid or expired LTI OIDC state.");
  }

  const deployment = resolveLtiDeploymentFromEnv();
  const claims = await verifyPlatformIdToken({
    idToken: params.idToken,
    deployment,
    expectedNonce: oidcState.nonce,
  });

  const roles = Array.isArray(claims[LTI_ROLES_CLAIM])
    ? (claims[LTI_ROLES_CLAIM] as string[])
    : [];

  const persona = mapLtiRolesToPersona(roles);
  const canvasSub = String(claims.sub ?? "");
  if (!canvasSub) {
    throw new Error("LTI launch missing sub claim.");
  }

  const identity: RawLtiIdentity = {
    canvasSub,
    email: typeof claims.email === "string" ? claims.email : undefined,
    name: typeof claims.name === "string" ? claims.name : undefined,
    givenName: typeof claims.given_name === "string" ? claims.given_name : undefined,
    familyName:
      typeof claims.family_name === "string" ? claims.family_name : undefined,
  };

  const admin = params.supabase ?? createAdminClient();

  const privacy = await applyCryptographicPrivacyGate({
    admin,
    tenantId: deployment.tenantId,
    deploymentId: deployment.deploymentId,
    issuer: deployment.issuer,
    identity,
    persona,
  });

  const ags = extractAgsEndpoints(claims as Record<string, unknown>);
  const context = claims[LTI_CONTEXT_CLAIM] as { id?: string } | undefined;
  const resourceLink = claims[LTI_RESOURCE_LINK_CLAIM] as { id?: string } | undefined;
  const sanitizedClaims = stripPiiFromLaunchClaims(claims as Record<string, unknown>);

  const launchExpires = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

  const { data: launchRow, error: launchErr } = await admin
    .from("education_lti_launches")
    .insert({
      tenant_id: deployment.tenantId,
      entity_id: privacy.entityId,
      privacy_vault_id: privacy.privacyVaultId,
      deployment_id: deployment.deploymentId,
      context_id: context?.id ?? null,
      resource_link_id: resourceLink?.id ?? null,
      line_items_url: ags?.lineitems ?? null,
      line_item_url: ags?.lineitem ?? null,
      scores_url: ags?.lineitem ? `${ags.lineitem}/scores` : null,
      roles,
      launch_claims: sanitizedClaims,
      canvas_ags_user_ref: canvasSub,
      expires_at: launchExpires,
    })
    .select("id")
    .single();

  if (launchErr) {
    throw new Error(`lti launch persist: ${launchErr.message}`);
  }

  await bindEducationProfile({
    admin,
    deployment,
    entityId: privacy.entityId,
    anonymousToken: privacy.anonymousDisplayToken,
    persona,
  });

  const session: Omit<LtiSessionPayload, "exp"> = {
    entityId: privacy.entityId,
    anonymousToken: privacy.anonymousDisplayToken,
    tenantId: deployment.tenantId,
    persona,
    deploymentId: deployment.deploymentId,
    launchId: String(launchRow.id),
    lineItemUrl: ags?.lineitem,
    resourceLinkId: resourceLink?.id,
  };

  const sessionToken = sealLtiSession(session);

  return {
    sessionToken,
    session: { ...session, exp: Math.floor(Date.now() / 1000) + 28800 },
    redirectUrl: educationAppRedirect(persona),
    privacyVaultId: privacy.privacyVaultId!,
    ags,
  };
}

async function bindEducationProfile(params: {
  admin: SupabaseClient;
  deployment: LtiDeploymentConfig;
  entityId: string;
  anonymousToken: string;
  persona: ReturnType<typeof mapLtiRolesToPersona>;
}): Promise<void> {
  await ensureLtiShadowAuthUser(params);

  try {
    await syncPlatformEntitlement({
      entityId: params.entityId,
      platform: "education",
      persona: params.persona,
      username: params.anonymousToken,
      supabase: params.admin,
    });
  } catch (e) {
    console.warn("[education-lti] syncPlatformEntitlement:", e);
  }
}

/** Supabase Auth row keyed by privacy-gated entity UUID (no real email stored). */
async function ensureLtiShadowAuthUser(params: {
  admin: SupabaseClient;
  deployment: LtiDeploymentConfig;
  entityId: string;
  anonymousToken: string;
  persona: ReturnType<typeof mapLtiRolesToPersona>;
}): Promise<void> {
  const { data: existing } = await params.admin.auth.admin.getUserById(
    params.entityId
  );
  if (existing?.user) return;

  const email = `${params.entityId}@lti-internal.elphiesyntax.local`;
  const { error } = await params.admin.auth.admin.createUser({
    id: params.entityId,
    email,
    email_confirm: true,
    user_metadata: {
      tenant_id: params.deployment.tenantId,
      anonymous_display_token: params.anonymousToken,
      lti_privacy_gated: true,
      persona: params.persona,
      platform: "education",
    },
  });

  if (error && !error.message.toLowerCase().includes("already")) {
    throw new Error(`LTI shadow auth user: ${error.message}`);
  }
}
