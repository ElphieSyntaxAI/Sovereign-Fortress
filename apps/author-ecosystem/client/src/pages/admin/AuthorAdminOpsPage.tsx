import { Link } from "react-router-dom";

import {
  authorAdminMsgfLinks,
  authorHandoffFromMsgf,
  msgfOperatorPortalHref,
  msgfOperatorSignInHref,
} from "../../lib/authorAdminNavConfig";
import { useAuthorRole } from "../../context/AuthorRoleContext";

const DEV_CHECKLIST = [
  { cmd: "npm run dev -w msgf", note: "MSGF on http://127.0.0.1:3001" },
  { cmd: "npm run dev:author", note: "Author BFF :3002 + Vite :5173" },
  { cmd: "npm run bootstrap:author-msgf -w msgf", note: "Mint pulse license → MSGF_AUTHOR_PULSE_LICENSE_KEY" },
];

export default function AuthorAdminOpsPage() {
  const { user } = useAuthorRole();
  const isOperator = Boolean(user?.is_platform_operator);
  const msgf = authorAdminMsgfLinks();
  const handoffHome = authorHandoffFromMsgf(
    typeof window !== "undefined" ? `${window.location.origin}/home` : "http://127.0.0.1:5173/home"
  );
  const handoffAdmin = authorHandoffFromMsgf(
    typeof window !== "undefined" ? `${window.location.origin}/admin` : "http://127.0.0.1:5173/admin"
  );

  if (!isOperator) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-zinc-50">MSGF ops bridge</h1>
        <p className="text-sm text-zinc-400">
          Operator access is required. Sign in on MSGF, then use SSO handoff into Author.
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href={msgfOperatorSignInHref()}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
          >
            MSGF operator sign-in ↗
          </a>
          <Link to="/admin" className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200">
            Back to admin overview
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/90">
          Author ↔ MSGF
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-50">MSGF ops bridge</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          ARBITRATE, pillar health, and token savings for tenant{" "}
          <code className="text-violet-300">{msgf.tenant_id}</code> live on MSGF. Use this page while
          you code Author — HAL pulses and ingest flow through the BFF into the same brain.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <a
          href={msgf.ops_console}
          target="_blank"
          rel="noreferrer noopener"
          className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-4 hover:border-rose-600/50"
        >
          <h2 className="text-sm font-semibold text-rose-100">Ops console (ARBITRATE)</h2>
          <p className="mt-1 text-xs text-zinc-500">Pending incidents, resolve, DocuSign roster</p>
        </a>
        <a
          href={msgf.pillar_health}
          target="_blank"
          rel="noreferrer noopener"
          className="rounded-xl border border-violet-900/40 bg-violet-950/20 p-4 hover:border-violet-600/50"
        >
          <h2 className="text-sm font-semibold text-violet-100">Pillar health (operator)</h2>
          <p className="mt-1 text-xs text-zinc-500">Six-pillar lens + Big Brain summary</p>
        </a>
        <a
          href={msgf.token_savings}
          target="_blank"
          rel="noreferrer noopener"
          className="rounded-xl border border-emerald-900/35 bg-emerald-950/15 p-4 hover:border-emerald-600/40"
        >
          <h2 className="text-sm font-semibold text-emerald-100">Token savings</h2>
          <p className="mt-1 text-xs text-zinc-500">Filtered to Author stress-test tenant</p>
        </a>
        <a
          href={msgf.big_brain}
          target="_blank"
          rel="noreferrer noopener"
          className="rounded-xl border border-amber-900/35 bg-amber-950/15 p-4 hover:border-amber-600/40"
        >
          <h2 className="text-sm font-semibold text-amber-100">Bugs &amp; complaints</h2>
          <p className="mt-1 text-xs text-zinc-500">Big Brain operator queue</p>
        </a>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
        <h2 className="text-sm font-semibold text-zinc-200">SSO from MSGF admin portal</h2>
        <p className="mt-2 text-xs text-zinc-500">
          On <a href={msgf.portal} className="text-violet-400 underline">MSGF admin portal</a>, use{" "}
          <strong className="text-zinc-300">Open Author dashboard (localhost)</strong> — or open these
          handoff URLs after MSGF sign-in:
        </p>
        <ul className="mt-3 space-y-2 font-mono text-[11px] text-zinc-500">
          <li>
            <span className="text-zinc-400">Creative home:</span>{" "}
            <a href={handoffHome} className="text-violet-300 underline break-all">
              {handoffHome}
            </a>
          </li>
          <li>
            <span className="text-zinc-400">This admin hub:</span>{" "}
            <a href={handoffAdmin} className="text-violet-300 underline break-all">
              {handoffAdmin}
            </a>
          </li>
        </ul>
        <p className="mt-3 text-xs text-zinc-600">
          Project origin for mapped repos:{" "}
          <code className="text-violet-300">{msgf.project_origin}</code>
        </p>
      </section>

      <section className="rounded-xl border border-dashed border-zinc-700 p-4">
        <h2 className="text-sm font-semibold text-zinc-300">Local dev stack</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs text-zinc-500">
          {DEV_CHECKLIST.map((row) => (
            <li key={row.cmd}>
              <code className="text-emerald-300/90">{row.cmd}</code> — {row.note}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-zinc-600">
          One command: <code className="text-violet-300">npm run dev:author-msgf</code> (MSGF + Author).
        </p>
      </section>

      <p className="text-xs text-zinc-600">
        <Link to="/admin" className="text-violet-400 underline">
          ← Admin overview
        </Link>
        {" · "}
        <a href={msgfOperatorPortalHref()} className="text-violet-400 underline">
          MSGF portal ↗
        </a>
      </p>
    </div>
  );
}
