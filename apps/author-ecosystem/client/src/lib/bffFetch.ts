/**
 * BFF calls use `credentials: "include"` so httpOnly `author_bff_jwt` is sent.
 * Optional `Authorization: Bearer` when `getAccessToken` returns a string (CLI / extension / migration).
 */
export const bffCredentials: RequestInit = { credentials: "include" };

export function bffAuthHeaders(accessToken: string | null | undefined): Record<string, string> {
  const headers: Record<string, string> = {};
  const t = typeof accessToken === "string" ? accessToken.trim() : "";
  if (t) headers.Authorization = `Bearer ${t}`;
  return headers;
}
