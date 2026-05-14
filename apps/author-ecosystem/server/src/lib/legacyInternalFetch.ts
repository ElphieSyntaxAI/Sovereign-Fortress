import { resolveLegacyExpressBaseUrl } from "./legacyInternalUrl.js";

export async function legacyInternalFetch(
  authSubPath: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<{ status: number; json: unknown }> {
  const base = resolveLegacyExpressBaseUrl();
  const sub = authSubPath.replace(/^\//, "");
  const url = `${base}/api/auth/${sub}`;
  const timeoutMs = init.timeoutMs ?? 25_000;
  const { timeoutMs: _t, ...rest } = init;

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...rest, signal: ac.signal });
    const text = await res.text();
    let json: unknown = {};
    if (text) {
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        json = { message: text };
      }
    }
    return { status: res.status, json };
  } finally {
    clearTimeout(t);
  }
}
