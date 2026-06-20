import { defaultAuthorDashboardReturnTo } from "./author-handoff-origins.js";

type EnvLike = Record<string, string | undefined>;

export type OperatorHandoffPayload = {
  access_token: string;
  refresh_token: string;
  email: string;
  /** Expiration (Unix ms). */
  exp: number;
};

/** Allow only local Author client or production Author host in return_to. */
export function sanitizeAuthorReturnToUrl(raw: string | null | undefined, fallback: string): string {
  const fb = fallback.trim();
  const value = raw?.trim();
  if (!value) return fb;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return fb;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return fb;
  if (url.username || url.password) return fb;

  const host = url.hostname.toLowerCase();
  const port = url.port || (url.protocol === "https:" ? "443" : "80");

  const authorDevPorts = new Set(["5173", "5174"]);
  const localOk =
    (host === "127.0.0.1" || host === "localhost") &&
    (authorDevPorts.has(port) || port === "80" || port === "443");
  const prodOk = host === "authorecosystem.elphiesyntax.com";

  if (!localOk && !prodOk) return fb;
  return url.href;
}

export function buildMsgfAuthorHandoffUrl(msgfOrigin: string, authorDashboardUrl: string): string {
  const base = msgfOrigin.replace(/\/+$/, "");
  const u = new URL("/api/msgf/admin/author-handoff", `${base}/`);
  u.searchParams.set("return_to", authorDashboardUrl);
  return u.href;
}

function resolveMsgfAppOrigin(env: EnvLike = process.env): string {
  const raw =
    env.MSGF_APP_URL?.trim() ||
    env.NEXT_PUBLIC_MSGF_APP_URL?.trim() ||
    "https://elphiesgatedai.elphiesyntax.com";
  return raw.replace(/\/+$/, "");
}

/** Canonical SSO entry when the browser hits Author BFF handoff without a token. */
export function resolveMsgfAuthorHandoffEntryUrl(
  returnTo?: string | null,
  env: EnvLike = process.env
): string {
  const fallback = defaultAuthorDashboardReturnTo(env);
  const safeReturn = sanitizeAuthorReturnToUrl(returnTo, fallback);
  return buildMsgfAuthorHandoffUrl(resolveMsgfAppOrigin(env), safeReturn);
}
