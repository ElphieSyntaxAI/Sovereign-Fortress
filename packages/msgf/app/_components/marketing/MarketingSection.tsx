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
 * Distribution Build ID: MSGF-853c3b6-20260519T054901Z-internal
 */
import type { ReactNode } from "react";

type Props = {
  id?: string;
  eyebrow?: string;
  title: string;
  children: ReactNode;
  variant?: "default" | "featured";
};

export function MarketingSection({
  id,
  eyebrow,
  title,
  children,
  variant = "default",
}: Props) {
  return (
    <section
      id={id}
      className={
        variant === "featured"
          ? "marketing-section marketing-section-featured glass-panel glass-panel-emerald rounded-3xl p-6 sm:p-10"
          : "marketing-section pricing-card rounded-3xl p-6 sm:p-10"
      }
    >
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300/85">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#f8fafc] sm:text-3xl">
        {title}
      </h2>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-[#e8e4df] sm:text-base">
        {children}
      </div>
    </section>
  );
}

export function MarketingPillarList({
  items,
}: {
  items: { id: string; title: string; body: string }[];
}) {
  return (
    <ul className="space-y-4" role="list">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex gap-3 rounded-xl border border-emerald-500/15 bg-[#160f29]/60 p-4"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs font-bold text-emerald-300">
            {item.id}
          </span>
          <div>
            <p className="font-semibold text-[#f8fafc]">{item.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-emerald-100/75">{item.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
