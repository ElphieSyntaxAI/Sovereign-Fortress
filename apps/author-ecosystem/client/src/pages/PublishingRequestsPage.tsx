import { useCallback, useEffect, useState } from "react";

import { BusinessPageHeader } from "../components/BusinessPageHeader";
import { ManuscriptRequiredBanner } from "../components/ManuscriptRequiredBanner";
import { useDashboardLoadView } from "../hooks/useDashboardLoadView";
import { getPreferredBffBearer } from "../lib/authAccessToken";
import { useNarrative } from "../context/NarrativeContext";

type MarketplaceSlice = {
  publishing_intent?: string;
  is_seeking_agent?: boolean;
  show_helper_hub?: boolean;
  show_publisher_hub?: boolean;
};

type InterestMetrics = {
  total_interactions?: number;
  like_count?: number;
  track_count?: number;
  unique_interested_parties?: number;
};

export default function PublishingRequestsPage() {
  const { selection } = useNarrative();
  const [marketplace, setMarketplace] = useState<MarketplaceSlice | null>(null);
  const [interest, setInterest] = useState<InterestMetrics | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const manuscriptId = selection?.manuscriptId ?? "";
  const loadView = useDashboardLoadView(manuscriptId || " ");

  const load = useCallback(async () => {
    if (!selection?.manuscriptId) return;
    setLoading(true);
    setErr(null);
    try {
      await getPreferredBffBearer();
      const payload = await loadView("PLANNING");
      const data = payload.data as Record<string, unknown>;
      const mp = data.marketplace as MarketplaceSlice | undefined;
      const mi = data.marketplace_interest as InterestMetrics | undefined;
      setMarketplace(mp ?? null);
      setInterest(mi ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load publishing signals.");
    } finally {
      setLoading(false);
    }
  }, [selection?.manuscriptId, loadView]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <BusinessPageHeader
        title="Publishing requests"
        description="What agents and publishers see — anonymized interest, intent, and hub visibility for"
      />

      {!selection ? <ManuscriptRequiredBanner /> : null}

      {loading ? <p className="text-sm text-zinc-500">Loading marketplace signals…</p> : null}
      {err ? <p className="text-sm text-red-400">{err}</p> : null}

      {selection && marketplace ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-300/90">
                Publishing intent
              </p>
              <p className="mt-2 text-2xl font-semibold text-amber-50">
                {marketplace.publishing_intent ?? "UNDECIDED"}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {marketplace.is_seeking_agent
                  ? "Actively seeking representation."
                  : "Not flagged for agent outreach."}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Hub visibility
              </p>
              <ul className="mt-2 space-y-1 text-sm text-zinc-300">
                <li>
                  Publisher hub:{" "}
                  <span className={marketplace.show_publisher_hub ? "text-emerald-400" : "text-zinc-600"}>
                    {marketplace.show_publisher_hub ? "visible" : "hidden"}
                  </span>
                </li>
                <li>
                  Helper hub:{" "}
                  <span className={marketplace.show_helper_hub ? "text-emerald-400" : "text-zinc-600"}>
                    {marketplace.show_helper_hub ? "visible" : "hidden"}
                  </span>
                </li>
              </ul>
              <p className="mt-2 text-[10px] text-zinc-600">
                TRADITIONAL path hides helpers; SELF path hides publisher scouting.
              </p>
            </div>
          </section>

          <section className="rounded-xl border border-sky-900/40 bg-sky-950/25 p-4">
            <h2 className="text-sm font-semibold text-sky-100">Anonymized interest (competition-safe)</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Counts only — no identities. Agents and publishers express LIKE / TRACK on your WIP card.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <Stat label="Total touches" value={interest?.total_interactions ?? 0} />
              <Stat label="Likes" value={interest?.like_count ?? 0} />
              <Stat label="Tracks" value={interest?.track_count ?? 0} />
              <Stat label="Unique parties" value={interest?.unique_interested_parties ?? 0} />
            </div>
          </section>

          <section className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 text-sm text-zinc-400">
            <h2 className="font-semibold text-zinc-200">Publisher Hub preview</h2>
            <p className="mt-2">
              Your card shows HAL score bands, genre, and blurb — never full manuscript text. Update intent on the
              Outline or Revision passes when your pitch is ready.
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-100">{value}</p>
    </div>
  );
}
