"use client";

import type { HTMLAttributes } from "react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { cn } from "../lib/cn";

export type HalLatencyPoint = {
  /** ISO timestamp */
  at: string;
  /** Approximate p90 inter-key latency (ms) from ledger row. */
  p90_ms: number;
};

export type LoreBreachMarker = {
  id: string;
  severity: string;
  created_at: string;
  summary: string;
  excerpt: string;
  cosine_similarity: number | null;
};

export type ChapterHealth = {
  key: string;
  label: string;
  /** 0–100; higher = more internally consistent for editor prioritization. */
  consistency_health_score: number;
  lore_breach_count: number;
};

export type EditorSuggestion = {
  id: string;
  anchor_start: number;
  anchor_end: number;
  original_text: string;
  replacement_text: string;
  created_at: string;
  ledger_id?: string;
};

export type EditorForensicViewProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  supabase: SupabaseClient;
  manuscriptId: string;
  /** Full manuscript plain text (editor-visible body). */
  bodyText: string;
  /**
   * When set together with `forensicGateApiUrl`, HAL + lore data are loaded from the gated API
   * (e.g. `GET /api/editor/forensic-bundle`) so the server can return **403** without a fully signed NDA.
   */
  helperId?: string;
  forensicGateApiUrl?: string;
  /**
   * RBAC: `EDITOR` forces a read-only primary stream and enables the **suggestion layer** (POEE posts).
   * Other roles may edit only when `onBodyTextChange` is provided.
   */
  userRole?: string;
  /** Optional Bearer for BFF `POST .../editor-ledger/poee`. */
  getAccessToken?: () => string | null | Promise<string | null>;
  /** When provided and user is not locked as editor, manuscript body becomes editable (author lane). */
  onBodyTextChange?: (nextBodyText: string) => void;
  /** Called after a POEE row is persisted (local suggestion already appended). */
  onSuggestionRecorded?: (s: EditorSuggestion) => void;
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function authHeaders(accessToken: string | null | undefined): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const t = typeof accessToken === "string" ? accessToken.trim() : "";
  if (t) headers.Authorization = `Bearer ${t}`;
  return headers;
}

function p90ms(samples: number[]): number {
  const s = samples.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (s.length === 0) return 0;
  const idx = Math.min(s.length - 1, Math.max(0, Math.floor(0.9 * (s.length - 1))));
  return Math.round(s[idx]!);
}

function latencySamplesFromRow(raw: Record<string, unknown>): number[] {
  const primary = Array.isArray(raw["keystroke_latency_ms"])
    ? (raw["keystroke_latency_ms"] as unknown[]).map((n) => Number(n))
    : [];
  const rs = raw["raw_sample"];
  const rawSample = rs && typeof rs === "object" ? (rs as Record<string, unknown>) : null;
  const rawArr =
    rawSample && Array.isArray(rawSample["raw_keystroke_latency_ms"])
      ? (rawSample["raw_keystroke_latency_ms"] as unknown[]).map((n) => Number(n))
      : [];
  const merged = primary.length > 0 ? primary : rawArr;
  return merged.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
}

function manuscriptIdFromRawSample(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const mid = (raw as Record<string, unknown>)["manuscriptId"];
  return typeof mid === "string" && mid.trim() ? mid.trim() : null;
}

function splitIntoChapters(body: string): { key: string; label: string; text: string }[] {
  const t = body.replace(/\r\n/g, "\n");
  const byHeading = t.split(/\n(?=(#{1,6}\s+.+|Chapter\s+[\dIVX]+\b.+))\n?/i);
  if (byHeading.length > 1) {
    return byHeading.map((chunk, i) => {
      const firstLine = chunk.split("\n")[0] ?? `Section ${i + 1}`;
      const label = firstLine.replace(/^#+\s*/, "").trim().slice(0, 80) || `Section ${i + 1}`;
      return { key: `ch-${i}`, label, text: chunk };
    });
  }
  const words = t.split(/\s+/).filter(Boolean);
  const chunkSize = 4500;
  const out: { key: string; label: string; text: string }[] = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    const slice = words.slice(i, i + chunkSize).join(" ");
    const idx = Math.floor(i / chunkSize) + 1;
    out.push({ key: `block-${idx}`, label: `Segment ${idx} (~${chunkSize} words)`, text: slice });
  }
  return out.length ? out : [{ key: "full", label: "Full manuscript", text: t }];
}

function chapterIndexForExcerpt(chapters: { text: string }[], excerpt: string): number {
  const needle = excerpt.trim().slice(0, 120);
  if (!needle) return 0;
  for (let i = 0; i < chapters.length; i += 1) {
    if (chapters[i]!.text.includes(needle)) return i;
  }
  return 0;
}

function severityWeight(sev: string): number {
  const s = sev.toLowerCase();
  if (s === "critical") return 22;
  if (s === "warn") return 14;
  return 8;
}

/**
 * Editor workspace: HAL latency overlay on prose, lore-breach sidebar from `p4_revision_reports`,
 * and a per-chapter **Consistency Health** HUD (higher = fewer structural / canon issues in that slice).
 */
export function EditorForensicView({
  supabase,
  manuscriptId,
  bodyText,
  helperId,
  forensicGateApiUrl,
  userRole = "AUTHOR",
  getAccessToken,
  onBodyTextChange,
  onSuggestionRecorded,
  className,
  ...rest
}: EditorForensicViewProps) {
  const [halPoints, setHalPoints] = useState<HalLatencyPoint[]>([]);
  const [loreBreaches, setLoreBreaches] = useState<LoreBreachMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const halFillId = `halLatencyFill-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const [selection, setSelection] = useState<{ start: number; end: number; text: string }>({
    start: 0,
    end: 0,
    text: "",
  });
  const [replacementDraft, setReplacementDraft] = useState("");
  const [suggestions, setSuggestions] = useState<EditorSuggestion[]>([]);
  const [poeeErr, setPoeeErr] = useState<string | null>(null);
  const [poeePosting, setPoeePosting] = useState(false);

  const isEditor = (userRole ?? "AUTHOR").toUpperCase() === "EDITOR";
  const readOnlyPrimary = isEditor || !onBodyTextChange;

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const mid = manuscriptId.trim();
    const hid = helperId?.trim() ?? "";
    const gate = forensicGateApiUrl?.trim() ?? "";

    try {
      if (hid && gate) {
        const base = typeof window !== "undefined" ? window.location.origin : "http://localhost";
        const path = gate.startsWith("http") ? null : gate.startsWith("/") ? gate : `/${gate}`;
        const url = path == null ? new URL(gate) : new URL(path, base);
        url.searchParams.set("manuscript_id", mid);
        url.searchParams.set("helper_id", hid);

        const res = await fetch(url.toString(), { credentials: "include" });
        if (res.status === 403) {
          const j = (await res.json().catch(() => null)) as Record<string, unknown> | null;
          const msg =
            typeof j?.["error"] === "string"
              ? j["error"]
              : "403 Forbidden — a fully signed Sovereign NDA is required for this manuscript and helper.";
          throw new Error(msg);
        }
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || `Forensic gate HTTP ${res.status}`);
        }
        const bundle = (await res.json()) as Record<string, unknown>;
        const hp = bundle["hal_points"];
        const points: HalLatencyPoint[] = Array.isArray(hp)
          ? (hp as unknown[]).map((x) => {
              const o = asRecord(x);
              return { at: String(o["at"] ?? ""), p90_ms: Number(o["p90_ms"] ?? 0) };
            })
          : [];
        setHalPoints(points);

        const lb = bundle["lore_breaches"];
        const breaches: LoreBreachMarker[] = Array.isArray(lb)
          ? (lb as unknown[]).map((x) => {
              const r = asRecord(x);
              return {
                id: String(r["id"] ?? ""),
                severity: String(r["severity"] ?? "info"),
                created_at: String(r["created_at"] ?? ""),
                summary: String(r["summary"] ?? ""),
                excerpt: String(r["excerpt"] ?? "").slice(0, 600),
                cosine_similarity:
                  typeof r["cosine_similarity"] === "number" && Number.isFinite(r["cosine_similarity"])
                    ? (r["cosine_similarity"] as number)
                    : null,
              };
            })
          : [];
        setLoreBreaches(breaches);
        return;
      }

      const { data: halRows, error: hErr } = await supabase
        .from("p4_hal_ledger")
        .select("id, created_at, keystroke_latency_ms, raw_sample")
        .order("created_at", { ascending: true })
        .limit(200);

      if (hErr) throw new Error(hErr.message);

      const points: HalLatencyPoint[] = [];
      for (const row of halRows ?? []) {
        const o = row as Record<string, unknown>;
        const raw = o["raw_sample"];
        if (manuscriptIdFromRawSample(raw) !== mid) continue;
        const p90 = p90ms(latencySamplesFromRow(o));
        points.push({ at: String(o["created_at"] ?? ""), p90_ms: p90 });
      }
      setHalPoints(points);

      const { data: repRows, error: rErr } = await supabase
        .from("p4_revision_reports")
        .select("id, finding_type, severity, created_at, details, cosine_similarity")
        .eq("manuscript_id", mid)
        .order("created_at", { ascending: false })
        .limit(80);

      if (rErr) throw new Error(rErr.message);

      const breaches: LoreBreachMarker[] = [];
      for (const raw of repRows ?? []) {
        const r = raw as Record<string, unknown>;
        if (String(r["finding_type"] ?? "") !== "CANON_MANUSCRIPT_GAP") continue;
        const det = asRecord(r["details"]);
        const summary = typeof det["summary"] === "string" ? det["summary"] : "Lore / canon alignment gap";
        const excerpt = typeof det["excerpt"] === "string" ? det["excerpt"] : "";
        const cos = r["cosine_similarity"];
        breaches.push({
          id: String(r["id"] ?? ""),
          severity: String(r["severity"] ?? "info"),
          created_at: String(r["created_at"] ?? ""),
          summary,
          excerpt: excerpt.slice(0, 600),
          cosine_similarity: typeof cos === "number" && Number.isFinite(cos) ? cos : null,
        });
      }
      setLoreBreaches(breaches);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setHalPoints([]);
      setLoreBreaches([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, manuscriptId, helperId, forensicGateApiUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  const chapters = useMemo(() => splitIntoChapters(bodyText), [bodyText]);

  const chapterHealth: ChapterHealth[] = useMemo(() => {
    const breachHits = new Map<number, { count: number; penalty: number }>();
    for (const b of loreBreaches) {
      const needle = b.excerpt.trim().slice(0, Math.max(1, Math.min(120, b.excerpt.trim().length)));
      let idx = needle ? chapterIndexForExcerpt(chapters, needle) : 0;
      if (!needle || !chapters[idx]!.text.includes(needle)) {
        idx = chapterIndexForExcerpt(chapters, b.excerpt);
      }
      const row = breachHits.get(idx) ?? { count: 0, penalty: 0 };
      row.count += 1;
      row.penalty += severityWeight(b.severity);
      if (b.cosine_similarity != null) {
        row.penalty += Math.round((1 - Math.min(1, Math.max(0, b.cosine_similarity))) * 28);
      }
      breachHits.set(idx, row);
    }

    return chapters.map((ch, idx) => {
      const agg = breachHits.get(idx) ?? { count: 0, penalty: 0 };
      const score = Math.max(0, Math.min(100, Math.round(100 - agg.penalty)));
      return {
        key: ch.key,
        label: ch.label,
        consistency_health_score: score,
        lore_breach_count: agg.count,
      };
    });
  }, [chapters, loreBreaches]);

  const overlaySvg = useMemo(() => {
    if (halPoints.length < 2) return null;
    const w = 520;
    const h = 72;
    const pad = 6;
    const p90s = halPoints.map((p) => p.p90_ms);
    const max = Math.max(1, ...p90s);
    const pts = halPoints.map((p, i) => {
      const x = pad + (i / Math.max(1, halPoints.length - 1)) * (w - pad * 2);
      const y = pad + (1 - p.p90_ms / max) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const dLine = `M ${pts.join(" L ")}`;
    const dArea = `M ${pad},${h - pad} L ${pts.join(" L ")} L ${w - pad},${h - pad} Z`;
    return (
      <svg
        width="100%"
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        className="pointer-events-none absolute left-0 right-0 top-0 z-10 opacity-90"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id={halFillId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgb(34 197 94)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="rgb(34 197 94)" stopOpacity="0.04" />
          </linearGradient>
        </defs>
        <path d={dArea} fill={`url(#${halFillId})`} />
        <path d={dLine} fill="none" stroke="rgb(52 211 153)" strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
    );
  }, [halPoints, halFillId]);

  const captureSelection = useCallback(() => {
    const el = textRef.current;
    if (!el || !isEditor) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = bodyText.slice(start, end);
    setSelection({ start, end, text });
  }, [isEditor, bodyText]);

  const recordSuggestion = useCallback(async () => {
    if (!isEditor) return;
    const { start, end, text: original_text } = selection;
    if (end <= start || !original_text) {
      setPoeeErr("Highlight text in the manuscript stream first.");
      return;
    }
    setPoeeErr(null);
    setPoeePosting(true);
    const id =
      typeof globalThis !== "undefined" &&
      "crypto" in globalThis &&
      typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `sug_${Date.now()}`;
    try {
      const token = getAccessToken ? await getAccessToken() : null;
      const mid = manuscriptId.trim();
      const path = `/api/manuscripts/${encodeURIComponent(mid)}/editor-ledger/poee`;
      const url =
        typeof window !== "undefined" && window.location?.origin
          ? `${window.location.origin}${path}`
          : path;
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: authHeaders(token ?? undefined),
        body: JSON.stringify({
          suggestion: {
            id,
            anchor_start: start,
            anchor_end: end,
            original_text,
            replacement_text: replacementDraft,
          },
        }),
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : res.statusText);
      }
      const created = new Date().toISOString();
      const sug: EditorSuggestion = {
        id,
        anchor_start: start,
        anchor_end: end,
        original_text,
        replacement_text: replacementDraft,
        created_at: created,
        ledger_id: typeof json.ledger_id === "string" ? json.ledger_id : undefined,
      };
      setSuggestions((prev) => [sug, ...prev]);
      setReplacementDraft("");
      onSuggestionRecorded?.(sug);
    } catch (e) {
      setPoeeErr(e instanceof Error ? e.message : String(e));
    } finally {
      setPoeePosting(false);
    }
  }, [isEditor, selection, replacementDraft, manuscriptId, getAccessToken, onSuggestionRecorded]);

  return (
    <div className={cn("grid gap-4 lg:grid-cols-[minmax(0,1fr)_min(320px,34%)]", className)} {...rest}>
      <div className="space-y-3">
        <section
          className="rounded-xl border border-zinc-700/80 bg-zinc-950/80 p-3"
          aria-label="Consistency health by chapter"
        >
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Efficiency HUD — consistency health</h3>
          <p className="mt-1 text-[11px] text-zinc-500">
            Higher scores suggest fewer canon gaps tied to that slice. Prioritize low scores first.
          </p>
          {loading ? (
            <p className="mt-2 text-xs text-zinc-500">Loading forensic data…</p>
          ) : (
            <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto">
              {chapterHealth.map((c) => (
                <li key={c.key} className="flex items-center gap-2 text-xs">
                  <span className="min-w-0 flex-1 truncate font-medium text-zinc-200" title={c.label}>
                    {c.label}
                  </span>
                  <span className="shrink-0 font-mono text-zinc-400">{c.consistency_health_score}</span>
                  <span
                    className="h-2 shrink-0 rounded-full bg-zinc-800"
                    style={{ width: 96 }}
                    title={`${c.lore_breach_count} lore breach(es) attributed`}
                  >
                    <span
                      className={cn(
                        "block h-2 rounded-full",
                        c.consistency_health_score >= 70 ? "bg-emerald-500/90" : c.consistency_health_score >= 40 ? "bg-amber-500/90" : "bg-red-500/85"
                      )}
                      style={{ width: `${c.consistency_health_score}%` }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="relative rounded-xl border border-emerald-900/40 bg-zinc-950/90">
          <div className="relative border-b border-emerald-900/30 bg-emerald-950/20 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300/90">
              HAL latency trace (overlay — drafting rhythm vs. position in session timeline)
            </p>
            {overlaySvg}
          </div>
          {isEditor ? (
            <p className="border-b border-emerald-900/25 bg-emerald-950/15 px-3 py-2 text-[11px] leading-relaxed text-emerald-100/90">
              <span className="font-semibold text-emerald-50">Editor lane:</span> primary text stream is{" "}
              <span className="font-mono text-emerald-200">readOnly</span>. Use the suggestion layer to propose edits
              — each suggestion posts a <span className="font-mono text-emerald-200">POEE</span> row to{" "}
              <span className="font-mono text-emerald-200">p4_editor_ledger</span> (no direct body mutation).
            </p>
          ) : null}
          <textarea
            ref={textRef}
            readOnly={readOnlyPrimary}
            value={bodyText}
            onChange={readOnlyPrimary ? undefined : (e) => onBodyTextChange?.(e.target.value)}
            onMouseUp={isEditor ? captureSelection : undefined}
            onSelect={isEditor ? captureSelection : undefined}
            onKeyUp={isEditor ? captureSelection : undefined}
            spellCheck={false}
            className={cn(
              "max-h-[min(70vh,720px)] min-h-[240px] w-full resize-y whitespace-pre-wrap border-0 bg-transparent p-4 font-mono text-sm leading-relaxed text-zinc-200",
              "focus:outline-none focus:ring-2 focus:ring-emerald-600/35 focus:ring-inset",
              readOnlyPrimary && "cursor-text"
            )}
            aria-readonly={readOnlyPrimary || undefined}
            aria-label={isEditor ? "Manuscript text (read-only for editors)" : "Manuscript text"}
          />
          {isEditor ? (
            <div className="space-y-3 border-t border-sky-900/45 bg-sky-950/25 px-3 py-3">
              <h4 className="text-[10px] font-semibold uppercase tracking-wide text-sky-300/90">Suggestion layer</h4>
              <p className="text-[11px] text-sky-100/75">
                Selection: {selection.end > selection.start ? `${selection.start}–${selection.end}` : "—"} (
                {selection.text ? `${selection.text.length} chars` : "none"})
              </p>
              <label className="block space-y-1">
                <span className="text-[10px] uppercase tracking-wide text-sky-400/90">Replacement text</span>
                <textarea
                  value={replacementDraft}
                  onChange={(e) => setReplacementDraft(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-sky-800/60 bg-zinc-950/80 px-2 py-1.5 text-xs text-sky-50 placeholder:text-sky-700/80"
                  placeholder="Type the proposed replacement for the highlighted span…"
                />
              </label>
              {poeeErr ? (
                <p className="text-xs text-rose-400" role="alert">
                  {poeeErr}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={poeePosting || selection.end <= selection.start}
                  onClick={() => void recordSuggestion()}
                  className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {poeePosting ? "Recording POEE…" : "Record suggestion + POEE"}
                </button>
                <span className="text-[10px] text-sky-300/70">POST /api/manuscripts/…/editor-ledger/poee</span>
              </div>
              {suggestions.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Recorded suggestions</p>
                  <ul className="max-h-48 space-y-2 overflow-y-auto">
                    {suggestions.map((s) => (
                      <li
                        key={s.id}
                        className="rounded-md border border-zinc-700/80 bg-zinc-900/60 px-2 py-2 text-[11px] leading-relaxed text-zinc-200"
                      >
                        <span className="font-mono text-[10px] text-zinc-500">
                          {s.anchor_start}:{s.anchor_end}
                        </span>
                        <div className="mt-1">
                          <del className="text-rose-200/90 decoration-rose-400/90">{s.original_text || "∅"}</del>
                          <span className="mx-1 text-zinc-600">→</span>
                          <ins className="bg-amber-400/25 text-amber-50 no-underline">{s.replacement_text || "∅"}</ins>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <aside
        className="rounded-xl border border-rose-900/35 bg-rose-950/15 p-3 lg:max-h-[min(90vh,900px)] lg:overflow-y-auto"
        aria-label="Lore breach audit markers"
      >
        <h3 className="text-xs font-semibold uppercase tracking-wide text-rose-200/90">Audit markers — lore breaches</h3>
        <p className="mt-1 text-[11px] text-rose-200/60">
          From <span className="font-mono text-rose-100/80">p4_revision_reports</span> (CANON_MANUSCRIPT_GAP). Use as
          sidebar triage before line edits.
        </p>
        {err ? (
          <p
            className={cn(
              "mt-2 text-xs",
              err.includes("403") || err.toLowerCase().includes("forbidden") ? "text-red-300" : "text-red-400"
            )}
            role="alert"
          >
            {err}
          </p>
        ) : null}
        {!loading && loreBreaches.length === 0 ? (
          <p className="mt-3 text-xs text-zinc-500">No lore breach rows for this manuscript yet.</p>
        ) : null}
        <ul className="mt-3 space-y-3">
          {loreBreaches.map((b) => (
            <li key={b.id} className="rounded-lg border border-rose-800/40 bg-zinc-950/60 p-2 text-xs text-zinc-200">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                    b.severity === "critical"
                      ? "bg-red-950/80 text-red-200"
                      : b.severity === "warn"
                        ? "bg-amber-950/70 text-amber-100"
                        : "bg-zinc-800 text-zinc-300"
                  )}
                >
                  {b.severity}
                </span>
                <span className="text-[10px] text-zinc-500">{b.created_at.slice(0, 19)}</span>
              </div>
              <p className="mt-2 font-medium text-rose-50/95">{b.summary}</p>
              {b.cosine_similarity != null ? (
                <p className="mt-1 font-mono text-[10px] text-zinc-500">cosine_sim ≈ {b.cosine_similarity.toFixed(3)}</p>
              ) : null}
              {b.excerpt ? (
                <blockquote className="mt-2 border-l-2 border-rose-700/50 pl-2 text-[11px] leading-snug text-zinc-400">
                  {b.excerpt}
                </blockquote>
              ) : null}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
