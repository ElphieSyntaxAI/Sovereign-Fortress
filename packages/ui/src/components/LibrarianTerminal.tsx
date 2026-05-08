"use client";

import type { HTMLAttributes, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "../lib/cn";
import type { LibrarianLanguageCode, LibrarianRetrievedChunk } from "../lib/librarianApiTypes";
import { postHalSession, postLibrarianAsk } from "../lib/librarianClient";
import { librarianT } from "../lib/librarianLocaleStrings";
import {
  classifyLibrarianBulletLine,
  extractChunkIdFromLibrarianLine,
  stripLeadingBulletMarkers,
} from "../lib/librarianBulletKind";

export type { LibrarianLanguageCode, LibrarianRetrievedChunk } from "../lib/librarianApiTypes";

const LANG_TOGGLE: Record<
  LibrarianLanguageCode,
  { flag: string; label: string; aria: string }
> = {
  en: { flag: "🇺🇸", label: "EN", aria: "English" },
  es: { flag: "🇪🇸", label: "ES", aria: "Spanish" },
  ja: { flag: "🇯🇵", label: "JA", aria: "Japanese" },
};

const RHYTHM_CAP = 36;
const HAL_DEBOUNCE_MS = 520;
const IME_NORMALIZE_FLASH_MS = 1100;

function pickBestSourceChunk(chunks: LibrarianRetrievedChunk[]): LibrarianRetrievedChunk | null {
  if (chunks.length === 0) return null;
  const scored = [...chunks].sort(
    (a, b) => (b.cosine_similarity ?? 0) - (a.cosine_similarity ?? 0)
  );
  return scored[0] ?? null;
}

function RhythmSparkline({
  samples,
  uiLocale,
  composing,
  normalizeGlow,
  serverIme,
  title,
  hintHold,
  hintNorm,
  hintServer,
}: {
  samples: number[];
  uiLocale: LibrarianLanguageCode;
  composing: boolean;
  normalizeGlow: boolean;
  serverIme: boolean;
  title: string;
  hintHold: string;
  hintNorm: string;
  hintServer: string;
}) {
  const w = 128;
  const h = 32;
  const pad = 2;
  const flashOn = uiLocale === "ja" && normalizeGlow;
  const max = Math.max(48, ...samples, 1);
  const pts = samples.length
    ? samples.map((v, i) => {
        const x = pad + (i / Math.max(1, samples.length - 1)) * (w - pad * 2);
        const nh = Math.min(1, v / max);
        const y = pad + (1 - nh) * (h - pad * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
    : [`${pad},${h / 2}`, `${w - pad},${h / 2}`];

  const stroke =
    uiLocale === "ja" && composing
      ? "rgb(251 191 36)"
      : flashOn
        ? "rgb(52 211 153)"
        : serverIme
          ? "rgb(94 234 212)"
          : "rgb(113 113 122)";

  const hint =
    serverIme && uiLocale === "ja"
      ? hintServer
      : uiLocale === "ja" && composing
        ? hintHold
        : uiLocale === "ja" && flashOn
          ? hintNorm
          : null;

  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-2 py-1.5"
      title={title}
    >
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </span>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0 overflow-visible" aria-hidden>
        <polyline
          fill="none"
          stroke={stroke}
          strokeWidth={flashOn ? 2.25 : 1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={pts.join(" ")}
        />
        {uiLocale === "ja" && composing && (
          <circle cx={w - 6} cy={6} r={3} fill="rgb(251 191 36)" className="animate-pulse" />
        )}
        {uiLocale === "ja" && flashOn && !composing && (
          <circle cx={w - 6} cy={6} r={3} fill="rgb(52 211 153)" opacity={0.95} />
        )}
      </svg>
      {hint ? (
        <span className="min-w-0 truncate text-[10px] leading-tight text-emerald-300/90">{hint}</span>
      ) : null}
    </div>
  );
}

export type LibrarianTerminalProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  /** When set, shows composer and calls `POST /api/librarian/ask` (server `LibrarianChat.ask`). */
  tenantId?: string;
  apiBaseUrl?: string;
  audience?: "fan" | "author";
  tenantScope?: "author" | "school";
  /** UI strings + `language` override on librarian ask + `locale` on HAL. */
  initialUiLocale?: LibrarianLanguageCode;
  onLocaleChange?: (locale: LibrarianLanguageCode) => void;
  /** Debounced `POST /api/hal/session` with `locale`, keystroke latencies, and IME flags. */
  halManuscript?: {
    manuscriptId: string;
    authorUserId?: string;
    debounceMs?: number;
  };
  /**
   * Display / controlled answer. When `tenantId` is set, these seed state and update after each ask.
   * When `tenantId` is omitted, `answer`, `detectedLanguage`, and `retrievedChunks` should be provided.
   */
  answer?: string;
  detectedLanguage?: LibrarianLanguageCode;
  retrievedChunks?: LibrarianRetrievedChunk[];
  canonChunkByCanonIndex?: LibrarianRetrievedChunk[];
  resolveCanonChunk?: (args: {
    line: string;
    strippedLine: string;
    canonBulletIndex: number;
  }) => LibrarianRetrievedChunk | null | undefined;
};

export function LibrarianTerminal({
  tenantId,
  apiBaseUrl = "",
  audience = "author",
  tenantScope = "author",
  initialUiLocale,
  onLocaleChange,
  halManuscript,
  answer: answerProp,
  detectedLanguage: detectedProp,
  retrievedChunks: chunksProp,
  canonChunkByCanonIndex,
  resolveCanonChunk,
  className,
  ...rest
}: LibrarianTerminalProps) {
  const interactive = Boolean(tenantId?.trim());

  const [uiLocale, setUiLocale] = useState<LibrarianLanguageCode>(
    initialUiLocale ?? detectedProp ?? "en"
  );
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveAnswer, setLiveAnswer] = useState(answerProp ?? "");
  const [liveDetected, setLiveDetected] = useState<LibrarianLanguageCode>(detectedProp ?? "en");
  const [liveChunks, setLiveChunks] = useState<LibrarianRetrievedChunk[]>(chunksProp ?? []);

  const [rhythmSamples, setRhythmSamples] = useState<number[]>([]);
  const [composing, setComposing] = useState(false);
  const [normalizeGlow, setNormalizeGlow] = useState(false);
  const normalizeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lastHalIme, setLastHalIme] = useState(false);

  const lastKeyTs = useRef<number | null>(null);
  const latenciesRef = useRef<number[]>([]);
  const halTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const composingRef = useRef(false);

  const answer = interactive ? liveAnswer : (answerProp ?? "");
  const detectedLanguage = interactive ? liveDetected : (detectedProp ?? "en");
  const retrievedChunks = interactive ? liveChunks : (chunksProp ?? []);

  useEffect(() => {
    if (!interactive) return;
    if (answerProp !== undefined) setLiveAnswer(answerProp);
  }, [answerProp, interactive]);

  useEffect(() => {
    if (!interactive) return;
    if (detectedProp) setLiveDetected(detectedProp);
  }, [detectedProp, interactive]);

  useEffect(() => {
    if (!interactive) return;
    if (chunksProp) setLiveChunks(chunksProp);
  }, [chunksProp, interactive]);

  const scheduleHal = useCallback(() => {
    if (!interactive || !tenantId || !halManuscript?.manuscriptId) return;
    const debounce = halManuscript.debounceMs ?? HAL_DEBOUNCE_MS;
    if (halTimer.current) clearTimeout(halTimer.current);
    halTimer.current = setTimeout(() => {
      halTimer.current = null;
      void (async () => {
        try {
          const res = await postHalSession(
            {
              tenantId,
              manuscriptId: halManuscript.manuscriptId,
              keystrokeLatencies: [...latenciesRef.current],
              contentDelta: question.slice(-6000),
              locale: uiLocale,
              isImeSession: composingRef.current,
              authorUserId: halManuscript.authorUserId,
            },
            { baseUrl: apiBaseUrl }
          );
          setLastHalIme(Boolean(res.is_ime_session));
        } catch {
          /* debounced telemetry — avoid surfacing transient HAL errors in the librarian UI */
        }
      })();
    }, debounce);
  }, [
    apiBaseUrl,
    halManuscript?.authorUserId,
    halManuscript?.debounceMs,
    halManuscript?.manuscriptId,
    interactive,
    question,
    tenantId,
    uiLocale,
  ]);

  const pushLatencySample = useCallback(
    (dt: number) => {
      if (!Number.isFinite(dt) || dt <= 0 || dt > 60_000) return;
      const next = [...latenciesRef.current, Math.round(dt)].slice(-RHYTHM_CAP);
      latenciesRef.current = next;
      setRhythmSamples(next);
      scheduleHal();
    },
    [scheduleHal]
  );

  const onTextareaKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (e.nativeEvent.isComposing || e.key === "Enter") return;
      if (e.repeat) return;
      const now = performance.now();
      const prev = lastKeyTs.current;
      lastKeyTs.current = now;
      if (prev != null) pushLatencySample(now - prev);
    },
    [pushLatencySample]
  );

  const onCompositionStart = useCallback(() => {
    composingRef.current = true;
    setComposing(true);
    scheduleHal();
  }, [scheduleHal]);

  const onCompositionEnd = useCallback(() => {
    composingRef.current = false;
    setComposing(false);
    if (uiLocale === "ja") {
      if (normalizeTimer.current) clearTimeout(normalizeTimer.current);
      setNormalizeGlow(true);
      normalizeTimer.current = setTimeout(() => {
        normalizeTimer.current = null;
        setNormalizeGlow(false);
      }, IME_NORMALIZE_FLASH_MS);
    }
    scheduleHal();
  }, [scheduleHal, uiLocale]);

  const setLocale = useCallback(
    (next: LibrarianLanguageCode) => {
      setUiLocale(next);
      onLocaleChange?.(next);
      scheduleHal();
    },
    [onLocaleChange, scheduleHal]
  );

  useEffect(
    () => () => {
      if (halTimer.current) clearTimeout(halTimer.current);
      if (normalizeTimer.current) clearTimeout(normalizeTimer.current);
    },
    []
  );

  const submitAsk = useCallback(async () => {
    if (!interactive || !tenantId) return;
    const q = question.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const res = await postLibrarianAsk(
        {
          tenantId,
          question: q,
          audience,
          tenantScope,
          language: uiLocale,
        },
        { baseUrl: apiBaseUrl }
      );
      setLiveAnswer(res.answer);
      setLiveDetected(res.detectedLanguage);
      setLiveChunks(res.retrievedChunks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, audience, interactive, question, tenantId, tenantScope, uiLocale]);

  const lines = useMemo(() => answer.split(/\r?\n/), [answer]);
  const hasAnswerText = useMemo(() => lines.some((l) => l.trim().length > 0), [lines]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedChunk, setSelectedChunk] = useState<LibrarianRetrievedChunk | null>(null);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedChunk(null);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, closeDrawer]);

  const openSourceForCanonLine = useCallback(
    (line: string, canonBulletIndex: number) => {
      const stripped = stripLeadingBulletMarkers(line);
      const fromId = extractChunkIdFromLibrarianLine(line);
      if (fromId) {
        const hit = retrievedChunks.find((c) => c.id.toLowerCase() === fromId);
        if (hit) {
          setSelectedChunk(hit);
          setDrawerOpen(true);
          return;
        }
      }

      const resolved = resolveCanonChunk?.({ line, strippedLine: stripped, canonBulletIndex });
      if (resolved) {
        setSelectedChunk(resolved);
        setDrawerOpen(true);
        return;
      }

      const mapped = canonChunkByCanonIndex?.[canonBulletIndex];
      if (mapped) {
        setSelectedChunk(mapped);
        setDrawerOpen(true);
        return;
      }

      const best = pickBestSourceChunk(retrievedChunks);
      if (best) {
        setSelectedChunk(best);
        setDrawerOpen(true);
      }
    },
    [canonChunkByCanonIndex, resolveCanonChunk, retrievedChunks]
  );

  const detectedBadge = LANG_TOGGLE[detectedLanguage] ?? LANG_TOGGLE.en;
  const t = (key: Parameters<typeof librarianT>[1]) => librarianT(uiLocale, key);

  return (
    <div className={cn("relative", className)} {...rest}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{t("title")}</span>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-zinc-600">{t("localeLabel")}</span>
          <div
            className="inline-flex rounded-full border border-zinc-600/70 bg-zinc-900/90 p-0.5 shadow-inner"
            role="group"
            aria-label={t("localeToggleAria")}
          >
            {(Object.keys(LANG_TOGGLE) as LibrarianLanguageCode[]).map((code) => {
              const b = LANG_TOGGLE[code];
              const on = uiLocale === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLocale(code)}
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2 py-1 text-xs transition",
                    on
                      ? "bg-zinc-700 text-zinc-50 ring-1 ring-emerald-500/35"
                      : "text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200"
                  )}
                  aria-pressed={on}
                  aria-label={b.aria}
                  title={b.aria}
                >
                  <span className="select-none" aria-hidden>
                    {b.flag}
                  </span>
                  <span className="tabular-nums">{b.label}</span>
                </button>
              );
            })}
          </div>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-600/60 bg-zinc-900/80 px-2.5 py-1 text-xs font-medium text-zinc-200 shadow-sm"
            title={t("detectedLabel")}
            aria-label={`${t("detectedLabel")}: ${detectedBadge.aria}`}
          >
            <span className="text-[10px] text-zinc-500">{t("detectedLabel")}</span>
            <span className="select-none" aria-hidden>
              {detectedBadge.flag}
            </span>
            <span className="tabular-nums tracking-tight">{detectedBadge.label}</span>
          </span>
        </div>
      </div>

      {interactive ? (
        <div className="mb-3 space-y-2">
          <RhythmSparkline
            samples={rhythmSamples}
            uiLocale={uiLocale}
            composing={composing}
            normalizeGlow={normalizeGlow}
            serverIme={lastHalIme}
            title={t("rhythmTitle")}
            hintHold={t("rhythmImeHold")}
            hintNorm={t("rhythmImeNormalized")}
            hintServer={t("rhythmServerIme")}
          />
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={onTextareaKeyDown}
            onCompositionStart={onCompositionStart}
            onCompositionEnd={onCompositionEnd}
            placeholder={t("placeholder")}
            rows={3}
            disabled={loading}
            className={cn(
              "w-full resize-y rounded-xl border border-zinc-700/80 bg-zinc-950/90 px-3 py-2.5 text-sm text-zinc-100",
              "placeholder:text-zinc-500 focus:border-emerald-600/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
            )}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-zinc-500">
              {loading ? t("statusAsking") : error ? `${t("statusErrorPrefix")} ${error}` : t("statusIdle")}
            </p>
            <button
              type="button"
              onClick={() => void submitAsk()}
              disabled={loading || !question.trim()}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition",
                "bg-emerald-700/90 text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
              )}
            >
              {t("submit")}
            </button>
          </div>
        </div>
      ) : null}

      <div
        className="space-y-2 rounded-xl border border-zinc-700/70 bg-zinc-950/80 p-4 text-sm leading-relaxed text-zinc-100 shadow-inner"
        role="region"
        aria-label={t("answerRegion")}
      >
        {!hasAnswerText && !interactive ? <p className="text-zinc-500">—</p> : null}
        {lines.map((line, i) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return <div key={i} className="h-1" aria-hidden />;
          }

          const kind = classifyLibrarianBulletLine(line);
          if (kind === "plain") {
            return (
              <p key={i} className="text-zinc-400">
                {line}
              </p>
            );
          }

          const isCanon = kind === "canon";

          const shell = isCanon
            ? "border-l-4 border-emerald-500/55 bg-emerald-950/15 pl-3 pr-2 py-2 ring-1 ring-emerald-800/25"
            : "border-l-4 border-sky-500/55 bg-sky-950/15 pl-3 pr-2 py-2 ring-1 ring-sky-800/25";

          const textClass = isCanon ? "librarian-canon-authenticated" : "librarian-inference-scientific";

          const inner = (
            <div className={cn("rounded-r-md", shell)}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className={cn("min-w-0 flex-1 whitespace-pre-wrap", textClass)}>{line}</p>
                {isCanon && (
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-emerald-400/90">
                    {t("canonChip")}
                  </span>
                )}
                {!isCanon && (
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-sky-300/90">
                    {t("inferenceChip")}
                  </span>
                )}
              </div>
            </div>
          );

          if (isCanon) {
            const canonBulletIndex = lines
              .slice(0, i)
              .filter((prev) => classifyLibrarianBulletLine(prev) === "canon").length;
            return (
              <button
                key={i}
                type="button"
                onClick={() => openSourceForCanonLine(line, canonBulletIndex)}
                className={cn(
                  "w-full text-left transition hover:bg-emerald-950/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
                  "rounded-md"
                )}
                aria-label={t("viewSourceAria")}
              >
                {inner}
              </button>
            );
          }

          return (
            <div key={i} className="rounded-md">
              {inner}
            </div>
          );
        })}
      </div>

      {drawerOpen && (
        <div
          className="fixed inset-0 z-[120] flex justify-end bg-black/55 p-2 backdrop-blur-[1px] sm:p-4"
          role="presentation"
          onClick={closeDrawer}
        >
          <aside
            className="mt-auto h-[min(88vh,640px)] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-zinc-600 bg-zinc-950 shadow-2xl sm:mt-0 sm:h-full sm:rounded-l-2xl sm:rounded-r-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="librarian-source-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur">
              <h2 id="librarian-source-title" className="text-sm font-semibold text-zinc-100">
                {t("drawerTitle")}
              </h2>
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded-md px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                aria-label={t("drawerClose")}
              >
                {t("drawerClose")}
              </button>
            </header>
            {selectedChunk ? (
              <div className="space-y-3 p-4 text-sm text-zinc-300">
                <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs">
                  <dt className="text-zinc-500">{t("drawerDoc")}</dt>
                  <dd className="font-medium text-zinc-200">{selectedChunk.source_document}</dd>
                  <dt className="text-zinc-500">{t("drawerType")}</dt>
                  <dd className="text-zinc-200">{selectedChunk.chunk_type}</dd>
                  {selectedChunk.cosine_similarity != null && (
                    <>
                      <dt className="text-zinc-500">{t("drawerMatch")}</dt>
                      <dd className="tabular-nums text-zinc-200">
                        {(selectedChunk.cosine_similarity * 100).toFixed(1)}%
                      </dd>
                    </>
                  )}
                  <dt className="text-zinc-500">{t("drawerChunkId")}</dt>
                  <dd className="break-all font-mono text-[11px] text-zinc-400">{selectedChunk.id}</dd>
                </dl>
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    {t("drawerOriginal")}
                  </p>
                  <pre className="whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-900/80 p-3 text-[13px] leading-relaxed text-zinc-100">
                    {selectedChunk.content}
                  </pre>
                </div>
                <p className="text-xs text-zinc-500">{t("drawerFootnote")}</p>
              </div>
            ) : (
              <p className="p-4 text-sm text-zinc-500">{t("drawerEmpty")}</p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
