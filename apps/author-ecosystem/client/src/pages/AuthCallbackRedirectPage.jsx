import { useEffect, useMemo, useState } from "react";

import { buildMsgfAdminSignInUrl, buildMsgfAuthCallbackUrl } from "@elphie-syntax/core/platform-admin-auth";

/**
 * Supabase email-confirm / magic-link landing when the project Site URL is Author.
 * Forwards the PKCE `code` (and hash tokens) to MSGF `/auth/callback` so the session
 * is minted on elphiesgatedai.elphiesyntax.com (required for `/admin/sign-in`).
 */
function buildMsgfCallbackUrl() {
  return buildMsgfAuthCallbackUrl({
    search: window.location.search,
    hash: window.location.hash || "",
    hostname: window.location.hostname,
    env: import.meta.env,
  });
}

export default function AuthCallbackRedirectPage() {
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const adminSignInHref = useMemo(
    () =>
      buildMsgfAdminSignInUrl({
        hostname: typeof window !== "undefined" ? window.location.hostname : undefined,
        env: import.meta.env,
      }),
    []
  );

  useEffect(() => {
    try {
      const target = buildMsgfCallbackUrl();
      window.location.replace(target);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-950 p-8 text-zinc-100">
        <p className="text-sm text-red-300">Could not complete sign-in redirect: {error}</p>
        <a href={adminSignInHref} className="text-sm text-emerald-400 underline">
          Open MSGF admin sign-in
        </a>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center text-sm text-zinc-400"
      style={{ background: "#0a0612" }}
    >
      Completing sign-in on MSGF…
    </div>
  );
}
