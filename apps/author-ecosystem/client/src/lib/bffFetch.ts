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

export function bffFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(bffUrl(path), {
    ...bffCredentials,
    ...init,
    credentials: init?.credentials ?? bffCredentials.credentials,
  });
}

export function bffAuthHeaders(accessToken: string | null | undefined): Record<string, string> {
  const headers: Record<string, string> = {};
  const t = typeof accessToken === "string" ? accessToken.trim() : "";
  if (t) headers.Authorization = `Bearer ${t}`;
  return headers;
}
