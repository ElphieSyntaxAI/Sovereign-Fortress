import { Link } from "react-router-dom";

import SettingsPage from "../SettingsPage";
import { useAuthorRole } from "../../context/AuthorRoleContext";
import { msgfOperatorPortalHref } from "../../lib/authorAdminNavConfig";

export default function GlobalAdminSettingsPage() {
  const { user } = useAuthorRole();
  const isOperator = Boolean(user?.is_platform_operator);

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300/80">
          Global settings
        </p>
        <h1 className="mt-1 text-lg font-semibold text-zinc-100">Account &amp; platform</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Persona activation, creative/business lens defaults, and legal schedules. Operators can also open
          MSGF env and tier controls on the MSGF portal.
        </p>
        {isOperator ? (
          <a
            href={msgfOperatorPortalHref()}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-3 inline-flex rounded-lg border border-violet-500/40 px-3 py-1.5 text-xs font-medium text-violet-100 hover:bg-violet-950/40"
          >
            MSGF operator portal ↗
          </a>
        ) : (
          <p className="mt-2 text-[11px] text-zinc-600">
            Platform-wide knobs:{" "}
            <Link to="/admin/sign-in" className="text-violet-400 underline">
              operator sign-in
            </Link>
          </p>
        )}
      </header>
      <SettingsPage />
    </div>
  );
}
