import { useEffect, useMemo } from "react";

import {
  MSGF_ADMIN_PORTAL_PATH,
  buildMsgfAdminSignInUrl,
  isSafeRelativePath,
  stashAuthCallbackNext,
} from "@elphie-syntax/core/platform-admin-auth";

function readNextFromLocation(): string {
  const params = new URLSearchParams(window.location.search);
  const nextParam = params.get("next");
  return isSafeRelativePath(nextParam) ? nextParam.trim() : MSGF_ADMIN_PORTAL_PATH;
}

/** Syntax Education entry — operator auth completes on MSGF (Gated AI). */
export function AdminSignInRedirectPage() {
  const target = useMemo(() => {
    const next = readNextFromLocation();
    stashAuthCallbackNext(next);
    return buildMsgfAdminSignInUrl({
      next,
      from: "education",
      hostname: window.location.hostname,
      env: import.meta.env,
    });
  }, []);

  useEffect(() => {
    window.location.replace(target);
  }, [target]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 px-6 text-center text-sm text-zinc-400">
      <p>Redirecting to MSGF operator sign-in…</p>
      <a href={target} className="text-amber-300 underline">
        Continue manually
      </a>
    </div>
  );
}
