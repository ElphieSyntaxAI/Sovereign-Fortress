import { Link } from "react-router-dom";

import { ManuscriptHub } from "../components/ManuscriptHub";
import { useNarrative } from "../context/NarrativeContext";
import { displayTitle } from "../lib/manuscriptTypes";

export default function ManuscriptsPage() {
  const { selection } = useNarrative();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Manuscripts</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Create series or books, link Google Docs for HAL, and manage current projects. The active manuscript
          drives wiki, drafting, and business views.
        </p>
      </header>

      {selection ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-4 py-3">
          <p className="text-sm text-emerald-100/90">
            Active manuscript:{" "}
            <span className="font-medium text-emerald-50">
              {selection.title?.trim() || displayTitle({ title: selection.title, id: selection.manuscriptId })}
            </span>
          </p>
          <Link
            to="/wiki"
            className="rounded-full border border-violet-500/50 bg-violet-600/90 px-4 py-1.5 text-xs font-semibold text-violet-50 hover:bg-violet-500"
          >
            Wiki
          </Link>
          <Link
            to="/outline"
            className="rounded-full border border-violet-500/50 bg-violet-600/90 px-4 py-1.5 text-xs font-semibold text-violet-50 hover:bg-violet-500"
          >
            Outline
          </Link>
          <Link
            to="/drafting"
            className="rounded-full border border-emerald-500/50 bg-emerald-600/90 px-4 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-500"
          >
            Drafting
          </Link>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">
          Click a linked project below to set your active manuscript (confirmation required when switching).
        </p>
      )}

      <ManuscriptHub />
    </div>
  );
}
