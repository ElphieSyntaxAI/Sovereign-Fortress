import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import {
  MSGF_ADMIN_PORTAL_PATH,
  buildMsgfAdminSignInUrl,
  isSafeRelativePath,
  stashAuthCallbackNext,
} from "@elphie-syntax/core/platform-admin-auth";

/**
 * Author Ecosystem entry for platform operators — session is minted on MSGF (Gated AI).
 */
export default function AdminSignInRedirectPage() {
  const [searchParams] = useSearchParams();

  const target = useMemo(() => {
    const nextParam = searchParams.get("next");
    const next = isSafeRelativePath(nextParam) ? nextParam.trim() : MSGF_ADMIN_PORTAL_PATH;
    stashAuthCallbackNext(next);
    return buildMsgfAdminSignInUrl({
      next,
      from: "author",
      hostname: typeof window !== "undefined" ? window.location.hostname : undefined,
    });
  }, [searchParams]);

  useEffect(() => {
    window.location.replace(target);
  }, [target]);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-2 px-6 text-center text-sm text-zinc-400"
      style={{ background: "#0a0612" }}
    >
      <p>Redirecting to MSGF operator sign-in…</p>
      <a href={target} className="text-emerald-400 underline">
        Continue manually
      </a>
    </div>
  );
}
