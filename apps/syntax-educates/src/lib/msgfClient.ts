/** Shared MSGF fetch helper for the Syntax Educates SPA. */
const DEFAULT_MSGF =
  (typeof import.meta !== "undefined" &&
    (import.meta as ImportMeta & { env?: Record<string, string> }).env
      ?.VITE_MSGF_APP_URL) ||
  "http://127.0.0.1:3001";

export function msgfBaseUrl(): string {
  return String(DEFAULT_MSGF).replace(/\/+$/, "");
}

export async function msgfFetch<T = unknown>(
  path: string,
  init?: RequestInit & { tenantId?: string; persona?: string }
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("content-type") && init?.body) {
    headers.set("content-type", "application/json");
  }
  headers.set("x-msgf-tenant-id", init?.tenantId ?? "syntax_education");
  headers.set("x-msgf-persona", init?.persona ?? "teacher");

  const res = await fetch(`${msgfBaseUrl()}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(
      (json as { error?: string }).error || `${res.status} ${res.statusText}`
    );
  }
  return json;
}
