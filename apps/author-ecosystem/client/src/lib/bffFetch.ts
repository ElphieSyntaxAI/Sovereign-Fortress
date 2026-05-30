/**
 * BFF calls use `credentials: "include"` so httpOnly `author_bff_jwt` is sent.
 * Optional `Authorization: Bearer` when `getAccessToken` returns a string (CLI / extension / migration).
 *
 * In production behind `elphiesyntax.com`, `/api/...` can stay same-origin via rewrites.
 * For temporary Google/Vercel/Cloud Run testing, set:
 *
 *   VITE_AUTHOR_BFF_URL=https://<author-bff-service>.run.app
 *
 * Then every client call can use `bffUrl("/api/...")` and still work from a separate frontend host.
 */
export const bffCredentials: RequestInit = { credentials: "include" };

const rawBffOrigin =
  (import.meta.env.VITE_AUTHOR_BFF_URL as string | undefined)?.trim() ||
  (import.meta.env.VITE_BFF_URL as string | undefined)?.trim() ||
  "";

const bffOrigin = rawBffOrigin.replace(/\/+$/, "");

export function bffUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (!bffOrigin) return path;
  return `${bffOrigin}${path.startsWith("/") ? path : `/${path}`}`;
}

const BFF_FETCH_TIMEOUT_MS = 20_000;

export function bffFetch(path: string, init?: RequestInit): Promise<Response> {
  const signal =
    init?.signal ??
    (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(BFF_FETCH_TIMEOUT_MS)
      : undefined);
  return fetch(bffUrl(path), {
    ...bffCredentials,
    ...init,
    signal,
    credentials: init?.credentials ?? bffCredentials.credentials,
  });
}

/** Turn network-level `TypeError: Failed to fetch` into an actionable message. */
export function formatBffFetchError(err: unknown, path: string): string {
  const msg = err instanceof Error ? err.message : String(err);
  const target = bffUrl(path);
  const isNetwork =
    err instanceof TypeError ||
    /failed to fetch|network|ECONNREFUSED|ENOTFOUND/i.test(msg);

  if (!isNetwork) return msg || "Request failed";

  const lines = [
    "Could not reach the Author API (BFF).",
    `Target: ${target}`,
    "",
    "Local dev — run both:",
    "  npm run dev:author-bff",
    "  npm run dev:author-client",
    "Or: npm run dev:author",
    "Or: npm run docker:dev  (then open http://127.0.0.1:5173 and http://127.0.0.1:3002/api/ping)",
    "",
    "Production — build the client with VITE_AUTHOR_BFF_URL pointing at your Author BFF (Cloud Run),",
    "and allow the frontend origin in BFF_ALLOWED_ORIGINS.",
  ];
  return lines.join("\n");
}

export function bffAuthHeaders(accessToken: string | null | undefined): Record<string, string> {
  const headers: Record<string, string> = {};
  const t = typeof accessToken === "string" ? accessToken.trim() : "";
  if (t) headers.Authorization = `Bearer ${t}`;
  return headers;
}
