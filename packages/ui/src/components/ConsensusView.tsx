"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

export type ConsensusModelPanel = {
  name: string;
  content: ReactNode;
  /** Optional footer (e.g. verdict, latency). */
  footer?: ReactNode;
};

export type ConsensusViewProps = HTMLAttributes<HTMLDivElement> & {
  modelA: ConsensusModelPanel;
  modelB: ConsensusModelPanel;
  /** Shown above the grid (e.g. chunk id). */
  heading?: ReactNode;
  /**
   * Value sent on `x-msgf-jira-bridge-identity` (central bridge “home address”), e.g.
   * `elphiesgatedai.elphiesyntax.com`.
   */
  jiraBridgeIdentity?: string;
  /** Originating site hostname for the conflict (e.g. `syntaxeducates.elphiesyntax.com`). */
  reportingSourceHost?: string;
};

export function ConsensusView({
  modelA,
  modelB,
  heading,
  jiraBridgeIdentity,
  reportingSourceHost,
  className,
  ...rest
}: ConsensusViewProps) {
  const showBridge = Boolean(jiraBridgeIdentity || reportingSourceHost);

  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-zinc-100 shadow-sm",
        className
      )}
      {...rest}
    >
      {heading ? (
        <div className="mb-3 text-sm font-medium text-zinc-400">{heading}</div>
      ) : null}

      {showBridge ? (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-950/25 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-200/90">
            x-msgf-jira-bridge-identity
          </div>
          <div className="mt-0.5 font-mono text-xs text-amber-50">
            {jiraBridgeIdentity ?? "—"}
          </div>
          {reportingSourceHost ? (
            <>
              <div className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Reporting host
              </div>
              <div className="font-mono text-xs text-zinc-200">
                {reportingSourceHost}
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <ConsensusPanel {...modelA} />
        <ConsensusPanel {...modelB} />
      </div>
    </div>
  );
}

function ConsensusPanel({ name, content, footer }: ConsensusModelPanel) {
  return (
    <section className="flex min-h-[10rem] flex-col rounded-lg border border-zinc-800/80 bg-zinc-900/40">
      <header className="border-b border-zinc-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {name}
      </header>
      <div className="flex-1 whitespace-pre-wrap px-3 py-3 text-sm leading-relaxed text-zinc-200">
        {content}
      </div>
      {footer ? (
        <footer className="border-t border-zinc-800 px-3 py-2 text-xs text-zinc-500">
          {footer}
        </footer>
      ) : null}
    </section>
  );
}
