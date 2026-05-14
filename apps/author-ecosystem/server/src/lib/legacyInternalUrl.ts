/**
 * Legacy RAG / Lore-Git / auth bridge must be reached **server-to-server** on loopback
 * so port 3003 is never required on the public internet.
 */
export function resolveLegacyExpressBaseUrl(): string {
  const raw = (process.env.LEGACY_EXPRESS_URL ?? "").trim();
  const port = (process.env.LEGACY_EXPRESS_PORT ?? "3003").trim();
  const fallback = `http://127.0.0.1:${port}`;
  const url = raw || fallback;

  if (process.env.NODE_ENV === "production") {
    let host: string;
    try {
      host = new URL(url).hostname;
    } catch {
      throw new Error(`LEGACY_EXPRESS_URL is invalid: ${url}`);
    }
    const internal = host === "127.0.0.1" || host === "localhost" || host === "::1";
    if (!internal) {
      throw new Error(
        `LEGACY_EXPRESS_URL must use loopback (127.0.0.1 / localhost) in production; got host "${host}". ` +
          "The legacy RAG service must not be exposed publicly — proxy only from this BFF."
      );
    }
  }

  return url.replace(/\/?$/, "");
}
