import { Link } from "react-router-dom";

import { buildMsgfAdminPortalUrl, buildMsgfAdminSignInUrl } from "@elphie-syntax/core/platform-admin-auth";

import { authorHandoffFromMsgf } from "../lib/authorAdminNavConfig";

function resolveMsgfPortalHref(): string {
  return buildMsgfAdminPortalUrl({
    hostname: typeof window !== "undefined" ? window.location.hostname : undefined,
    env: import.meta.env as Record<string, string | undefined>,
  });
}

function resolveAdminSignInHref(): string {
  return buildMsgfAdminSignInUrl({
    from: "author",
    hostname: typeof window !== "undefined" ? window.location.hostname : undefined,
    env: import.meta.env as Record<string, string | undefined>,
  });
}

/**
 * Visible on the author dashboard — operator auth is on MSGF, not the author BFF session.
 */
export function OperatorAdminPanel() {
  const portalHref = resolveMsgfPortalHref();
  const signInHref = resolveAdminSignInHref();

  return (
    <section
      className="rounded-xl border border-violet-500/35 bg-gradient-to-br from-violet-950/40 to-zinc-950/80 px-4 py-3 text-sm shadow-sm"
      aria-label="Platform operator access"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300/90">
            Platform operator
          </p>
          <p className="mt-1 max-w-xl text-xs text-zinc-400">
            From the MSGF admin portal, use{" "}
            <strong className="font-medium text-zinc-300">Open Author dashboard (localhost)</strong>{" "}
            — it SSO-handoffs your MSGF session to this app. Do not use the plain Vite root link unless
            you will sign in here separately.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin"
            className="inline-flex items-center rounded-lg border border-violet-500/50 bg-violet-600/25 px-3 py-1.5 text-xs font-semibold text-violet-50 hover:bg-violet-600/40"
          >
            Author admin hub
          </Link>
          <Link
            to="/admin/ops"
            className="inline-flex items-center rounded-lg border border-emerald-500/40 bg-emerald-600/15 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-600/25"
          >
            MSGF ops bridge
          </Link>
          <Link
            to="/admin/sign-in"
            className="inline-flex items-center rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900"
          >
            MSGF sign-in →
          </Link>
          <a
            href={portalHref}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-900"
          >
            MSGF portal ↗
          </a>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">
        SSO handoff (after MSGF sign-in):{" "}
        <a
          href={authorHandoffFromMsgf(
            typeof window !== "undefined" ? `${window.location.origin}/admin` : "http://127.0.0.1:5173/admin"
          )}
          className="font-mono text-violet-300/90 underline hover:text-violet-200"
        >
          refresh Author session from MSGF
        </a>
      </p>
    </section>
  );
}
