import { Link } from "react-router-dom";

import { ManuscriptSelector } from "../components/ManuscriptSelector";
import { useNarrative } from "../context/NarrativeContext";

export default function ManuscriptsPage() {
  const { selection } = useNarrative();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Manuscripts</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Every project you own on this account — select one, then open the planning workspace or HAL tracker.
        </p>
      </header>

      <ManuscriptSelector />

      {selection ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-4 py-3">
          <p className="text-sm text-emerald-100/90">
            Active: <span className="font-medium text-emerald-50">{selection.manuscriptId}</span>
            <span className="text-emerald-300/70"> · tenant {selection.tenantId}</span>
          </p>
          <Link
            to="/outline"
            className="rounded-full border border-violet-500/50 bg-violet-600/90 px-4 py-1.5 text-xs font-semibold text-violet-50 hover:bg-violet-500"
          >
            Open outline
          </Link>
          <Link
            to="/drafting"
            className="rounded-full border border-emerald-500/50 bg-emerald-600/90 px-4 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-500"
          >
            Drafting
          </Link>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">Select a manuscript above to enable workspace actions.</p>
      )}
    </div>
  );
}
