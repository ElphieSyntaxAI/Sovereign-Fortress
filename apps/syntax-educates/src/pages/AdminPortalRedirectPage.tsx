import { useEffect, useMemo } from "react";

import { buildMsgfAdminPortalUrl } from "@elphie-syntax/core/platform-admin-auth";

export function AdminPortalRedirectPage() {
  const target = useMemo(
    () =>
      buildMsgfAdminPortalUrl({
        hostname: window.location.hostname,
        env: import.meta.env,
      }),
    []
  );

  useEffect(() => {
    window.location.replace(target);
  }, [target]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 px-6 text-center text-sm text-zinc-400">
      <p>Opening MSGF operator portal…</p>
      <a href={target} className="text-amber-300 underline">
        Continue manually
      </a>
    </div>
  );
}
