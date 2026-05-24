import { Link } from "react-router-dom";

import { BusinessPageHeader } from "../components/BusinessPageHeader";
import { ManuscriptRequiredBanner } from "../components/ManuscriptRequiredBanner";
import { useNarrative } from "../context/NarrativeContext";

const HELPER_ROLES = [
  { title: "Developmental editor", desc: "Outline and continuity support after guild tier unlock." },
  { title: "Line editor", desc: "Voice-preserving polish on locked drafts." },
  { title: "Proofreader", desc: "Final pass before publisher packets." },
  { title: "Sensitivity reader", desc: "Market and representation lens from verified helpers." },
] as const;

export default function CreativeGuildPage() {
  const { selection } = useNarrative();

  return (
    <div className="space-y-6">
      <BusinessPageHeader
        title="Creative Guild"
        description="Helpers home — match verified editors, apprentices, and VAs to your active"
      />

      {!selection ? <ManuscriptRequiredBanner /> : null}

      <section className="rounded-xl border border-amber-900/35 bg-amber-950/15 p-4">
        <h2 className="text-sm font-semibold text-amber-100">Guild marketplace (Phase 2)</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Tier 2+ authors unlock subsidized apprentice matching. Queue helpers by genre, verify human-flow
          milestones, and contract through the platform — without exposing raw manuscript text in open listings.
        </p>
        {selection ? (
          <p className="mt-2 text-xs text-amber-200/80">
            Active manuscript: <span className="font-mono">{selection.manuscriptId}</span>
          </p>
        ) : null}
      </section>

      <ul className="grid gap-3 sm:grid-cols-2">
        {HELPER_ROLES.map((h) => (
          <li
            key={h.title}
            className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4"
          >
            <h3 className="text-sm font-medium text-zinc-100">{h.title}</h3>
            <p className="mt-1 text-xs text-zinc-500">{h.desc}</p>
            <button
              type="button"
              disabled
              className="mt-3 rounded-full border border-zinc-700 px-3 py-1 text-[10px] uppercase tracking-wide text-zinc-600"
            >
              Browse queue (soon)
            </button>
          </li>
        ))}
      </ul>

      <p className="text-xs text-zinc-600">
        Are you a helper?{" "}
        <Link to="/sign-in" className="text-amber-300 underline">
          Sign in
        </Link>{" "}
        with the Editor or Helper role schedule.
      </p>
    </div>
  );
}
