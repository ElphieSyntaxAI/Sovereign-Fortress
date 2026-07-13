/**
 * Student workspace — disclosure → optional reading gate → Layer A/B canvas.
 */
import { useMemo, useState } from "react";

import { WorkspaceCanvas, type ResourceReaderPayload } from "@elphie-syntax/ui";

import { UtahDisclosureGate } from "../components/UtahDisclosureGate";

const DEMO_ASSIGNMENT = "00000000-0000-4000-8000-0000000000ed";
const DEMO_RESOURCE_CONTEXT = "00000000-0000-4000-8000-0000000000rc";
const API_BASE =
  import.meta.env.VITE_MSGF_API_URL?.trim() ||
  import.meta.env.VITE_MSGF_APP_URL?.trim() ||
  "http://127.0.0.1:3001";

export function SandboxPage() {
  const [gradeCohort, setGradeCohort] = useState<string>("4_6");
  const [aiLevel, setAiLevel] = useState<0 | 1 | 2 | 3 | 4>(3);
  const [disclosureOk, setDisclosureOk] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [gateAck, setGateAck] = useState<string | null>(null);

  const entityToken = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return (
      params.get("entityToken") ||
      window.localStorage.getItem("edu_entity_token") ||
      "tok_anon_stu_demo4th01"
    );
  }, []);

  const assignmentId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("assignmentId") || DEMO_ASSIGNMENT;
  }, []);

  const assignmentInstanceId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("assignmentInstanceId") || undefined;
  }, []);

  const requireReading = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("requireReading") === "1";
  }, []);

  const resourceContextId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("resourceContextId") || DEMO_RESOURCE_CONTEXT;
  }, []);

  const demoResource: ResourceReaderPayload | undefined = requireReading
    ? {
        resourceContextId,
        catalogId: "00000000-0000-4000-8000-0000000000ca",
        title: "Demo Science Workbook — Ecosystems (Grade 4)",
        publisher: "Syntax Educates Demo",
        signedDeepLink: "about:blank",
        sourceType: "local_pdf",
        pageStart: 1,
        pageEnd: 2,
        requireReadingBlock: true,
        // Short for local UX demos; production uses teacher-configured min_focus_block_ms.
        minFocusBlockMs: 5_000,
      }
    : undefined;

  async function patchAllowance(level: 0 | 1 | 2 | 3 | 4) {
    setAiLevel(level);
    await fetch(`${API_BASE}/api/education/workspace/allowance`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignmentId,
        aiAllowanceLevel: level,
      }),
    });
  }

  async function onReadingGateSatisfied(info: {
    focusBlockMs: number;
    resourceContextId: string;
  }) {
    try {
      const res = await fetch(`${API_BASE}/api/msgf/education/student/reading-gate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-msgf-entity-id": entityToken,
          "x-msgf-tenant-id": "syntax_education",
        },
        body: JSON.stringify({
          resourceContextId: info.resourceContextId,
          focusBlockMs: info.focusBlockMs,
          surface: "sandbox_reader",
        }),
        credentials: "include",
      });
      const json = (await res.json().catch(() => ({}))) as {
        gateSatisfied?: boolean;
        error?: string;
      };
      if (res.ok && json.gateSatisfied) {
        setGateAck(`Reading gate satisfied (${info.focusBlockMs} ms focus)`);
      } else {
        // Local unlock already happened in the canvas; server may need real resource row.
        setGateAck(
          `Reading focus met locally (${info.focusBlockMs} ms). Server: ${
            json.error || res.status
          }`
        );
      }
    } catch (e) {
      setGateAck(
        `Reading focus met locally (${info.focusBlockMs} ms). ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }
  }

  if (declined) {
    return (
      <div className="mx-auto max-w-xl p-8 text-center text-zinc-300">
        <h1 className="mb-2 text-xl font-semibold">Session closed</h1>
        <p className="text-sm text-zinc-500">
          You declined the Utah AI disclosure. AI tools and authenticity checks will not run.
          Ask your teacher if you need another path.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Student workspace</h1>
          <p className="text-sm text-zinc-500">
            Disclosure → optional reading gate → Layer A tools · Layer B tutor
          </p>
          {requireReading && (
            <p className="mt-1 text-xs text-amber-300/90">
              Reading dependency on — composition unlocks after focus. (?requireReading=1)
            </p>
          )}
          {gateAck && <p className="mt-1 text-xs text-emerald-400">{gateAck}</p>}
        </div>
        {disclosureOk && (
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
        )}
      </header>

      {!disclosureOk ? (
        <UtahDisclosureGate
          entityToken={entityToken}
          assignmentInstanceId={assignmentInstanceId}
          assignmentId={assignmentId}
          onAccepted={() => setDisclosureOk(true)}
          onDeclined={() => setDeclined(true)}
        />
      ) : (
        <WorkspaceCanvas
          key={`${gradeCohort}:${requireReading ? "rg" : "open"}`}
          assignmentId={assignmentId}
          gradeCohort={gradeCohort}
          initialAiAllowanceLevel={aiLevel}
          apiBase={API_BASE}
          resource={demoResource}
          onReadingGateSatisfied={
            requireReading ? (info) => void onReadingGateSatisfied(info) : undefined
          }
        />
      )}
    </div>
  );
}
