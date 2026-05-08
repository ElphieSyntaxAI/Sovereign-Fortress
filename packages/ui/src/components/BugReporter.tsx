"use client";

import type { HTMLAttributes } from "react";
import { useCallback, useEffect, useId, useState } from "react";
import { cn } from "../lib/cn";

export type BugReporterProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> & {
  /** Full URL to MSGF `POST /api/msgf/incidents/report` (e.g. Vite `import.meta.env.VITE_MSGF_INCIDENT_REPORT_URL`). */
  reportEndpointUrl: string;
};

function BugIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
      aria-hidden
    >
      <ellipse cx="12" cy="12" rx="3.5" ry="4.5" />
      <path strokeLinecap="round" d="M12 7V4M12 20v-3M7 10H4M20 10h-3M8 15l-2 2M16 15l2 2M8 9L6 7M16 9l2-2" />
    </svg>
  );
}

export function BugReporter({
  reportEndpointUrl,
  className,
  ...rest
}: BugReporterProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [errText, setErrText] = useState("");
  const baseId = useId();
  const msgId = `${baseId}-msg`;

  const tenantId =
    typeof window !== "undefined" ? window.location.origin : "";
  const locationHref =
    typeof window !== "undefined" ? window.location.href : "";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed || !reportEndpointUrl) return;
    setStatus("sending");
    setErrText("");
    try {
      const res = await fetch(reportEndpointUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          location: locationHref,
          tenant_id: tenantId,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setStatus("err");
        setErrText(
          typeof data.error === "string"
            ? data.error
            : `Request failed (${res.status})`
        );
        return;
      }
      setStatus("ok");
      setMessage("");
      setTimeout(() => {
        setOpen(false);
        setStatus("idle");
      }, 1200);
    } catch {
      setStatus("err");
      setErrText("Network error");
    }
  }, [message, reportEndpointUrl, locationHref, tenantId]);

  return (
    <div
      className={cn("pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col items-end gap-2", className)}
      {...rest}
    >
      {open && (
        <div
          className="pointer-events-auto w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-zinc-700 bg-zinc-950 p-4 text-zinc-100 shadow-xl"
          role="dialog"
          aria-labelledby={`${baseId}-title`}
        >
          <h2 id={`${baseId}-title`} className="text-sm font-semibold tracking-tight">
            Report an issue
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Tenant:{" "}
            <span className="font-mono text-zinc-400">{tenantId || "—"}</span>
          </p>
          <label htmlFor={msgId} className="mt-3 block text-xs font-medium text-zinc-400">
            What went wrong?
          </label>
          <textarea
            id={msgId}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="mt-1 w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 placeholder:text-zinc-600 focus:border-emerald-600 focus:ring-2"
            placeholder="Steps to reproduce, error text, or feedback…"
          />
          {status === "err" && (
            <p className="mt-2 text-xs text-red-400" role="alert">
              {errText}
            </p>
          )}
          {status === "ok" && (
            <p className="mt-2 text-xs text-emerald-400">Thanks — report received.</p>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              onClick={() => {
                setOpen(false);
                setStatus("idle");
                setErrText("");
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={status === "sending" || !message.trim()}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
              onClick={() => void submit()}
            >
              {status === "sending" ? "Sending…" : "Submit"}
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? "Close bug reporter" : "Open bug reporter"}
        className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-zinc-600 bg-zinc-900 text-emerald-400 shadow-lg transition hover:border-emerald-500/60 hover:bg-zinc-800 hover:text-emerald-300"
        onClick={() => {
          setOpen((o) => !o);
          if (open) {
            setStatus("idle");
            setErrText("");
          }
        }}
      >
        <BugIcon className="h-6 w-6" />
      </button>
    </div>
  );
}
