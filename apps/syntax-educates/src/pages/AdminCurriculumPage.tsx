/**
 * Tech Admin — upload school books by grade into the district curriculum catalog.
 */
import { useState } from "react";

import { PillarBadge } from "@elphie-syntax/ui";

import { msgfFetch } from "../lib/msgfClient";

const GRADE_BANDS = [
  { id: "k3", label: "K–3" },
  { id: "4_6", label: "4–6" },
  { id: "7_9", label: "7–9" },
  { id: "10_12", label: "10–12" },
  { id: "12_plus", label: "12+" },
  { id: "mixed", label: "Mixed" },
] as const;

const SUBJECTS = ["ela", "history", "math", "science", "general"] as const;

type IngestResult = {
  ok?: boolean;
  session_id?: string;
  layout?: unknown;
  catalog?: { id: string; title: string; grade_band?: string };
  error?: string;
};

export function AdminCurriculumPage() {
  const [title, setTitle] = useState("");
  const [publisher, setPublisher] = useState("");
  const [gradeBand, setGradeBand] = useState<(typeof GRADE_BANDS)[number]["id"]>("4_6");
  const [subject, setSubject] = useState<(typeof SUBJECTS)[number]>("science");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recs, setRecs] = useState<
    Array<{ id: string; title: string; recommendation?: { isRecommended: boolean; matchedKeywords: string[] } }>
  >([]);

  async function onFile(file: File | null) {
    if (!file) return;
    const body = await file.text();
    setText(body);
    if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ""));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const json = await msgfFetch<IngestResult>(
        "/api/msgf/education/admin/curriculum-ingest",
        {
          method: "POST",
          persona: "admin",
          body: JSON.stringify({
            text,
            tenant_id: "syntax_education",
            source_document: title || "curriculum-upload",
            catalog_title: title || "Curriculum upload",
            publisher: publisher || undefined,
            subject_domain: subject,
            grade_band: gradeBand,
            register_catalog: true,
            actor_role: "admin",
          }),
        }
      );
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function loadRecommendations() {
    setError(null);
    try {
      const json = await msgfFetch<{
        rows?: Array<{
          id: string;
          title: string;
          recommendation?: { isRecommended: boolean; matchedKeywords: string[] };
        }>;
      }>("/api/msgf/education/admin/curriculum-catalog", { persona: "admin" });
      setRecs((json.rows ?? []).filter((r) => r.recommendation?.isRecommended));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="px-6 py-6">
      <header className="mb-6 flex items-center gap-3">
        <PillarBadge lineageLabel="P1 · P6" pillar="P1" />
        <h1 className="text-xl font-semibold">Admin curriculum inventory</h1>
      </header>
      <p className="mb-4 max-w-2xl text-sm text-zinc-400">
        Upload school books by grade. Titles land in the district catalog so teachers can slice
        chapters into lessons. Friction hotspots can recommend titles below.
      </p>

      <div className="mb-4 grid max-w-2xl gap-3 sm:grid-cols-2">
        <label className="text-xs text-zinc-400">
          Book title
          <input
            className="mt-1 block w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="text-xs text-zinc-400">
          Publisher
          <input
            className="mt-1 block w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm"
            value={publisher}
            onChange={(e) => setPublisher(e.target.value)}
          />
        </label>
        <label className="text-xs text-zinc-400">
          Grade band
          <select
            className="mt-1 block w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm"
            value={gradeBand}
            onChange={(e) => setGradeBand(e.target.value as typeof gradeBand)}
          >
            {GRADE_BANDS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-zinc-400">
          Subject
          <select
            className="mt-1 block w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm"
            value={subject}
            onChange={(e) => setSubject(e.target.value as typeof subject)}
          >
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mb-3 block max-w-2xl text-xs text-zinc-400">
        Upload text / extracted PDF
        <input
          type="file"
          accept=".txt,.md,.text,.html"
          className="mt-1 block w-full text-sm"
          onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
        />
      </label>

      <textarea
        className="mb-3 h-48 w-full max-w-3xl rounded border border-zinc-800 bg-zinc-900 p-3 font-mono text-xs"
        placeholder="Paste curriculum text (Chapter 1… Section 1.1…) or load a file."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="mb-4">
        <button
          type="button"
          disabled={busy || text.trim().length < 40}
          onClick={() => void submit()}
          className="rounded border border-emerald-600 bg-emerald-600/20 px-4 py-2 text-sm text-emerald-200 disabled:opacity-40"
        >
          {busy ? "Ingesting…" : "Ingest + register catalog"}
        </button>
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}
      {result?.catalog && (
        <div className="max-w-2xl rounded border border-zinc-800 bg-zinc-900/50 p-3 text-sm">
          <p className="text-emerald-300">Catalog registered</p>
          <p className="text-zinc-300">{result.catalog.title}</p>
          <p className="font-mono text-xs text-zinc-500">{result.catalog.id}</p>
          <p className="mt-2 text-xs text-zinc-500">
            Session {result.session_id} — teachers can now slice this title in Lesson builder.
          </p>
        </div>
      )}

      <section className="mt-8 max-w-2xl">
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm uppercase tracking-wider text-zinc-500">
            Friction → recommended titles
          </h2>
          <button
            type="button"
            onClick={() => void loadRecommendations()}
            className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300"
          >
            Refresh recommends
          </button>
        </div>
        {recs.length === 0 ? (
          <p className="text-xs text-zinc-500">
            No recommended titles yet (needs friction hotspots + matching catalog keywords).
          </p>
        ) : (
          <ul className="space-y-2 text-sm text-zinc-300">
            {recs.map((r) => (
              <li key={r.id} className="rounded border border-sky-900/50 bg-sky-950/20 px-3 py-2">
                {r.title}
                <div className="text-xs text-zinc-500">
                  {(r.recommendation?.matchedKeywords ?? []).join(", ")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
