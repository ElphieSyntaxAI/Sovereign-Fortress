"use client";

import type { HTMLAttributes } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";

export type ForensicTenantType = "author" | "school";

/** Single key event in the silent DNA capture stream. */
export type KeystrokeDnaEvent = {
  kind: "down" | "up";
  key: string;
  code: string;
  t: number;
};

export type KeystrokeDna = {
  events: KeystrokeDnaEvent[];
  /** Monotonic session id incremented on each forced restart (e.g. paste). */
  capture_generation: number;
};

export type UniversalForensicCalibrationPayload = {
  tenantType: ForensicTenantType;
  content: string;
  keystrokeDna: KeystrokeDna;
  /** Flight times between successive keydowns (ms), for HAL `keystrokeLatencies` compatibility. */
  keystrokeLatenciesMs: number[];
  /** Always true for this flow — server should persist `IDENTITY_ROOT` on `p4_hal_ledger`. */
  identityRoot: true;
};

export type UniversalForensicCalibrationProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "onSubmit" | "children"
> & {
  tenantType: ForensicTenantType;
  /** Called only after a valid submit (no paste invalidation in this session). */
  onSubmit: (payload: UniversalForensicCalibrationPayload) => void | Promise<void>;
};

/** Derive inter-keydown flight times from DNA (ms, rounded). */
export function deriveKeydownFlightLatenciesMs(events: KeystrokeDnaEvent[]): number[] {
  const downs = events.filter((e) => e.kind === "down");
  const out: number[] = [];
  for (let i = 1; i < downs.length; i++) {
    out.push(Math.round(downs[i]!.t - downs[i - 1]!.t));
  }
  return out;
}

export function UniversalForensicCalibration({
  tenantType,
  className,
  onSubmit,
  ...rest
}: UniversalForensicCalibrationProps) {
  const [content, setContent] = useState("");
  const [captureGeneration, setCaptureGeneration] = useState(0);
  const [restartBanner, setRestartBanner] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dnaRef = useRef<KeystrokeDnaEvent[]>([]);
  const contentRef = useRef(content);
  const generationRef = useRef(captureGeneration);
  const onSubmitRef = useRef(onSubmit);

  contentRef.current = content;
  generationRef.current = captureGeneration;
  onSubmitRef.current = onSubmit;

  const isAuthor = tenantType === "author";

  const theme = isAuthor
    ? {
        shell: "border-violet-900/45 bg-gradient-to-b from-violet-950/35 via-zinc-950 to-zinc-950",
        badge: "bg-violet-500/15 text-violet-100 ring-1 ring-violet-500/30",
        title: "font-serif text-violet-50",
        body: "text-violet-200/75",
        textarea:
          "border-violet-900/40 bg-zinc-950/85 text-violet-50 placeholder:text-violet-300/25 focus:border-violet-500/55 focus:ring-violet-500/20",
        btn: "bg-violet-600/90 text-white hover:bg-violet-500",
        warn: "border-amber-600/40 bg-amber-950/50 text-amber-100",
      }
    : {
        shell: "border-emerald-900/45 bg-gradient-to-b from-emerald-950/30 via-zinc-950 to-zinc-950",
        badge: "bg-emerald-500/12 text-emerald-100 ring-1 ring-emerald-500/25",
        title: "font-sans text-emerald-50",
        body: "text-emerald-100/70",
        textarea:
          "border-emerald-900/35 bg-zinc-950/85 text-emerald-50 placeholder:text-emerald-200/30 focus:border-emerald-500/50 focus:ring-emerald-500/15",
        btn: "bg-emerald-600/90 text-white hover:bg-emerald-500",
        warn: "border-red-700/45 bg-red-950/40 text-red-100",
      };

  const headline = isAuthor ? "Identity baseline — author" : "Identity baseline — school";
  const promptTitle = isAuthor ? "Origin story" : "Topic summary";
  const promptBody = isAuthor
    ? "Tell your origin story as a writer: what pulled you toward storytelling, and what do you hope readers feel? Type organically — this session establishes your typing DNA."
    : "Write a concise summary of one topic you studied recently. Use your own words only. This session captures keystroke timing for authorship verification — do not paste from elsewhere.";

  const hardRestart = useCallback((reason: string) => {
    dnaRef.current = [];
    setContent("");
    setRestartBanner(reason);
    setCaptureGeneration((g) => g + 1);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      e.preventDefault();
      e.stopPropagation();
      hardRestart("Pasted text is not allowed. Session cleared — type your response manually.");
    },
    [hardRestart]
  );

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;

    const record = (kind: "down" | "up", ev: KeyboardEvent) => {
      if (document.activeElement !== ta) return;
      dnaRef.current.push({
        kind,
        key: ev.key,
        code: ev.code,
        t: performance.now(),
      });
    };

    const onDown = (ev: KeyboardEvent) => record("down", ev);
    const onUp = (ev: KeyboardEvent) => record("up", ev);

    ta.addEventListener("keydown", onDown, true);
    ta.addEventListener("keyup", onUp, true);
    return () => {
      ta.removeEventListener("keydown", onDown, true);
      ta.removeEventListener("keyup", onUp, true);
    };
  }, [captureGeneration]);

  const handleSubmit = async () => {
    const text = contentRef.current.trim();
    if (!text) return;

    setIsSubmitting(true);
    try {
      const events = [...dnaRef.current];
      const latencies = deriveKeydownFlightLatenciesMs(events);
      const payload: UniversalForensicCalibrationPayload = {
        tenantType,
        content: contentRef.current,
        keystrokeDna: { events, capture_generation: generationRef.current },
        keystrokeLatenciesMs: latencies,
        identityRoot: true,
      };
      await onSubmitRef.current(payload);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={cn(
        "w-full max-w-2xl rounded-2xl border p-6 shadow-xl sm:p-8",
        theme.shell,
        className
      )}
      {...rest}
    >
      <header className="mb-5 space-y-2">
        <span
          className={cn(
            "inline-flex rounded-full px-3 py-1 text-xs font-medium tracking-wide uppercase",
            theme.badge
          )}
        >
          {headline}
        </span>
        <h2 className={cn("text-lg font-semibold sm:text-xl", theme.title)}>{promptTitle}</h2>
        <p className={cn("text-sm leading-relaxed", theme.body)}>{promptBody}</p>
      </header>

      {restartBanner ? (
        <div
          className={cn("mb-4 rounded-lg border px-4 py-3 text-sm", theme.warn)}
          role="alert"
        >
          {restartBanner}
        </div>
      ) : null}

      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => {
          setRestartBanner(null);
          setContent(e.target.value);
        }}
        onPaste={handlePaste}
        className={cn(
          "min-h-[220px] w-full resize-y rounded-xl border px-4 py-3 text-sm leading-relaxed shadow-inner outline-none focus:ring-2",
          theme.textarea
        )}
        placeholder={isAuthor ? "Type your origin story…" : "Type your topic summary…"}
        autoComplete="off"
        spellCheck={true}
        aria-label={isAuthor ? "Origin story response" : "Topic summary response"}
      />

      <p className={cn("mt-2 text-xs opacity-80", theme.body)}>
        Keystroke timing is captured silently (keydown & keyup). Pasting anywhere in this field
        invalidates the session and clears your progress.
      </p>

      <button
        type="button"
        disabled={isSubmitting || !content.trim()}
        onClick={handleSubmit}
        className={cn(
          "mt-5 w-full rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:opacity-40 sm:w-auto",
          theme.btn
        )}
      >
        {isSubmitting ? "Submitting…" : "Submit identity baseline"}
      </button>
    </div>
  );
}
