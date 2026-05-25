import { useCallback, useEffect, useRef, useState } from "react";

import { bffAuthHeaders, bffCredentials, bffUrl } from "../../lib/bffFetch";
import { countWords } from "../../lib/countWords";

type HalStartupModalProps = {
  open: boolean;
  prompt: string;
  targetSeconds: number;
  minWords: number;
  manuscriptId: string | null;
  tenantId: string;
  getAccessToken: () => string | null | Promise<string | null>;
  onComplete: () => void;
};

export function HalStartupModal(props: HalStartupModalProps) {
  const { open, prompt, targetSeconds, minWords, manuscriptId, tenantId, getAccessToken, onComplete } =
    props;
  const [text, setText] = useState("");
  const [keystrokes, setKeystrokes] = useState<
    Array<{ key: string; flightTime: number; dwellTime: number; isBackspace: boolean }>
  >([]);
  const [secondsLeft, setSecondsLeft] = useState(targetSeconds);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastKeyTime = useRef(performance.now());
  const keyDepths = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!open) return;
    setSecondsLeft(targetSeconds);
    setText("");
    setKeystrokes([]);
    setError(null);
    const t = window.setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [open, targetSeconds]);

  const words = countWords(text);
  const canSubmit = words >= minWords && !submitting;

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const now = performance.now();
    if (!keyDepths.current[e.key]) keyDepths.current[e.key] = now;
    const flightTime = Math.round(now - lastKeyTime.current);
    setKeystrokes((prev) => [
      ...prev,
      { key: e.key, flightTime, dwellTime: 0, isBackspace: e.key === "Backspace" },
    ]);
    lastKeyTime.current = now;
  };

  const onKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const up = performance.now();
    const down = keyDepths.current[e.key];
    if (down) {
      const dwell = Math.round(up - down);
      setKeystrokes((prev) => {
        const copy = [...prev];
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].key === e.key && copy[i].dwellTime === 0) {
            copy[i] = { ...copy[i], dwellTime: dwell };
            break;
          }
        }
        return copy;
      });
      delete keyDepths.current[e.key];
    }
  };

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const latencies = keystrokes.map((k) => k.flightTime).filter((n) => n > 0);
      const res = await fetch(bffUrl("/api/onboarding/hal-startup"), {
        method: "POST",
        ...bffCredentials,
        headers: {
          ...bffAuthHeaders(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: text,
          prompt,
          keystrokeLatencies: latencies.length ? latencies : [90, 85, 110, 95],
          keystrokeDna: { events: keystrokes },
          manuscript_id: manuscriptId,
          tenantId,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || res.statusText);
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, getAccessToken, keystrokes, manuscriptId, onComplete, prompt, tenantId, text]);

  if (!open) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-zinc-950/90 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-violet-500/40 bg-zinc-900 p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-violet-100">Establish your HAL startup pace</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Type freely for about five minutes. This becomes your biometric identity root — the baseline HAL uses
          to recognize your rhythm on this account.
        </p>
        <p className="mt-4 rounded-lg border border-violet-800/50 bg-violet-950/30 px-4 py-3 text-sm italic text-violet-100/90">
          {prompt}
        </p>
        <p className="mt-3 text-xs text-zinc-500">
          Timer: {mins}:{secs.toString().padStart(2, "0")} · Words: {words} / {minWords} minimum
        </p>
        <textarea
          className="mt-4 min-h-[220px] w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          placeholder="Begin typing here…"
          disabled={submitting}
        />
        {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void submit()}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {submitting ? "Saving pace…" : "Save my startup pace"}
          </button>
        </div>
      </div>
    </div>
  );
}
