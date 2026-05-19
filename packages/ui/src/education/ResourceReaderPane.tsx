/**
 * Syntax Education — Student-side approved-reading pane (masterdoc §4.3).
 *
 * Renders the teacher-chopped slice in a sandboxed iframe and emits focus / unlock
 * events the WorkspaceCanvas uses to satisfy the P2 reading dependency trigger
 * (pillars §2.2.1).
 */
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "../lib/cn";

export type ResourceReaderPayload = {
  resourceContextId: string;
  catalogId: string;
  title: string;
  publisher?: string | null;
  /** Tokenized URL — `signResourceDeepLink` output from `assignment-resources.ts`. */
  signedDeepLink: string;
  signedDeepLinkExpiresAt?: string | null;
  sourceType: "local_pdf" | "local_epub" | "lti_publisher" | "clever" | "classlink";
  pageStart?: number | null;
  pageEnd?: number | null;
  requireReadingBlock: boolean;
  minFocusBlockMs: number;
};

export type ResourceReaderPaneProps = {
  payload: ResourceReaderPayload;
  /** Fired when a contiguous focus block exceeds `minFocusBlockMs`. */
  onReadingGateSatisfied?: (info: { focusBlockMs: number }) => void;
  className?: string;
};

export function ResourceReaderPane({
  payload,
  onReadingGateSatisfied,
  className,
}: ResourceReaderPaneProps) {
  const [focused, setFocused] = useState(false);
  const [focusBlockMs, setFocusBlockMs] = useState(0);
  const [gateSatisfied, setGateSatisfied] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blockStartRef = useRef<number | null>(null);

  useEffect(() => {
    function onVis() {
      if (typeof document === "undefined") return;
      const isVisible = !document.hidden;
      setFocused(isVisible);
      if (!isVisible) {
        blockStartRef.current = null;
      } else if (blockStartRef.current == null) {
        blockStartRef.current = Date.now();
      }
    }
    onVis();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", () => setFocused(false));
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    if (gateSatisfied || !payload.requireReadingBlock) return;
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      if (!focused || blockStartRef.current == null) return;
      const elapsed = Date.now() - blockStartRef.current;
      setFocusBlockMs(elapsed);
      if (elapsed >= payload.minFocusBlockMs) {
        setGateSatisfied(true);
        onReadingGateSatisfied?.({ focusBlockMs: elapsed });
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    }, 1000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [focused, gateSatisfied, payload, onReadingGateSatisfied]);

  const progressPct = useMemo(() => {
    if (!payload.requireReadingBlock || payload.minFocusBlockMs <= 0) return 100;
    return Math.min(100, Math.round((focusBlockMs / payload.minFocusBlockMs) * 100));
  }, [focusBlockMs, payload]);

  return (
    <section
      data-resource-reader-pane
      data-resource-context-id={payload.resourceContextId}
      data-focused={focused}
      data-reading-gate={gateSatisfied ? "satisfied" : "pending"}
      className={cn(
        "flex h-full min-h-[420px] flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/60",
        className
      )}
    >
      <header className="flex items-baseline justify-between border-b border-zinc-800 bg-zinc-950/60 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-100">{payload.title}</p>
          <p className="truncate text-xs text-zinc-400">
            {payload.publisher ?? payload.sourceType}
            {payload.pageStart != null && payload.pageEnd != null
              ? ` · pp. ${payload.pageStart}–${payload.pageEnd}`
              : ""}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide",
            focused ? "bg-emerald-700/40 text-emerald-200" : "bg-zinc-800 text-zinc-400"
          )}
        >
          {focused ? "Reading" : "Away"}
        </span>
      </header>

      {payload.requireReadingBlock && !gateSatisfied && (
        <div className="border-b border-zinc-800 bg-zinc-950/40 px-3 py-2">
          <div className="flex items-center justify-between text-[11px] text-zinc-300">
            <span>Reading gate (P2)</span>
            <span>
              {Math.round(focusBlockMs / 1000)}s / {Math.round(payload.minFocusBlockMs / 1000)}s
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      <iframe
        title={payload.title}
        src={payload.signedDeepLink}
        className="min-h-0 w-full flex-1 bg-white"
        sandbox="allow-scripts allow-same-origin allow-popups"
        referrerPolicy="no-referrer"
      />

      <footer className="border-t border-zinc-800 bg-zinc-950/60 px-3 py-2 text-[11px] text-zinc-500">
        Tokenized link expires{" "}
        {payload.signedDeepLinkExpiresAt
          ? new Date(payload.signedDeepLinkExpiresAt).toLocaleString()
          : "—"}
      </footer>
    </section>
  );
}
