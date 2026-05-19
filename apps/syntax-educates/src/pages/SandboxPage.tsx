import { useState } from "react";

import { WorkspaceCanvas } from "@elphie-syntax/ui";

const DEMO_ASSIGNMENT = "00000000-0000-4000-8000-000000000001";
const API_BASE =
  import.meta.env.VITE_MSGF_API_URL?.trim() || "http://127.0.0.1:3000";

export function SandboxPage() {
  const [gradeCohort, setGradeCohort] = useState<string>("7_9");
  const [aiLevel, setAiLevel] = useState<0 | 1 | 2 | 3 | 4>(3);

  async function patchAllowance(level: 0 | 1 | 2 | 3 | 4) {
    setAiLevel(level);
    await fetch(`${API_BASE}/api/education/workspace/allowance`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignmentId: DEMO_ASSIGNMENT,
        aiAllowanceLevel: level,
      }),
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Socratic Sandbox</h1>
          <p className="text-sm text-zinc-500">
            Layer A locked to grade cohort · Layer B updates via SSE
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="text-xs text-zinc-400">
            Cohort
            <select
              className="ml-2 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200"
              value={gradeCohort}
              onChange={(e) => setGradeCohort(e.target.value)}
            >
              <option value="k3">K–3</option>
              <option value="4_6">4–6</option>
              <option value="7_9">7–9</option>
              <option value="10_12">10–12</option>
              <option value="12_plus">12+</option>
            </select>
          </label>
          <label className="text-xs text-zinc-400">
            AI level (teacher)
            <select
              className="ml-2 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200"
              value={aiLevel}
              onChange={(e) =>
                patchAllowance(Number(e.target.value) as 0 | 1 | 2 | 3 | 4)
              }
            >
              {[0, 1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <WorkspaceCanvas
        key={gradeCohort}
        assignmentId={DEMO_ASSIGNMENT}
        gradeCohort={gradeCohort}
        initialAiAllowanceLevel={aiLevel}
        apiBase={API_BASE}
      />
    </div>
  );
}
