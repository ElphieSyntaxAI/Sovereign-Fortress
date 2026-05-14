import { useMemo } from "react";

export type ContinuityBreak = {
  type?: string;
  description?: string;
  manuscript_evidence?: string;
  canon_evidence?: string;
  severity?: string;
};

export type OutlineAdherenceRow = {
  outline_beat?: string;
  manuscript_status?: string;
  notes?: string;
};

export type RetrievalStats = {
  world_bible_chunks?: number;
  outline_chunks?: number;
  narrative_library_fallback?: boolean;
};

export type BicameralReportDashboardProps = {
  librarianSummary?: string | null;
  continuityBreaks: ContinuityBreak[];
  outlineAdherence: OutlineAdherenceRow[];
  criticSensitivityText: string | null;
  retrieval: RetrievalStats | null;
  onSealRevision: () => void | Promise<void>;
  isSealing: boolean;
  sealError: string | null;
  /** When false, Seal stays disabled (timer not complete). */
  canSeal: boolean;
};

function severityBadgeClass(sev: string | undefined): string {
  const s = String(sev ?? "low").toLowerCase();
  if (s === "high" || s === "critical") {
    return "border-rose-500/50 bg-rose-950/70 text-rose-100";
  }
  if (s === "medium" || s === "warn") {
    return "border-amber-500/45 bg-amber-950/60 text-amber-100";
  }
  return "border-emerald-500/40 bg-emerald-950/55 text-emerald-100";
}

function statusBadgeClass(status: string | undefined): string {
  const s = String(status ?? "").toLowerCase();
  if (s === "aligned") return "border-emerald-500/40 bg-emerald-950/50 text-emerald-100";
  if (s === "partial") return "border-amber-500/40 bg-amber-950/50 text-amber-100";
  if (s === "missing") return "border-zinc-500/40 bg-zinc-900/80 text-zinc-300";
  if (s === "contradicted") return "border-rose-500/45 bg-rose-950/55 text-rose-100";
  return "border-zinc-600 bg-zinc-900/70 text-zinc-300";
}

/**
 * Bicameral revision snapshot: Librarian (logic lists + severity), Critic (literary card), Vault retrieval stats,
 * and the **Seal the Revision** action (`POST /api/manuscripts/:id/unlock`).
 */
export function BicameralReportDashboard(props: BicameralReportDashboardProps) {
  const {
    librarianSummary,
    continuityBreaks,
    outlineAdherence,
    criticSensitivityText,
    retrieval,
    onSealRevision,
    isSealing,
    sealError,
    canSeal,
  } = props;

  const hasLibrarianPayload =
    continuityBreaks.length > 0 || outlineAdherence.length > 0 || Boolean(librarianSummary?.trim());

  const retrievalLine = useMemo(() => {
    if (!retrieval) return "Retrieval metrics not available for this pass.";
    const wb = Number(retrieval.world_bible_chunks ?? 0);
    const ol = Number(retrieval.outline_chunks ?? 0);
    const fb = Boolean(retrieval.narrative_library_fallback);
    const src = fb ? "narrative library fallback (lore / outline)" : "RAG World Bible + Outline vector lanes";
    return `${wb} World Bible chunks · ${ol} outline chunks · source: ${src}`;
  }, [retrieval]);

  return (
    <div className="mt-5 space-y-5 border-t border-emerald-500/25 pt-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-300/90">Bicameral audit</p>

      {/* Librarian */}
      <section className="rounded-xl border border-emerald-500/25 bg-zinc-950/80 p-4 ring-1 ring-emerald-500/15">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-emerald-50">Librarian — Logic</h3>
          <span className="text-[10px] uppercase tracking-wider text-emerald-400/80">Continuity & outline</span>
        </div>

        {!hasLibrarianPayload ? (
          <p className="mt-2 text-xs text-zinc-500">
            No structured continuity or outline rows yet — the Librarian pass may still be running, or canon/outline
            RAG lanes were empty.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {librarianSummary ? (
              <p className="rounded-lg border border-emerald-500/20 bg-emerald-950/30 px-3 py-2 text-xs italic leading-relaxed text-emerald-100/90">
                {librarianSummary}
              </p>
            ) : null}
            {continuityBreaks.length > 0 || outlineAdherence.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Continuity breaks</h4>
              <ul className="mt-2 space-y-2">
                {continuityBreaks.map((c, i) => (
                  <li
                    key={`cb-${i}`}
                    className="rounded-lg border border-zinc-800/90 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-200"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${severityBadgeClass(c.severity)}`}
                      >
                        {String(c.severity ?? "low")}
                      </span>
                      {c.type ? (
                        <span className="font-medium text-emerald-100/90">{c.type}</span>
                      ) : null}
                    </div>
                    {c.description ? <p className="mt-1.5 leading-relaxed text-zinc-300">{c.description}</p> : null}
                    {c.manuscript_evidence ? (
                      <p className="mt-1 border-l-2 border-emerald-500/30 pl-2 text-[11px] text-zinc-500">
                        <span className="text-zinc-600">Manuscript:</span> {c.manuscript_evidence}
                      </p>
                    ) : null}
                    {c.canon_evidence ? (
                      <p className="mt-1 border-l-2 border-teal-500/25 pl-2 text-[11px] text-zinc-500">
                        <span className="text-zinc-600">Canon:</span> {c.canon_evidence}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Outline adherence</h4>
              <ul className="mt-2 space-y-2">
                {outlineAdherence.map((o, i) => (
                  <li
                    key={`oa-${i}`}
                    className="rounded-lg border border-zinc-800/90 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-200"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-zinc-100">{o.outline_beat || "Beat"}</span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeClass(o.manuscript_status)}`}
                      >
                        {String(o.manuscript_status ?? "—")}
                      </span>
                    </div>
                    {o.notes ? <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">{o.notes}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>
            ) : null}
          </div>
        )}
      </section>

      {/* Critic */}
      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-fuchsia-200/85">Critic — Sensitivity</h3>
        <div
          className="mt-2 rounded-xl border border-amber-200/20 bg-gradient-to-br from-[#1c1410]/95 via-[#12100e]/95 to-zinc-950/90 p-5 shadow-[inset_0_1px_0_rgba(255,248,220,0.06)] ring-1 ring-amber-900/40"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.35em] text-amber-200/50">Sensitivity summary</p>
          {criticSensitivityText ? (
            <div className="mt-3 whitespace-pre-wrap text-[13px] leading-[1.75] text-[#f5e9d7]">
              {criticSensitivityText}
            </div>
          ) : (
            <p className="mt-3 text-sm italic text-amber-100/45">No Critic pass on file yet — sensitivity lane pending.</p>
          )}
        </div>
      </section>

      {/* Retrieval stats */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Vault retrieval</h3>
        <p className="mt-1 text-xs leading-relaxed text-zinc-300">{retrievalLine}</p>
        <p className="mt-1 text-[11px] text-zinc-500">
          Provenance for publisher-facing audit receipts — shows how deeply the Vault corpus was searched for this
          revision.
        </p>
      </section>

      {sealError ? (
        <p className="text-xs text-rose-300" role="alert">
          {sealError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-sm text-[11px] text-zinc-500">
          Sealing calls the Vault unlock RPC, persists cooldown completion, and returns the signed revision bundle to
          the dashboard.
        </p>
        <button
          type="button"
          disabled={!canSeal || isSealing}
          onClick={() => void onSealRevision()}
          className="rounded-lg border border-emerald-400/50 bg-emerald-600/90 px-5 py-2.5 text-sm font-semibold text-emerald-50 shadow-lg shadow-emerald-950/40 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSealing ? "Sealing…" : "Seal the Revision"}
        </button>
      </div>
    </div>
  );
}
