/**
 * Utah S.B. 149 disclosure gate UI — shown before writing / AI tools.
 */
import { useEffect, useState } from "react";

import { msgfFetch } from "../lib/msgfClient";

export type DisclosureCopy = {
  title: string;
  summary: string;
  bullets: string[];
  hb273Bullets: string[];
  acceptLabel: string;
  declineLabel: string;
  legalVersion: string;
};

type Props = {
  entityToken: string;
  assignmentInstanceId?: string;
  assignmentId?: string;
  onAccepted: () => void;
  onDeclined?: () => void;
};

export function UtahDisclosureGate(props: Props) {
  const [copy, setCopy] = useState<DisclosureCopy | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const q = new URLSearchParams({ entityToken: props.entityToken });
        if (props.assignmentInstanceId) {
          q.set("assignmentInstanceId", props.assignmentInstanceId);
        }
        const json = await msgfFetch<{
          status: { accepted: boolean; copy: DisclosureCopy };
        }>(`/api/msgf/education/utah-disclosure?${q.toString()}`);
        if (cancelled) return;
        setCopy(json.status.copy);
        if (json.status.accepted) {
          setAccepted(true);
          props.onAccepted();
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.entityToken, props.assignmentInstanceId]);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await msgfFetch("/api/msgf/education/utah-disclosure", {
        method: "POST",
        body: JSON.stringify({
          entityToken: props.entityToken,
          assignmentInstanceId: props.assignmentInstanceId ?? null,
          assignmentId: props.assignmentId ?? null,
          accepted: true,
        }),
      });
      setAccepted(true);
      props.onAccepted();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (accepted) return null;
  if (!copy) {
    return (
      <div className="rounded border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">
        Loading Utah AI disclosure…
        {error && <p className="mt-2 text-rose-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded border border-amber-700/50 bg-zinc-950 p-5 shadow-lg">
      <p className="mb-1 text-xs uppercase tracking-wider text-amber-400/90">
        Utah S.B. 149 · H.B. 273 · {copy.legalVersion}
      </p>
      <h2 className="mb-2 text-lg font-semibold text-zinc-100">{copy.title}</h2>
      <p className="mb-3 text-sm text-zinc-300">{copy.summary}</p>
      <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-zinc-400">
        {copy.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
        H.B. 273 protections
      </p>
      <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-zinc-400">
        {copy.hb273Bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      {error && <p className="mb-2 text-sm text-rose-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void accept()}
          className="rounded border border-emerald-600 bg-emerald-600/20 px-4 py-2 text-sm text-emerald-200 disabled:opacity-40"
        >
          {busy ? "Saving…" : copy.acceptLabel}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => props.onDeclined?.()}
          className="rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-400"
        >
          {copy.declineLabel}
        </button>
      </div>
    </div>
  );
}
