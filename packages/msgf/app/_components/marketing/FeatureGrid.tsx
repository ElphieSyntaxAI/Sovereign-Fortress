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
 * Distribution Build ID: MSGF-3a4c1de-20260529T200349Z-internal
 */
import type { ShippedFeature } from "./shipped-capabilities";

const ACCENT_RING: Record<ShippedFeature["accent"], string> = {
  emerald: "border-emerald-500/20 hover:border-emerald-400/40",
  violet: "border-violet-500/20 hover:border-violet-400/40",
  cyan: "border-cyan-500/20 hover:border-cyan-400/40",
  amber: "border-amber-500/20 hover:border-amber-400/40",
};

const ACCENT_DOT: Record<ShippedFeature["accent"], string> = {
  emerald: "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.45)]",
  violet: "bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.45)]",
  cyan: "bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.4)]",
  amber: "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.4)]",
};

export function FeatureGrid({ items }: { items: ShippedFeature[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <article
          key={item.id}
          className={`glass-panel group rounded-2xl border p-5 transition ${ACCENT_RING[item.accent]}`}
        >
          <span
            className={`inline-block h-2 w-2 rounded-full ${ACCENT_DOT[item.accent]}`}
            aria-hidden
          />
          <h3 className="mt-3 text-lg font-semibold text-slate-50">{item.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.description}</p>
        </article>
      ))}
    </div>
  );
}
