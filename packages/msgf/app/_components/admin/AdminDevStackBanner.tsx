/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-3ea5d0e-20260529T033030Z-internal
 */
import type { DevStackProbe } from "@/lib/dev-stack-status";

type Props = {
  probes: DevStackProbe[];
};

export function AdminDevStackBanner({ probes }: Props) {
  const authorBff = probes.find((p) => p.id === "author_bff");
  const authorClient = probes.find((p) => p.id === "author_client");
  const authorDown =
    authorBff?.status === "down" || authorClient?.status === "down";

  if (!authorDown) {
    return (
      <section className="glass-panel rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4 text-sm text-emerald-100">
        <p className="font-medium">Local Author stack is reachable.</p>
        <p className="mt-1 text-emerald-200/80">
          Open <strong>Author client (localhost)</strong> on the card below, or use production if
          deployed.
        </p>
      </section>
    );
  }

  return (
    <section className="glass-panel rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-50">
      <p className="font-semibold text-amber-100">Author platform — connection refused?</p>
      <p className="mt-2 text-amber-100/90">
        MSGF is running, but the Author apps are separate processes. Start them in{" "}
        <strong>two more terminals</strong> from the repo root (Supabase keys in{" "}
        <code className="text-amber-200">packages/msgf/.env.local</code> or root{" "}
        <code className="text-amber-200">.env.local</code>):
      </p>
      <pre className="mt-3 overflow-x-auto rounded-lg border border-amber-500/20 bg-black/30 p-3 text-xs text-amber-50">
        {`npm run dev:author-bff    # port 3002 — API\nnpm run dev:author-client # port 5173 — UI (use this button)`}
      </pre>
      <ul className="mt-4 space-y-2 text-xs text-amber-100/85">
        {probes.map((p) => (
          <li key={p.id} className="flex flex-wrap items-baseline gap-2">
            <span
              className={
                p.status === "up"
                  ? "font-semibold text-emerald-300"
                  : "font-semibold text-rose-300"
              }
            >
              {p.status === "up" ? "● up" : "○ down"}
            </span>
            <span className="font-medium">{p.label}</span>
            <span className="font-mono text-amber-200/80">{p.url}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-amber-200/70">
        Production URL (<code>authorecosystem.elphiesyntax.com</code>) only works when that host is
        deployed; for day-to-day testing, use localhost after the commands above.
      </p>
    </section>
  );
}
