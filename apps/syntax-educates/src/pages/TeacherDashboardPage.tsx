/**
 * Teacher dashboard — LTI redirect target for `EducationLtiPersona === "teacher"`.
 * Minimal scaffold for now: surfaces the AI allowance regulator (Layer B) so a teacher
 * can adjust an assignment's Socratic sidebar level live, and previews the cohort heat
 * map that the Phase 2 parent / teacher rollups will feed.
 *
 * See pillars §2.1.2 (Layer B regulator) and ROADMAP Phase 2 "Teacher friction heat map".
 */
import { useState } from "react";

import { PillarBadge } from "@elphie-syntax/ui";

import { AI_ALLOWANCE_LEVELS, AI_ALLOWANCE_LEVEL_NAMES } from "@elphie-syntax/core";
import type { AiAllowanceLevel } from "@elphie-syntax/core";

const DEMO_ASSIGNMENT_ID = "00000000-0000-0000-0000-000000000abc";

export function TeacherDashboardPage() {
  const [assignmentId, setAssignmentId] = useState<string>(DEMO_ASSIGNMENT_ID);
  const [level, setLevel] = useState<AiAllowanceLevel>(3);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pushAllowance(next: AiAllowanceLevel) {
    setLevel(next);
    setError(null);
    try {
      const res = await fetch("/api/education/workspace/allowance", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assignmentId, aiAllowanceLevel: next }),
      });
      if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText}`);
      }
      const json = (await res.json()) as { ok?: boolean };
      setLastUpdate(json.ok ? new Date().toISOString() : "no-ack");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="px-6 py-6">
      <header className="mb-6 flex items-center gap-3">
        <PillarBadge lineageLabel="P1 · P2" pillar="P1" />
        <h1 className="text-xl font-semibold">Teacher dashboard</h1>
      </header>

      <section className="mb-6">
        <h2 className="mb-2 text-sm uppercase tracking-wider text-zinc-500">
          AI allowance regulator (Layer B)
        </h2>
        <label className="mb-2 block text-xs text-zinc-400">
          Assignment ID
          <input
            type="text"
            value={assignmentId}
            onChange={(e) => setAssignmentId(e.target.value)}
            className="mt-1 block w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm"
          />
        </label>

        <div className="grid grid-cols-5 gap-2">
          {AI_ALLOWANCE_LEVELS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => pushAllowance(n)}
              className={
                "rounded border px-3 py-2 text-left text-sm " +
                (n === level
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-200"
                  : "border-zinc-800 bg-zinc-900 text-zinc-300")
              }
            >
              <div className="text-xs text-zinc-500">Level {n}</div>
              <div>{AI_ALLOWANCE_LEVEL_NAMES[n]}</div>
            </button>
          ))}
        </div>

        {lastUpdate && (
          <p className="mt-2 text-xs text-zinc-500">Last update acknowledged at {lastUpdate}</p>
        )}
        {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
      </section>

      <section>
        <h2 className="mb-2 text-sm uppercase tracking-wider text-zinc-500">
          Cohort heat map (Phase 2)
        </h2>
        <p className="text-sm text-zinc-400">
          Rollups will surface here from <code>P6</code> aggregates over <code>P4</code> telemetry —
          including external `ecosystem_source` (Google / Microsoft) and Citation Hall incidents
          (<code>3.1.2_UNATTRIBUTED_SOURCE_STRING</code>).
        </p>
      </section>
    </div>
  );
}
