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
 * Distribution Build ID: MSGF-b4602b0-20260519T165710Z-internal
 */
import Link from "next/link";

import { PublisherGrantService } from "@msgf/lib/PublisherGrantService";
import { createServiceRoleClient } from "@msgf/lib/supabase/service-role";

function asRec(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function extractLibrarianAnswer(rep: Record<string, unknown> | null | undefined): string | null {
  if (!rep) return null;
  const lib = asRec(rep["librarian"]);
  const ans = lib["answer"];
  return typeof ans === "string" ? ans : null;
}

function LinguisticDnaPreview({
  trajectory,
}: {
  trajectory: Array<{ craft: { ttr: number; sentenceComplexity: number } }>;
}) {
  const w = 360;
  const h = 128;
  const pad = 10;
  if (trajectory.length < 2) {
    return <p className="text-sm text-zinc-500">Not enough HAL-backed sessions to chart linguistic DNA.</p>;
  }
  const n = trajectory.length;
  const norm = (vals: number[]) => {
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const span = hi - lo || 1e-6;
    return vals.map((v) => (v - lo) / span);
  };
  const tNorm = norm(trajectory.map((p) => p.craft.ttr));
  const cNorm = norm(trajectory.map((p) => p.craft.sentenceComplexity));
  const line = (vals: number[]) =>
    vals
      .map((v, i) => {
        const x = pad + (i / Math.max(1, n - 1)) * (w - pad * 2);
        const y = pad + (1 - v) * (h - pad * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

  return (
    <div className="space-y-2">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="text-zinc-200" aria-hidden>
        <rect x={0} y={0} width={w} height={h} fill="rgb(24 24 27 / 0.5)" rx={8} />
        <polyline fill="none" stroke="rgb(212 175 55)" strokeWidth="2" points={line(tNorm)} />
        <polyline fill="none" stroke="rgb(148 163 184)" strokeWidth="2" points={line(cNorm)} />
      </svg>
      <div className="flex gap-6 text-xs text-zinc-500">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-400/90" /> TTR (normalized)
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-slate-400" /> Sentence complexity (normalized)
        </span>
      </div>
    </div>
  );
}

export default async function PublisherVerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let session: Awaited<ReturnType<PublisherGrantService["resolveVerifySession"]>>;
  try {
    const supabase = createServiceRoleClient();
    const grants = new PublisherGrantService(supabase);
    session = await grants.resolveVerifySession(token);
  } catch {
    return (
      <main className="mx-auto max-w-2xl space-y-6 px-6 py-16 text-center">
        <p className="text-sm text-red-400">Verify service is unavailable (check Supabase env).</p>
        <Link href="/" className="text-sm text-zinc-400 underline-offset-4 hover:underline">
          Home
        </Link>
      </main>
    );
  }

  if (!session.ok) {
    return (
      <main className="mx-auto max-w-lg space-y-6 px-6 py-20 text-center">
        <p className="font-serif text-2xl font-light tracking-wide text-zinc-200">Link unavailable</p>
        <p className="text-sm text-zinc-500">
          {session.reason === "invalid_or_expired"
            ? "This link is invalid or has expired."
            : "We could not validate this link."}
        </p>
        <Link href="/" className="text-sm text-amber-200/80 underline-offset-4 hover:underline">
          Return
        </Link>
      </main>
    );
  }

  const { level, metadata, manuscript_body } = session;
  const report = metadata.revision.latest_comprehensive_report;
  const librarian = extractLibrarianAnswer(report ?? undefined);

  const trajectory = Array.isArray(metadata.growth.craft_trajectory)
    ? (metadata.growth.craft_trajectory as Array<{ craft: { ttr: number; sentenceComplexity: number } }>)
    : [];

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-black text-zinc-100">
      <div className="border-b border-amber-900/25 bg-zinc-950/80">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <p className="font-serif text-xs font-medium uppercase tracking-[0.35em] text-amber-200/70">
            Confidential · Publisher preview
          </p>
          <span className="rounded-full border border-amber-600/40 bg-amber-950/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-100">
            Level {level} access
          </span>
        </div>
      </div>

      <article className="mx-auto max-w-4xl space-y-12 px-6 py-12">
        <header className="space-y-3 border-b border-zinc-800/80 pb-10">
          <h1 className="font-serif text-3xl font-light tracking-tight text-zinc-50 sm:text-4xl">
            {metadata.manuscript_title?.trim() || "Untitled manuscript"}
          </h1>
          <p className="text-sm text-zinc-500">
            {metadata.word_count.toLocaleString("en-US")} words · Linguistic DNA and audit materials are shared at every
            grant level. Manuscript prose is restricted below level 4.
          </p>
        </header>

        <section className="space-y-4 rounded-2xl border border-zinc-800/90 bg-zinc-900/35 p-6 shadow-[0_0_0_1px_rgba(212,175,55,0.06)]">
          <h2 className="font-serif text-lg font-normal text-amber-100/90">Linguistic DNA</h2>
          <p className="text-sm text-zinc-500">Craft trajectory from recent HAL sessions (type-token ratio vs complexity).</p>
          <LinguisticDnaPreview trajectory={trajectory} />
        </section>

        <section className="space-y-4 rounded-2xl border border-zinc-800/90 bg-zinc-900/35 p-6 shadow-[0_0_0_1px_rgba(212,175,55,0.06)]">
          <h2 className="font-serif text-lg font-normal text-amber-100/90">Consistency audit</h2>
          <p className="text-sm text-zinc-500">Latest comprehensive Librarian alignment report when auditing is complete.</p>
          {librarian ? (
            <pre className="max-h-[min(70vh,520px)] overflow-auto whitespace-pre-wrap rounded-xl border border-emerald-900/35 bg-emerald-950/20 p-4 text-xs leading-relaxed text-emerald-50/95">
              {librarian}
            </pre>
          ) : (
            <p className="text-sm text-zinc-500">
              No published comprehensive audit yet, or the manuscript is still in an earlier revision phase.
            </p>
          )}
        </section>

        <section className="space-y-4 rounded-2xl border border-zinc-800/90 bg-zinc-900/35 p-6">
          <h2 className="font-serif text-lg font-normal text-amber-100/90">Manuscript</h2>
          {level === 4 && manuscript_body != null && manuscript_body.trim() !== "" ? (
            <pre className="max-h-[min(80vh,640px)] overflow-auto whitespace-pre-wrap rounded-xl border border-zinc-800 bg-black/40 p-4 text-sm text-zinc-200">
              {manuscript_body}
            </pre>
          ) : (
            <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/80">
              <div className="pointer-events-none max-h-72 select-none blur-md">
                <p className="p-6 text-sm leading-8 text-zinc-300">
                  Lorem ipsum dolor sit amet. The full manuscript remains sealed at this grant tier. Upgrade to level 4
                  for prose disclosure to trusted partners.
                </p>
              </div>
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/65 px-6 text-center">
                <p className="text-sm font-medium text-zinc-200">
                  Manuscript body withheld at level {level}. <span className="text-amber-200/90">Level 4</span> unlocks
                  full text for this link.
                </p>
              </div>
            </div>
          )}
        </section>

        <footer className="border-t border-zinc-800/80 pt-8 text-center text-xs text-zinc-600">
          <Link href="/" className="text-amber-200/70 underline-offset-4 hover:underline">
            Elphie Syntax
          </Link>
          <span className="mx-2">·</span>
          <span>Do not forward. Access is logged.</span>
        </footer>
      </article>
    </main>
  );
}
