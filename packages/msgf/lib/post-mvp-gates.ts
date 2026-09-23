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
 * Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
 */
/**
 * Features delayed until after MSGF 1.0 / Author three-seat MVP.
 * Default OFF. Set the env flag to 1 to turn a surface back on for 1.1 QA.
 * Do not delete the underlying code.
 */

export const POST_MVP_FEATURES = [
  "signing",
  "dropbox_archive",
  "mcp_product",
  "author_fan_hub",
  "author_helper",
] as const;

export type PostMvpFeature = (typeof POST_MVP_FEATURES)[number];

export const POST_MVP_FEATURE_ENV: Record<PostMvpFeature, string> = {
  signing: "MSGF_POST_MVP_SIGNING",
  dropbox_archive: "MSGF_POST_MVP_DROPBOX_ARCHIVE",
  mcp_product: "MSGF_POST_MVP_MCP",
  author_fan_hub: "AUTHOR_POST_MVP_FAN_HUB",
  author_helper: "AUTHOR_POST_MVP_HELPER",
};

export type PostMvpGateSnapshot = Record<PostMvpFeature, boolean>;

function envFlagOn(value: string | undefined): boolean {
  const v = value?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function isPostMvpFeatureEnabled(
  feature: PostMvpFeature,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return envFlagOn(env[POST_MVP_FEATURE_ENV[feature]]);
}

export function postMvpGateSnapshot(
  env: NodeJS.ProcessEnv = process.env
): PostMvpGateSnapshot {
  return {
    signing: isPostMvpFeatureEnabled("signing", env),
    dropbox_archive: isPostMvpFeatureEnabled("dropbox_archive", env),
    mcp_product: isPostMvpFeatureEnabled("mcp_product", env),
    author_fan_hub: isPostMvpFeatureEnabled("author_fan_hub", env),
    author_helper: isPostMvpFeatureEnabled("author_helper", env),
  };
}

export function postMvpDisabledPayload(feature: PostMvpFeature) {
  return {
    ok: false as const,
    error: "feature_gated" as const,
    feature,
    message: `${feature} is deferred until after MVP. Set ${POST_MVP_FEATURE_ENV[feature]}=1 to enable.`,
  };
}
