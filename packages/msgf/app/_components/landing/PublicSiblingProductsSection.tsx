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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
import Link from "next/link";

import {
  ELPHIE_PRODUCT_HOSTS,
  PLATFORM_HUB_ENTRIES,
  availabilityLabel,
} from "@elphie-syntax/core";

const AUTHOR_URL = `https://${ELPHIE_PRODUCT_HOSTS.author}`;
const EDUCATION_URL = `https://${ELPHIE_PRODUCT_HOSTS.education}`;
const PICKER_URL = `https://${ELPHIE_PRODUCT_HOSTS.apex}`;

const SIBLINGS = PLATFORM_HUB_ENTRIES.filter((p) => p.id !== "msgf");

export function PublicSiblingProductsSection() {
  return (
    <section
      id="other-products"
      className="border-t border-violet-500/10 bg-slate-950/30 scroll-mt-24"
    >
      <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.22em] text-violet-300/85">
          Elphie Syntax product family
        </p>
        <h2 className="mt-3 text-center text-2xl font-bold tracking-tight sm:text-3xl">
          Other products on the same governance layer
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-slate-400">
          MSGF is the shared AI gateway. Author Ecosystem and Syntax Education are applications on
          that layer — explore from{" "}
          <a href={PICKER_URL} className="text-emerald-400/90 hover:underline">
            {ELPHIE_PRODUCT_HOSTS.apex}
          </a>
          .
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {SIBLINGS.map((platform) => {
            const ctaUrl = platform.primaryCta
              ? platform.primaryCta.path.startsWith("http")
                ? platform.primaryCta.path
                : `https://${platform.productionHost}${platform.primaryCta.path.startsWith("/") ? "" : "/"}${platform.primaryCta.path}`
              : null;
            const href = ctaUrl ?? (platform.id === "author" ? AUTHOR_URL : EDUCATION_URL);
            const accent =
              platform.tone === "amethyst"
                ? "border-violet-500/25 ring-violet-500/10"
                : "border-amber-500/25 ring-amber-500/10";
            const statusClass =
              platform.availability === "foundational_testing"
                ? "border-violet-500/35 bg-violet-500/15 text-violet-200"
                : platform.availability === "in_development"
                  ? "border-slate-600/50 bg-slate-800/50 text-slate-400"
                  : "border-emerald-500/35 bg-emerald-500/15 text-emerald-200";
            return (
              <article
                key={platform.id}
                className={`glass-panel rounded-2xl border p-6 ring-1 ${accent}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {platform.eyebrow}
                  </p>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusClass}`}
                  >
                    {availabilityLabel(platform.availability)}
                  </span>
                </div>
                <h3 className="mt-2 text-xl font-bold text-slate-100">{platform.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{platform.tagline}</p>
                <ul className="mt-4 space-y-2 text-sm text-slate-400">
                  {platform.bullets.slice(0, 3).map((b) => (
                    <li key={b} className="flex gap-2">
                      <span className="text-emerald-400/80" aria-hidden>
                        ·
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
                {platform.primaryCta ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-5 inline-flex items-center gap-2 rounded-full border border-slate-600/50 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/5"
                  >
                    {platform.primaryCta.label}
                    <span aria-hidden>↗</span>
                  </a>
                ) : (
                  <p className="mt-5 text-xs text-slate-500">Public signup not open yet.</p>
                )}
              </article>
            );
          })}
        </div>

        <p className="mt-8 text-center text-sm text-slate-500">
          <Link href="/hub" className="text-violet-300/90 hover:underline">
            Full platform chooser
          </Link>
        </p>
      </div>
    </section>
  );
}
