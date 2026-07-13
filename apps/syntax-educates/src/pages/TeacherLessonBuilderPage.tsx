/**
 * Teacher lesson builder — pick grade-banded catalog slice + milestone + allowance.
 */
import { useCallback, useEffect, useState } from "react";

import {
  CurriculumTreePicker,
  PillarBadge,
  type AssignmentResourceSlice,
  type CurriculumLayout,
} from "@elphie-syntax/ui";

import { AI_ALLOWANCE_LEVELS, AI_ALLOWANCE_LEVEL_NAMES } from "@elphie-syntax/core";
import type { AiAllowanceLevel } from "@elphie-syntax/core";

import { msgfBaseUrl, msgfFetch } from "../lib/msgfClient";

const MILESTONES = [
  { id: "science_cer", label: "Science CER" },
  { id: "ela_outline", label: "ELA outline" },
  { id: "explain_solution", label: "Explain solution" },
  { id: "lab_report", label: "Lab report" },
  { id: "generic_sections", label: "Generic sections" },
] as const;

type CatalogRow = {
  id: string;
  title: string;
  subject_domain: string;
  grade_band?: string;
  layout: CurriculumLayout;
};

type LessonRow = {
  id: string;
  title: string;
  milestone_template_id: string;
  ai_allowance_level: number;
  resource_context_id: string | null;
  grade_band: string;
};

export function TeacherLessonBuilderPage() {
  const [gradeBand, setGradeBand] = useState("4_6");
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [slice, setSlice] = useState<AssignmentResourceSlice>({
    unitIds: [],
    chapterIds: [],
    sectionIds: [],
  });
  const [title, setTitle] = useState("");
  const [milestone, setMilestone] =
    useState<(typeof MILESTONES)[number]["id"]>("science_cer");
  const [allowance, setAllowance] = useState<AiAllowanceLevel>(3);
  const [requireReading, setRequireReading] = useState(true);
  const [courseId, setCourseId] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    assignmentId: string;
    resourceContextId: string;
  } | null>(null);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [busy, setBusy] = useState(false);

  const selected = catalog.find((c) => c.id === selectedId) ?? null;

  const loadCatalog = useCallback(async () => {
    setError(null);
    try {
      const json = await msgfFetch<{ rows?: CatalogRow[] }>(
        `/api/msgf/education/teacher/curriculum-catalog?gradeBand=${encodeURIComponent(gradeBand)}`,
        { persona: "teacher" }
      );
      setCatalog(json.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [gradeBand]);

  const loadLessons = useCallback(async () => {
    try {
      const json = await msgfFetch<{ lessons?: LessonRow[] }>(
        "/api/msgf/education/teacher/lessons",
        { persona: "teacher" }
      );
      setLessons(json.lessons ?? []);
    } catch {
      /* optional */
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
    void loadLessons();
  }, [loadCatalog, loadLessons]);

  async function createLesson() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    setCreated(null);
    try {
      const json = await msgfFetch<{
        assignmentId: string;
        resourceContextId: string;
      }>("/api/msgf/education/teacher/lessons", {
        method: "POST",
        persona: "teacher",
        body: JSON.stringify({
          title: title || `${selected.title} lesson`,
          catalogId: selected.id,
          slice,
          milestoneTemplateId: milestone,
          aiAllowanceLevel: allowance,
          requireReadingBlock: requireReading,
          classroomCourseId: courseId || null,
          googleDocTemplateUrl: docUrl || null,
          subjectDomain: selected.subject_domain,
          gradeBand: selected.grade_band || gradeBand,
        }),
      });
      setCreated({
        assignmentId: json.assignmentId,
        resourceContextId: json.resourceContextId,
      });
      await loadLessons();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const classroomStartUrl = created
    ? `${msgfBaseUrl()}/api/education/classroom/oauth/start?assignmentId=${encodeURIComponent(
        created.assignmentId
      )}&resourceContextId=${encodeURIComponent(created.resourceContextId)}&courseId=${encodeURIComponent(
        courseId || "demo-course"
      )}&milestoneTemplateId=${encodeURIComponent(milestone)}&gradeBand=${encodeURIComponent(
        gradeBand
      )}`
    : null;

  return (
    <div className="px-6 py-6">
      <header className="mb-6 flex items-center gap-3">
        <PillarBadge lineageLabel="P1 · P2" pillar="P2" />
        <h1 className="text-xl font-semibold">Lesson builder</h1>
      </header>

      <section className="mb-6 max-w-3xl">
        <label className="mb-2 block text-xs text-zinc-400">
          Filter catalog by grade
          <select
            className="mt-1 block w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm"
            value={gradeBand}
            onChange={(e) => setGradeBand(e.target.value)}
          >
            <option value="4_6">4–6</option>
            <option value="7_9">7–9</option>
            <option value="10_12">10–12</option>
            <option value="k3">K–3</option>
            <option value="mixed">Mixed</option>
          </select>
        </label>

        <label className="mb-2 block text-xs text-zinc-400">
          School book
          <select
            className="mt-1 block w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">Select a catalog title…</option>
            {catalog.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} ({c.subject_domain}
                {c.grade_band ? ` · ${c.grade_band}` : ""})
              </option>
            ))}
          </select>
        </label>

        {selected && (
          <div className="mb-4 rounded border border-zinc-800 p-3">
            <CurriculumTreePicker
              layout={selected.layout ?? []}
              titleLabel={selected.title}
              onChange={setSlice}
            />
          </div>
        )}

        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-zinc-400">
            Lesson title
            <input
              className="mt-1 block w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="text-xs text-zinc-400">
            Milestone template
            <select
              className="mt-1 block w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm"
              value={milestone}
              onChange={(e) => setMilestone(e.target.value as typeof milestone)}
            >
              {MILESTONES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-zinc-400">
            Classroom course ID (optional)
            <input
              className="mt-1 block w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            />
          </label>
          <label className="text-xs text-zinc-400">
            Google Doc template URL (optional)
            <input
              className="mt-1 block w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm"
              value={docUrl}
              onChange={(e) => setDocUrl(e.target.value)}
              placeholder="https://docs.google.com/document/d/…"
            />
          </label>
        </div>

        <div className="mb-3">
          <p className="mb-1 text-xs uppercase tracking-wider text-zinc-500">AI allowance</p>
          <div className="grid grid-cols-5 gap-2">
            {AI_ALLOWANCE_LEVELS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setAllowance(n)}
                className={
                  "rounded border px-2 py-2 text-left text-xs " +
                  (n === allowance
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-200"
                    : "border-zinc-800 bg-zinc-900 text-zinc-400")
                }
              >
                L{n} {AI_ALLOWANCE_LEVEL_NAMES[n]}
              </button>
            ))}
          </div>
        </div>

        <label className="mb-4 flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={requireReading}
            onChange={(e) => setRequireReading(e.target.checked)}
          />
          Require reading gate before writing
        </label>

        <button
          type="button"
          disabled={busy || !selected}
          onClick={() => void createLesson()}
          className="rounded border border-emerald-600 bg-emerald-600/20 px-4 py-2 text-sm text-emerald-200 disabled:opacity-40"
        >
          {busy ? "Creating…" : "Create lesson"}
        </button>

        {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}

        {created && (
          <div className="mt-4 rounded border border-zinc-800 bg-zinc-900/60 p-3 text-sm">
            <p className="text-emerald-300">Lesson ready</p>
            <p className="font-mono text-xs text-zinc-400">
              assignment {created.assignmentId}
            </p>
            <p className="font-mono text-xs text-zinc-500">
              resource {created.resourceContextId}
            </p>
            {classroomStartUrl && (
              <a
                className="mt-2 inline-block text-sm text-sky-300 underline"
                href={classroomStartUrl}
              >
                Open Google Classroom student launch (OAuth)
              </a>
            )}
            <button
              type="button"
              className="mt-2 block text-sm text-sky-300 underline"
              onClick={() => {
                void (async () => {
                  try {
                    const mock = await msgfFetch<{ sandboxUrl?: string }>(
                      "/api/education/classroom/mock-launch",
                      {
                        method: "POST",
                        body: JSON.stringify({
                          assignmentId: created.assignmentId,
                          resourceContextId: created.resourceContextId,
                          courseId: courseId || "demo-course",
                          acceptDisclosure: true,
                        }),
                      }
                    );
                    if (mock.sandboxUrl) {
                      window.open(mock.sandboxUrl, "_blank");
                    }
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                  }
                })();
              }}
            >
              QA: mock Classroom launch (new tab)
            </button>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm uppercase tracking-wider text-zinc-500">Recent lessons</h2>
        <ul className="space-y-1 text-sm text-zinc-300">
          {lessons.length === 0 && (
            <li className="text-zinc-500">No lessons yet.</li>
          )}
          {lessons.map((l) => (
            <li key={l.id} className="rounded border border-zinc-900 px-2 py-1">
              {l.title}{" "}
              <span className="text-zinc-500">
                · {l.milestone_template_id} · L{l.ai_allowance_level} · {l.grade_band}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
