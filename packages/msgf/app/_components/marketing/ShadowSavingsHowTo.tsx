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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
import Link from "next/link";

import { MarketingSection } from "@/app/_components/marketing/MarketingSection";

const MSGF_HOST = "https://elphiesgatedai.elphiesyntax.com";

const OPENAI_SNIPPET = `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "${MSGF_HOST}/api/v1",
  defaultHeaders: {
    "x-msgf-mode": "shadow",
    "x-msgf-key": process.env.MSGF_LIVE_KEY!,
  },
});`;

const ANTHROPIC_SNIPPET = `import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  // SDK appends /v1/messages — use /api (not /api/v1) as baseURL.
  baseURL: "${MSGF_HOST}/api",
  defaultHeaders: {
    "x-msgf-mode": "shadow",
    "x-msgf-key": process.env.MSGF_LIVE_KEY!,
  },
});`;

const STEPS = [
  "Start a free trial — we mint your Shadow Proxy key. The 7-day clock starts on your first call (unused keys expire in 14 days).",
  "Point OpenAI or Anthropic SDK baseURL at MSGF with x-msgf-mode: shadow.",
  "Watch the proof ledger on your trial dashboard; get the email report when the window ends, then start 3-day Individual Pro full access.",
] as const;

export function ShadowSavingsHowTo() {
  return (
    <MarketingSection
      id="shadow-savings-how-to"
      variant="featured"
      eyebrow="Shadow mode"
      title="Prove projected savings in Shadow mode"
    >
      <p>
        Zero-latency pass-through to your provider. MSGF evaluates optimizations in the background
        and records projected savings — flip to Active when the ROI is credible.
      </p>

      <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-300 sm:text-base">
        {STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <div className="grid gap-4 lg:grid-cols-2">
        <figure className="overflow-hidden rounded-2xl border border-emerald-500/20 bg-slate-950/55">
          <figcaption className="border-b border-emerald-500/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300/85">
            OpenAI · baseURL …/api/v1
          </figcaption>
          <pre className="overflow-x-auto p-4 text-[11px] leading-relaxed text-slate-300 sm:text-xs">
            <code>{OPENAI_SNIPPET}</code>
          </pre>
        </figure>
        <figure className="overflow-hidden rounded-2xl border border-violet-500/20 bg-slate-950/55">
          <figcaption className="border-b border-violet-500/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-300/85">
            Anthropic · baseURL …/api
          </figcaption>
          <pre className="overflow-x-auto p-4 text-[11px] leading-relaxed text-slate-300 sm:text-xs">
            <code>{ANTHROPIC_SNIPPET}</code>
          </pre>
        </figure>
      </div>

      <p className="flex flex-wrap gap-x-3 gap-y-2 text-sm">
        <Link
          href="/shadow-trial"
          className="font-medium text-emerald-400 underline-offset-4 hover:underline"
        >
          Start free 7-day trial
        </Link>
        <span className="text-slate-600" aria-hidden>
          ·
        </span>
        <Link
          href="/dashboard#token-savings"
          className="font-medium text-emerald-400/80 underline-offset-4 hover:underline"
        >
          Token Savings (signed in)
        </Link>
        <span className="text-slate-600" aria-hidden>
          ·
        </span>
        <Link
          href="/getting-started"
          className="font-medium text-violet-300 underline-offset-4 hover:underline"
        >
          Full getting started
        </Link>
      </p>
    </MarketingSection>
  );
}
