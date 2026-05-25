import { useEffect, useState } from "react";

import type { ScanThought } from "../../lib/onboardingApi";

export function DocumentScanLoader(props: { thoughts: ScanThought[]; filename: string }) {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    setVisible(0);
    if (props.thoughts.length === 0) return;
    const id = window.setInterval(() => {
      setVisible((v) => {
        if (v >= props.thoughts.length - 1) {
          window.clearInterval(id);
          return v;
        }
        return v + 1;
      });
    }, 900);
    return () => window.clearInterval(id);
  }, [props.thoughts]);

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-950/80 p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-violet-400/90">Librarian scan</p>
      <p className="mt-1 text-sm text-zinc-400">Reading {props.filename}…</p>
      <ul className="mt-4 space-y-2 font-mono text-sm text-emerald-100/90">
        {props.thoughts.slice(0, visible + 1).map((t, i) => (
          <li key={i} className="animate-pulse">
            <span className="text-zinc-600">&gt; </span>
            {t.line}
          </li>
        ))}
      </ul>
      {visible < props.thoughts.length - 1 ? (
        <p className="mt-4 text-xs text-zinc-500">Still thinking…</p>
      ) : null}
    </div>
  );
}
