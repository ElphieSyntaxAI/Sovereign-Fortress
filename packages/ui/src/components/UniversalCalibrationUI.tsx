"use client";

import type { HTMLAttributes } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";

export type UniversalCalibrationRole = "author" | "student";

const DEFAULT_SESSION_MS = 5 * 60 * 1000;

export type UniversalCalibrationUIProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange" | "children"
> & {
  role: UniversalCalibrationRole;
  /** Defaults to 5 minutes. Use e.g. `2 * 60 * 1000` for a quick re-sync flow. */
  sessionDurationMs?: number;
  /** Fires once when the session ends (timer expires or user completes early). */
  onSessionEnd?: (payload: { content: string; keystrokeLatenciesMs: number[] }) => void;
};

function formatMmSs(totalMs: number): string {
  const s = Math.max(0, Math.ceil(totalMs / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function UniversalCalibrationUI({
  role,
  sessionDurationMs,
  className,
  onSessionEnd,
  ...rest
}: UniversalCalibrationUIProps) {
  const totalMs = sessionDurationMs ?? DEFAULT_SESSION_MS;
  const [phase, setPhase] = useState<"collecting" | "complete">("collecting");
  const [remainingMs, setRemainingMs] = useState(totalMs);
  const [content, setContent] = useState("");

  const latenciesRef = useRef<number[]>([]);
  const lastKeyDownRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef(content);
  const endedRef = useRef(false);
  const onSessionEndRef = useRef(onSessionEnd);

  contentRef.current = content;
  onSessionEndRef.current = onSessionEnd;

  const isAuthor = role === "author";

  const theme = isAuthor
    ? {
        shell: "border-amber-900/50 bg-gradient-to-b from-amber-950/40 via-zinc-950 to-zinc-950",
        accent: "text-amber-200",
        muted: "text-amber-200/70",
        badge: "bg-amber-500/15 text-amber-100 ring-1 ring-amber-500/30",
        prompt: "font-serif text-amber-50",
        textarea:
          "border-amber-900/40 bg-zinc-950/80 text-amber-50 placeholder:text-amber-200/30 focus:border-amber-600/60 focus:ring-amber-600/20",
        timer: "text-amber-300 tabular-nums",
        completeAccent: "text-emerald-300",
        footerLine: "text-amber-200/80",
      }
    : {
        shell: "border-slate-700/80 bg-gradient-to-b from-slate-900/90 via-zinc-950 to-zinc-950",
        accent: "text-sky-200",
        muted: "text-slate-400",
        badge: "bg-sky-500/10 text-sky-100 ring-1 ring-sky-500/25",
        prompt: "font-sans text-slate-100",
        textarea:
          "border-slate-700 bg-slate-950/80 text-slate-100 placeholder:text-slate-500 focus:border-sky-600/50 focus:ring-sky-500/20",
        timer: "text-sky-300 tabular-nums",
        completeAccent: "text-emerald-400",
        footerLine: "text-slate-300",
      };

  const headline = isAuthor ? "Creative writing calibration" : "Academic integrity calibration";
  const promptLabel = isAuthor ? "Writing origins" : "Lesson summary";
  const promptText = isAuthor
    ? "Take a few minutes to reflect on your writing origins: the stories, people, or moments that made you want to write. There are no wrong answers—write freely."
    : "Summarize a recent lesson in your own words. Focus on the main ideas you understood and how they connect to what you already know.";

  const finishSession = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    setPhase("complete");
    onSessionEndRef.current?.({
      content: contentRef.current,
      keystrokeLatenciesMs: [...latenciesRef.current],
    });
  }, []);

  useEffect(() => {
    if (phase !== "collecting") return;

    const id = window.setInterval(() => {
      setRemainingMs((prev) => Math.max(0, prev - 1000));
    }, 1000);

    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== "collecting" || remainingMs > 0) return;
    finishSession();
  }, [phase, remainingMs, finishSession]);

  useEffect(() => {
    if (phase !== "collecting") return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (endedRef.current) return;
      if (e.repeat) return;
      const ta = textareaRef.current;
      if (!ta || document.activeElement !== ta) return;
      if (e.key === "Tab" || e.key === "Escape") return;

      const now = performance.now();
      const last = lastKeyDownRef.current;
      if (last != null) {
        latenciesRef.current.push(Math.round(now - last));
      }
      lastKeyDownRef.current = now;
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [phase]);

  return (
    <div
      className={cn(
        "w-full max-w-2xl rounded-2xl border p-6 shadow-xl sm:p-8",
        theme.shell,
        className
      )}
      {...rest}
    >
      <header className="mb-6 space-y-2">
        <span
          className={cn(
            "inline-flex rounded-full px-3 py-1 text-xs font-medium tracking-wide uppercase",
            theme.badge
          )}
        >
          {headline}
        </span>
        <h2 className={cn("text-lg font-semibold leading-snug sm:text-xl", theme.prompt)}>
          {promptLabel}
        </h2>
        <p className={cn("text-sm leading-relaxed", theme.muted)}>{promptText}</p>
      </header>

      {phase === "collecting" ? (
        <>
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className={cn("text-xs font-medium uppercase tracking-wider", theme.muted)}>
              Session timer
            </span>
            <span className={cn("text-sm font-semibold", theme.timer)} aria-live="polite">
              {formatMmSs(remainingMs)}
            </span>
          </div>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className={cn(
              "min-h-[200px] w-full resize-y rounded-xl border px-4 py-3 text-sm leading-relaxed shadow-inner outline-none ring-0 transition focus:ring-2",
              theme.textarea
            )}
            placeholder={isAuthor ? "Begin your reflection…" : "Type your summary here…"}
            autoComplete="off"
            spellCheck={true}
            aria-label={isAuthor ? "Writing origins response" : "Lesson summary response"}
          />
          <p className={cn("mt-2 text-xs", theme.muted)}>
            Keystroke timing is recorded invisibly for your forensic profile. Nothing is shown on
            screen except this timer.
          </p>
          <button
            type="button"
            onClick={finishSession}
            className={cn(
              "mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-medium transition sm:w-auto",
              isAuthor
                ? "bg-amber-600/90 text-zinc-950 hover:bg-amber-500"
                : "bg-sky-600/90 text-white hover:bg-sky-500"
            )}
          >
            Complete calibration
          </button>
        </>
      ) : (
        <div
          className={cn(
            "rounded-xl border p-6 text-center",
            isAuthor ? "border-amber-800/40 bg-zinc-950/60" : "border-slate-700/60 bg-slate-950/50"
          )}
          role="status"
        >
          <p className={cn("text-base font-semibold", theme.accent)}>Forensic Profile Generated</p>
          <p className={cn("mt-3 text-sm", theme.completeAccent)}>
            {isAuthor ? "IP Protection Active." : "Authorship Verified."}
          </p>
          <p className={cn("mt-4 text-xs", theme.footerLine)}>
            You can close this panel or start a new session from your dashboard when available.
          </p>
        </div>
      )}
    </div>
  );
}
