import { useEffect, useMemo, useState } from "react";

import { buildMsgfAdminSignInUrl, buildMsgfAuthCallbackUrl } from "@elphie-syntax/core/platform-admin-auth";

/** Email confirm / magic-link shim when Supabase Site URL is Syntax Education. */
export function AuthCallbackRedirectPage() {
  const [error, setError] = useState<string | null>(null);
  const adminSignInHref = useMemo(
    () =>
      buildMsgfAdminSignInUrl({
        hostname: window.location.hostname,
        env: import.meta.env,
      }),
    []
  );

  useEffect(() => {
    try {
      const target = buildMsgfAuthCallbackUrl({
        search: window.location.search,
        hash: window.location.hash || "",
        hostname: window.location.hostname,
        env: import.meta.env,
      });
      window.location.replace(target);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  if (error) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-8 text-zinc-100">
        <p className="text-sm text-red-300">Could not complete sign-in redirect: {error}</p>
        <a href={adminSignInHref} className="text-sm text-amber-300 underline">
          Open MSGF admin sign-in
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-zinc-400">
      Completing sign-in on MSGF…
    </div>
  );
}
