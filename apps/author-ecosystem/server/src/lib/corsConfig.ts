import type { CorsOptions } from "cors";

/**
 * Browser + Chrome extension origins allowed to call the BFF with credentials (httpOnly cookies).
 *
 * - `BFF_ALLOWED_ORIGINS`: comma-separated exact origins (e.g. `http://localhost:5173,https://app.example.com`)
 * - `BFF_ALLOWED_ORIGIN_REGEX`: optional JavaScript regex source for temporary deploy hosts
 *   (e.g. `^https://.*\\.run\\.app$` while testing Cloud Run URLs).
 * - `BFF_CHROME_EXTENSION_ID`: adds `chrome-extension://<id>`
 */
export function buildBffCorsOptions(): CorsOptions {
  const defaults = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://127.0.0.1:3000"];
  const fromEnv = (process.env.BFF_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allowed = new Set<string>([...defaults, ...fromEnv]);
  const regexRaw = process.env.BFF_ALLOWED_ORIGIN_REGEX?.trim();
  const allowedRegex = regexRaw ? new RegExp(regexRaw) : null;

  const extId = process.env.BFF_CHROME_EXTENSION_ID?.trim();
  if (extId) {
    allowed.add(`chrome-extension://${extId}`);
  }

  const allowList = allowed;

  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowList.has(origin)) {
        callback(null, true);
        return;
      }
      if (allowedRegex?.test(origin)) {
        callback(null, true);
        return;
      }
      // Unpacked Author extension (chrome-extension://…) in local dev
      if (
        origin.startsWith("chrome-extension://") &&
        process.env.NODE_ENV !== "production"
      ) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: [],
    maxAge: 86400,
  };
}
