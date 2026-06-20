/** Production Author Ecosystem hosts (see docs/MONOREPO_PRODUCTS.md). */
export const AUTHOR_APP_URL_PRODUCTION = "https://authorecosystem.elphiesyntax.com";
/** Dedicated API host — requires DNS; prefer same-origin `/api` on {@link AUTHOR_APP_URL_PRODUCTION}. */
export const AUTHOR_BFF_API_SUBDOMAIN_PRODUCTION = "https://api.authorecosystem.elphiesyntax.com";

type EnvLike = Record<string, string | undefined>;

function trimOrigin(raw: string | undefined): string | null {
  const s = raw?.trim()?.replace(/\/+$/, "");
  return s || null;
}

function isLocalDevOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return host === "127.0.0.1" || host === "localhost";
  } catch {
    return false;
  }
}

/** api.* subdomain is not mapped in prod — use SPA same-origin /api instead. */
function isUnmappedAuthorApiSubdomain(origin: string): boolean {
  try {
    return new URL(origin).hostname.toLowerCase() === "api.authorecosystem.elphiesyntax.com";
  } catch {
    return false;
  }
}

/**
 * Browser-facing BFF base for handoff + API.
 * Production default: Author SPA origin (nginx proxies `/api` → Cloud Run BFF).
 */
export function resolveAuthorBffOrigin(env: EnvLike = process.env): string {
  const candidates = [
    env.AUTHOR_BFF_URL,
    env.AUTHOR_ECOSYSTEM_URL,
    env.AUTHOR_BFF_PUBLIC_URL,
  ];
  for (const raw of candidates) {
    const origin = trimOrigin(raw);
    if (!origin) continue;
    if (env.NODE_ENV === "production" && isUnmappedAuthorApiSubdomain(origin)) continue;
    if (!isLocalDevOrigin(origin) || env.NODE_ENV !== "production") {
      return origin;
    }
  }
  if (env.NODE_ENV === "production") {
    return (
      trimOrigin(env.AUTHOR_APP_URL) ??
      trimOrigin(env.NEXT_PUBLIC_AUTHOR_APP_URL) ??
      trimOrigin(env.VITE_AUTHOR_APP_URL) ??
      AUTHOR_APP_URL_PRODUCTION
    );
  }
  const vite = trimOrigin(env.VITE_AUTHOR_BFF_URL);
  if (vite) return vite;
  return "http://127.0.0.1:3002";
}

/** Author Vite client base URL for post-handoff `return_to`. */
export function resolveAuthorClientOrigin(env: EnvLike = process.env): string {
  const candidates = [
    env.AUTHOR_APP_URL,
    env.NEXT_PUBLIC_AUTHOR_APP_URL,
    env.VITE_AUTHOR_APP_URL,
    env.AUTHOR_CLIENT_DEV_URL,
  ];
  for (const raw of candidates) {
    const origin = trimOrigin(raw);
    if (origin && (!isLocalDevOrigin(origin) || env.NODE_ENV !== "production")) {
      return origin;
    }
  }
  if (env.NODE_ENV === "production") return AUTHOR_APP_URL_PRODUCTION;
  return "http://127.0.0.1:5173";
}

export function defaultAuthorDashboardReturnTo(env: EnvLike = process.env): string {
  return `${resolveAuthorClientOrigin(env)}/home`;
}
