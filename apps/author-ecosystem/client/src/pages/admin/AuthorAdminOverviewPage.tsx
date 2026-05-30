import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { AuthorSentinelBugButton } from "../../components/AuthorSentinelBugButton";
import {
  authorAdminMsgfLinks,
  authorAdminProducts,
  msgfOperatorPortalHref,
  msgfOperatorSignInHref,
} from "../../lib/authorAdminNavConfig";
import { useAuthorRole } from "../../context/AuthorRoleContext";
import { bffCredentials, bffUrl } from "../../lib/bffFetch";

type RoleStat = {
  role: string;
  signups: number;
  manuscripts: number;
  avg_tokens: number;
  total_tokens: number;
};

type Overview = {
  generated_at: string;
  totals: { profiles: number; manuscripts: number; tokens_cumulative: number };
  by_role: RoleStat[];
  msgf_links: {
    admin_big_brain: string | null;
    admin_token_savings: string | null;
    dashboard: string | null;
  };
  open_document_reviews: number;
};

const TONE_RING: Record<string, string> = {
  emerald: "border-emerald-500/30 hover:border-emerald-500/50",
  amethyst: "border-violet-500/30 hover:border-violet-500/50",
  topaz: "border-amber-500/30 hover:border-amber-500/50",
};

export default function AuthorAdminOverviewPage() {
  const { user } = useAuthorRole();
  const isOperator = Boolean(user?.is_platform_operator);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOperator) return;
    setLoading(true);
    void fetch(bffUrl("/api/platform-admin/overview"), { ...bffCredentials })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as Overview & { error?: string };
        if (!res.ok) throw new Error(json.error || res.statusText);
        setOverview(json);
        setError(null);
      })
      .catch((e) => {
        setOverview(null);
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setLoading(false));
  }, [isOperator]);

  if (!isOperator) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-zinc-50">Platform admin</h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-400">
            Operator metrics, cross-product launch, and MSGF bug queues require a platform operator session.
          </p>
        </header>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/sign-in"
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
          >
            Operator sign-in
          </Link>
          <a
            href={msgfOperatorPortalHref()}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            MSGF admin portal ↗
          </a>
        </div>
        <p className="text-xs text-zinc-500">
          Or add your email to <code className="text-violet-300">MSGF_GLOBAL_ADMIN_EMAILS</code> in the
          monorepo root <code className="text-violet-300">.env.local</code>.
        </p>
      </div>
    );
  }

  const products = authorAdminProducts();
  const msgf = authorAdminMsgfLinks();
  const bigBrain = overview?.msgf_links?.admin_big_brain ?? msgf.big_brain;
  const tokenSavings = overview?.msgf_links?.admin_token_savings ?? msgf.token_savings;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/90">
          Platform operator
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-50">Admin overview</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Cross-product launch, signup metrics, token usage by role, and links to MSGF bugs &amp; complaints.
        </p>
      </header>

      <section>
        <h2 className="text-sm font-semibold text-zinc-200">Products</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {products.map((p) => (
            <a
              key={p.id}
              href={p.href}
              target={p.external ? "_blank" : undefined}
              rel={p.external ? "noreferrer noopener" : undefined}
              className={[
                "rounded-xl border bg-zinc-950/50 p-4 transition",
                TONE_RING[p.tone] ?? TONE_RING.amethyst,
              ].join(" ")}
            >
              <h3 className="text-sm font-semibold text-zinc-100">{p.title}</h3>
              <p className="mt-1 text-xs text-zinc-500">{p.summary}</p>
              <span className="mt-2 inline-block text-[10px] text-violet-300">
                Open {p.external ? "↗" : "→"}
              </span>
            </a>
          ))}
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        <Link
          to="/admin/ops"
          className="rounded-full border border-violet-500/40 bg-violet-600/20 px-4 py-2 text-sm font-semibold text-violet-50 hover:bg-violet-600/35"
        >
          Author ↔ MSGF ops bridge
        </Link>
        <a
          href={msgf.ops_console}
          target="_blank"
          rel="noreferrer noopener"
          className="rounded-full border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
        >
          Open MSGF ops console ↗
        </a>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <a
          href={bigBrain}
          target="_blank"
          rel="noreferrer noopener"
          className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-4 hover:border-rose-600/50"
        >
          <h2 className="text-sm font-semibold text-rose-100">Bugs &amp; complaints</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Big Brain operator queue on MSGF — Sentinel reports, heal escalations, and human arbitration.
          </p>
        </a>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
          <h2 className="text-sm font-semibold text-zinc-200">In-app reports</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Authors file issues via the Sentinel bug button (creative lens). Opens MSGF self-heal pipeline.
          </p>
          <div className="mt-3">
            <AuthorSentinelBugButton />
          </div>
        </div>
        {tokenSavings ? (
          <a
            href={tokenSavings}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-xl border border-emerald-900/35 bg-emerald-950/15 p-4 hover:border-emerald-600/40 sm:col-span-2"
          >
            <h2 className="text-sm font-semibold text-emerald-100">Token savings (MSGF)</h2>
            <p className="mt-1 text-xs text-zinc-400">Aggregate routing savings and pulse estimates per tenant.</p>
          </a>
        ) : null}
      </section>

      {loading ? <p className="text-sm text-zinc-500">Loading platform metrics…</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {overview ? (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Registered profiles" value={overview.totals.profiles} />
            <StatCard label="Manuscripts" value={overview.totals.manuscripts} />
            <StatCard label="Tokens (cumulative)" value={overview.totals.tokens_cumulative} />
          </section>

          {overview.open_document_reviews > 0 ? (
            <p className="text-xs text-amber-300/90">
              {overview.open_document_reviews} document import(s) awaiting author review in wiki modal.
            </p>
          ) : null}

          <section className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-zinc-900/80 text-zinc-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Signups</th>
                  <th className="px-3 py-2 font-medium">Projects</th>
                  <th className="px-3 py-2 font-medium">Avg tokens</th>
                  <th className="px-3 py-2 font-medium">Total tokens</th>
                </tr>
              </thead>
              <tbody>
                {overview.by_role.map((row) => (
                  <tr key={row.role} className="border-t border-zinc-800/80 text-zinc-300">
                    <td className="px-3 py-2 capitalize">{row.role}</td>
                    <td className="px-3 py-2">{row.signups}</td>
                    <td className="px-3 py-2">{row.manuscripts}</td>
                    <td className="px-3 py-2">{row.avg_tokens.toLocaleString()}</td>
                    <td className="px-3 py-2">{row.total_tokens.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <p className="text-[10px] text-zinc-600">
            Snapshot {new Date(overview.generated_at).toLocaleString()} · Operator SSO:{" "}
            <a href={msgfOperatorSignInHref()} className="text-violet-400 underline">
              MSGF sign-in
            </a>
          </p>
        </>
      ) : null}
    </div>
  );
}

function StatCard(props: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{props.label}</p>
      <p className="mt-1 text-xl font-semibold text-zinc-100">{props.value.toLocaleString()}</p>
    </div>
  );
}
