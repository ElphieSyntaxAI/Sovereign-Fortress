/**
 * MSGF → Author SSO: establish Supabase session in the browser (avoids huge Set-Cookie
 * response headers through author-client nginx).
 */

export type AuthorHandoffClientSessionConfig = {
  supabaseUrl: string;
  supabasePublishableKey: string;
  accessToken: string;
  refreshToken: string;
  returnTo: string;
  finishUrl: string;
  cookieDomain?: string;
  cookieSecure: boolean;
};

export function buildAuthorHandoffClientSessionHtml(config: AuthorHandoffClientSessionConfig): string {
  const payload = JSON.stringify(config).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Opening Author Ecosystem…</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; display: grid; place-items: center; min-height: 100vh; margin: 0; }
    p { max-width: 28rem; text-align: center; line-height: 1.5; }
    .err { color: #fca5a5; }
  </style>
</head>
<body>
  <p id="status">Signing you into Author Ecosystem…</p>
  <script type="application/json" id="handoff-config">${payload}</script>
  <script src="/handoff-bridge.js" defer></script>
</body>
</html>`;
}
