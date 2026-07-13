/**
 * Parent Resilience / Friction dashboard — no raw drafts or keystrokes.
 */
import { useState } from "react";

import { PillarBadge } from "@elphie-syntax/ui";

import { msgfFetch } from "../lib/msgfClient";

type Digest = {
  studentDisplayLabel: string;
  legalNote: string;
  lessonsTouched: number;
  avgHumanEffortConfidence: number;
  submittedCount: number;
  stuckCount: number;
  themes: string[];
  resilienceScore: number;
  frictionScore: number;
  resilienceBand: "strong" | "steady" | "needs_support";
  frictionBand: "low" | "moderate" | "elevated";
  themeCategories: { resilience: string[]; friction: string[] };
};

export function ParentDigestPage() {
  const [entityToken, setEntityToken] = useState("tok_anon_stu_demo4th01");
  const [digest, setDigest] = useState<Digest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const json = await msgfFetch<{ digest: Digest }>(
        `/api/msgf/education/parent/digest?entityToken=${encodeURIComponent(entityToken)}`
      );
      setDigest(json.digest);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-6 py-6">
      <header className="mb-6 flex items-center gap-3">
        <PillarBadge lineageLabel="P5 · P6" pillar="P5" />
        <h1 className="text-xl font-semibold">Parent dashboard</h1>
      </header>
      <p className="mb-4 max-w-2xl text-sm text-zinc-400">
        Resilience and friction themes for guardians. Never shows raw writing or keystrokes.
        Not an outcome grade (Utah H.B. 273).
      </p>

      <label className="mb-3 block max-w-md text-xs text-zinc-400">
        Student token (from school — not a real name)
        <input
          className="mt-1 block w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm"
          value={entityToken}
          onChange={(e) => setEntityToken(e.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={() => void load()}
        className="mb-4 rounded border border-sky-600 bg-sky-600/20 px-3 py-1.5 text-sm text-sky-200"
      >
        {busy ? "Loading…" : "Load dashboard"}
      </button>

      {error && <p className="text-sm text-rose-400">{error}</p>}
      {digest && (
        <div className="max-w-2xl space-y-4">
          <div className="rounded border border-zinc-800 bg-zinc-900/50 p-4 text-sm">
            <p className="text-lg text-zinc-100">{digest.studentDisplayLabel}</p>
            <p className="mt-1 text-xs text-zinc-500">{digest.legalNote}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Stat label="Lessons" value={String(digest.lessonsTouched)} />
              <Stat
                label="Effort"
                value={`${Math.round(digest.avgHumanEffortConfidence * 100)}%`}
              />
              <Stat label="Submitted" value={String(digest.submittedCount)} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ScorePanel
              title="Resilience"
              score={digest.resilienceScore}
              band={digest.resilienceBand}
              tone="emerald"
              themes={digest.themeCategories.resilience}
            />
            <ScorePanel
              title="Friction"
              score={digest.frictionScore}
              band={digest.frictionBand}
              tone="amber"
              themes={digest.themeCategories.friction}
            />
          </div>

          {digest.themes.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-300">
              {digest.themes.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function ScorePanel(props: {
  title: string;
  score: number;
  band: string;
  tone: "emerald" | "amber";
  themes: string[];
}) {
  const bar =
    props.tone === "emerald" ? "bg-emerald-500/80" : "bg-amber-500/80";
  return (
    <section className="rounded border border-zinc-800 bg-zinc-900/40 p-4 text-sm">
      <h2 className="text-xs uppercase tracking-wider text-zinc-500">{props.title}</h2>
      <p className="mt-1 text-2xl text-zinc-100">{props.score}</p>
      <p className="text-xs capitalize text-zinc-500">{props.band.replace(/_/g, " ")}</p>
      <div className="mt-2 h-2 overflow-hidden rounded bg-zinc-800">
        <div className={`h-full ${bar}`} style={{ width: `${props.score}%` }} />
      </div>
      <ul className="mt-3 space-y-1 text-xs text-zinc-400">
        {props.themes.length === 0 ? (
          <li>No themes yet</li>
        ) : (
          props.themes.map((t) => <li key={t}>{t}</li>)
        )}
      </ul>
    </section>
  );
}

function Stat(props: { label: string; value: string }) {
  return (
    <div className="rounded border border-zinc-800 px-2 py-2">
      <div className="text-[10px] uppercase text-zinc-500">{props.label}</div>
      <div className="text-zinc-100">{props.value}</div>
    </div>
  );
}
