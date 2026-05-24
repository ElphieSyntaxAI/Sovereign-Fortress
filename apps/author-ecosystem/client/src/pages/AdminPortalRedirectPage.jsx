import { useEffect, useMemo } from "react";

import { buildMsgfAdminPortalUrl } from "@elphie-syntax/core/platform-admin-auth";

/** Open the MSGF operator portal (product family launchpad). */
export default function AdminPortalRedirectPage() {
  const target = useMemo(
    () =>
      buildMsgfAdminPortalUrl({
        hostname: typeof window !== "undefined" ? window.location.hostname : undefined,
      }),
    []
  );

  useEffect(() => {
    window.location.replace(target);
  }, [target]);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-2 px-6 text-center text-sm text-zinc-400"
      style={{ background: "#0a0612" }}
    >
      <p>Opening MSGF operator portal…</p>
      <a href={target} className="text-violet-300 underline">
        Continue manually
      </a>
    </div>
  );
}
