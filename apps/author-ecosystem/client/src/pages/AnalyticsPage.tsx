import { Link } from "react-router-dom";

import { BusinessCreativeToggle } from "../components/BusinessCreativeToggle";
import { useAuthorRole } from "../context/AuthorRoleContext";
import { useAuthorWorkspaceLens } from "../context/AuthorWorkspaceLensContext";
import { useNarrative } from "../context/NarrativeContext";

const SECTIONS = [
  {
    id: "growth",
    title: "Growth & linguistic DNA",
    desc: "15-session craft trajectory, milestone deltas, and HAL rhythm trends.",
    mode: "GROWTH",
  },
  {
    id: "business",
    title: "Sales & fan pulse",
    desc: "Marketing wins, HAL correlation table, fan signals, and revenue logging.",
    mode: "BUSINESS",
  },
  {
    id: "media",
    title: "Multimedia poster",
    desc: "Campaign-ready poster assets tied to your active manuscript (coming soon).",
    mode: null,
  },
] as const;

export default function AnalyticsPage() {
  const { user } = useAuthorRole();
  const { meta } = useAuthorWorkspaceLens();
  const { selection } = useNarrative();
  const canSeeSales = user?.persona === "author" || user?.persona === "publisher";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90">{meta.label} lens</p>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Growth charts, sales tracking, and multimedia poster — maps to the Business side of the Creative
            Integrity Flywheel.
          </p>
        </div>
        <BusinessCreativeToggle />
      </header>

      {!selection ? (
        <p className="rounded-lg border border-amber-900/40 bg-amber-950/25 px-4 py-3 text-sm text-amber-100/90">
          Pick a manuscript on{" "}
          <Link to="/manuscripts" className="underline underline-offset-2">
            Manuscripts
          </Link>{" "}
          first so analytics load tenant-scoped data.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {SECTIONS.map((s) => {
          if (s.id === "business" && !canSeeSales) return null;
          return (
            <article
              key={s.id}
              className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4"
            >
              <h2 className="text-sm font-semibold text-zinc-100">{s.title}</h2>
              <p className="mt-1 text-xs text-zinc-500">{s.desc}</p>
              {s.mode ? (
                <Link
                  to="/dashboard"
                  className="mt-3 inline-flex rounded-full border border-violet-500/40 px-3 py-1.5 text-xs font-medium text-violet-200 hover:bg-violet-950/40"
                >
                  View in workspace ({s.mode})
                </Link>
              ) : (
                <p className="mt-3 text-[10px] uppercase tracking-wide text-zinc-600">Coming soon</p>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
