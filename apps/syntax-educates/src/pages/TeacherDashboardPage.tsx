/**
 * Teacher dashboard — AI allowance regulator + Teacher Classroom Board (Publisher Hub lite).
 */
import { useCallback, useEffect, useState } from "react";

import { PillarBadge } from "@elphie-syntax/ui";

import { AI_ALLOWANCE_LEVELS, AI_ALLOWANCE_LEVEL_NAMES } from "@elphie-syntax/core";
import type { AiAllowanceLevel } from "@elphie-syntax/core";

const DEMO_ASSIGNMENT_ID = "00000000-0000-0000-0000-000000000abc";

type BoardSummary = {
  studentCount: number;
  draftingCount: number;
  milestoneCheckingCount: number;
  submittedCount: number;
  avgConfidence: number;
  pasteSpikeStudentCount: number;
  commonBottlenecks: Array<{ label: string; count: number }>;
  students: Array<{
    displayLabel: string;
    currentState: string;
    humanEffortConfidence: number;
    pasteEvents: number;
    pasteInjectionWarnings: number;
    activeWritingSeconds: number;
    stuck: boolean;
  }>;
};

export function TeacherDashboardPage() {
  const [assignmentId, setAssignmentId] = useState<string>(DEMO_ASSIGNMENT_ID);
  const [level, setLevel] = useState<AiAllowanceLevel>(3);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [board, setBoard] = useState<BoardSummary | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [boardLoading, setBoardLoading] = useState(false);

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

  const refreshBoard = useCallback(async () => {
    setBoardLoading(true);
    setBoardError(null);
    try {
      const res = await fetch(
        `/api/msgf/education/classroom-board?assignmentId=${encodeURIComponent(assignmentId)}`
      );
      if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText}`);
      }
      const json = (await res.json()) as { board?: BoardSummary };
      setBoard(json.board ?? null);
    } catch (e) {
      setBoardError(e instanceof Error ? e.message : String(e));
    } finally {
      setBoardLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    void refreshBoard();
  }, [refreshBoard]);

  return (
    <div className="px-6 py-6">
      <header className="mb-6 flex items-center gap-3">
        <PillarBadge lineageLabel="P1 · P2 · P6" pillar="P1" />
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
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm uppercase tracking-wider text-zinc-500">
            Teacher Classroom Board
          </h2>
          <button
            type="button"
            onClick={() => void refreshBoard()}
            className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300"
          >
            {boardLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        <p className="mb-3 text-xs text-zinc-500">
          Publisher Hub lite — cohort trends and paste spikes only. Raw student draft text is never
          shown.
        </p>

        {boardError && <p className="mb-2 text-xs text-rose-400">{boardError}</p>}

        {board && (
          <>
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Students" value={String(board.studentCount)} />
              <Stat label="Drafting" value={String(board.draftingCount)} />
              <Stat label="Milestone check" value={String(board.milestoneCheckingCount)} />
              <Stat label="Submitted" value={String(board.submittedCount)} />
              <Stat
                label="Avg effort"
                value={`${Math.round(board.avgConfidence * 100)}%`}
              />
              <Stat label="Paste spikes" value={String(board.pasteSpikeStudentCount)} />
            </div>

            {board.commonBottlenecks.length > 0 && (
              <div className="mb-4">
                <h3 className="mb-1 text-xs font-medium text-zinc-400">Common bottlenecks</h3>
                <ul className="space-y-1 text-sm text-zinc-300">
                  {board.commonBottlenecks.map((b) => (
                    <li key={b.label}>
                      {b.label}{" "}
                      <span className="text-zinc-500">×{b.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="overflow-x-auto rounded border border-zinc-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900 text-zinc-500">
                  <tr>
                    <th className="px-2 py-2">Student</th>
                    <th className="px-2 py-2">State</th>
                    <th className="px-2 py-2">Effort</th>
                    <th className="px-2 py-2">Pastes</th>
                    <th className="px-2 py-2">Writing</th>
                    <th className="px-2 py-2">Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {board.students.length === 0 ? (
                    <tr>
                      <td className="px-2 py-3 text-zinc-500" colSpan={6}>
                        No assignment instances yet — launch from Classroom to populate.
                      </td>
                    </tr>
                  ) : (
                    board.students.map((s) => (
                      <tr key={s.displayLabel} className="border-t border-zinc-800">
                        <td className="px-2 py-2">{s.displayLabel}</td>
                        <td className="px-2 py-2 text-zinc-400">{s.currentState}</td>
                        <td className="px-2 py-2">
                          {Math.round(s.humanEffortConfidence * 100)}%
                        </td>
                        <td className="px-2 py-2">
                          {s.pasteEvents}
                          {s.pasteInjectionWarnings > 0
                            ? ` (${s.pasteInjectionWarnings} inj)`
                            : ""}
                        </td>
                        <td className="px-2 py-2">
                          {Math.floor(s.activeWritingSeconds / 60)}m
                        </td>
                        <td className="px-2 py-2">
                          {s.stuck ? (
                            <span className="text-amber-300">stuck</span>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Stat(props: { label: string; value: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{props.label}</div>
      <div className="text-lg text-zinc-100">{props.value}</div>
    </div>
  );
}
