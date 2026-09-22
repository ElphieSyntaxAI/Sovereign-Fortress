/**
 * Author post-MVP surfaces (fan hub, helper guild). Default OFF.
 */

function flagOn(value: string | undefined): boolean {
  const v = value?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function isAuthorFanHubEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return (
    flagOn(env.AUTHOR_POST_MVP_FAN_HUB) || flagOn(env.VITE_AUTHOR_POST_MVP_FAN_HUB)
  );
}

export function isAuthorHelperEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return (
    flagOn(env.AUTHOR_POST_MVP_HELPER) || flagOn(env.VITE_AUTHOR_POST_MVP_HELPER)
  );
}

export type AuthorPostMvpFeature = "author_fan_hub" | "author_helper";

/** Fan-hub HTTP surfaces only. Health/ping/status must stay reachable while the hub is hidden. */
export function isAuthorFanHubRequestPath(pathname: string): boolean {
  const p = String(pathname ?? "").split("?")[0] || "/";
  return (
    p === "/api/fan-hub" ||
    p.startsWith("/api/fan-hub/") ||
    p === "/api/fans" ||
    p.startsWith("/api/fans/")
  );
}

export function authorPostMvpDisabledPayload(feature: AuthorPostMvpFeature) {
  const envName =
    feature === "author_fan_hub" ? "AUTHOR_POST_MVP_FAN_HUB" : "AUTHOR_POST_MVP_HELPER";
  return {
    ok: false as const,
    error: "feature_gated" as const,
    feature,
    message: `${feature} is deferred until after Author MVP. Set ${envName}=1 to enable.`,
  };
}
