/**
 * MSGF → Author SSO: HTML bridge that POSTs the handoff token (avoids huge GET URLs).
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildAuthorHandoffAutoPostHtml(params: {
  bffOrigin: string;
  handoffToken: string;
  returnTo: string;
}): string {
  const action = `${params.bffOrigin.replace(/\/+$/, "")}/api/auth/msgf-handoff`;
  const handoff = escapeHtml(params.handoffToken);
  const returnTo = escapeHtml(params.returnTo);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Opening Author Ecosystem…</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; display: grid; place-items: center; min-height: 100vh; margin: 0; }
    p { max-width: 28rem; text-align: center; line-height: 1.5; }
  </style>
</head>
<body>
  <p>Signing you into Author Ecosystem…</p>
  <form id="handoff" method="post" action="${escapeHtml(action)}">
    <input type="hidden" name="handoff" value="${handoff}" />
    <input type="hidden" name="return_to" value="${returnTo}" />
  </form>
  <script>document.getElementById("handoff").submit();</script>
</body>
</html>`;
}
