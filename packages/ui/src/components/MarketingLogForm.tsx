"use client";

import type { FormEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { cn } from "../lib/cn";

const PLATFORMS = [
  { id: "amazon_kdp", label: "Amazon KDP" },
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "facebook", label: "Facebook" },
  { id: "threads", label: "Threads" },
  { id: "twitter", label: "X (Twitter)" },
  { id: "bluesky", label: "Bluesky" },
  { id: "newsletter", label: "Newsletter" },
  { id: "other", label: "Other" },
] as const;

function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type MarketingLogFormProps = {
  supabase: SupabaseClient;
  tenantId: string;
  manuscriptId: string;
  className?: string;
  /** Called after a successful insert so the parent can reload dashboard data. */
  onRecorded?: () => void;
};

export function MarketingLogForm({ supabase, tenantId, manuscriptId, className, onRecorded }: MarketingLogFormProps) {
  const [recordedDate, setRecordedDate] = useState(todayIsoDate);
  const [platform, setPlatform] = useState<string>(PLATFORMS[0].id);
  const [interactions, setInteractions] = useState("0");
  const [comments, setComments] = useState("0");
  const [revenue, setRevenue] = useState("0");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const canSubmit = useMemo(() => Boolean(tenantId && manuscriptId && recordedDate && platform), [
    tenantId,
    manuscriptId,
    recordedDate,
    platform,
  ]);

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;
      setBusy(true);
      setMessage(null);
      try {
        const { error } = await supabase.from("p4_manual_marketing_data").insert({
          tenant_id: tenantId,
          manuscript_id: manuscriptId,
          recorded_date: recordedDate,
          platform,
          interaction_count: Math.max(0, Math.floor(Number(interactions) || 0)),
          comment_count: Math.max(0, Math.floor(Number(comments) || 0)),
          sales_revenue: Math.max(0, Number(revenue) || 0),
          notes: notes.trim() || null,
        });
        if (error) throw new Error(error.message);
        setMessage("Win logged — nice work.");
        setInteractions("0");
        setComments("0");
        setRevenue("0");
        setNotes("");
        onRecorded?.();
      } catch (err) {
        setMessage(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [canSubmit, supabase, tenantId, manuscriptId, recordedDate, platform, interactions, comments, revenue, notes, onRecorded]
  );

  return (
    <form
      onSubmit={onSubmit}
      className={cn("space-y-3 rounded-lg border border-amber-900/35 bg-amber-950/20 p-3", className)}
    >
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">Marketing log</p>
        <p className="text-xs text-amber-100/80">
          Record a win from your morning KDP or social check — we correlate it with HAL writing days on the same date.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-[10px] uppercase tracking-wide text-zinc-500">
          Date checked
          <input
            type="date"
            value={recordedDate}
            onChange={(ev) => setRecordedDate(ev.target.value)}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100"
          />
        </label>
        <label className="block text-[10px] uppercase tracking-wide text-zinc-500">
          Platform
          <select
            value={platform}
            onChange={(ev) => setPlatform(ev.target.value)}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100"
          >
            {PLATFORMS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <label className="block text-[10px] uppercase tracking-wide text-zinc-500">
          Interactions
          <input
            type="number"
            min={0}
            step={1}
            value={interactions}
            onChange={(ev) => setInteractions(ev.target.value)}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100"
          />
        </label>
        <label className="block text-[10px] uppercase tracking-wide text-zinc-500">
          Comments
          <input
            type="number"
            min={0}
            step={1}
            value={comments}
            onChange={(ev) => setComments(ev.target.value)}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100"
          />
        </label>
        <label className="block text-[10px] uppercase tracking-wide text-zinc-500">
          Sales revenue (USD)
          <input
            type="number"
            min={0}
            step="0.01"
            value={revenue}
            onChange={(ev) => setRevenue(ev.target.value)}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100"
          />
        </label>
      </div>

      <label className="block text-[10px] uppercase tracking-wide text-zinc-500">
        Notes (optional)
        <input
          type="text"
          value={notes}
          onChange={(ev) => setNotes(ev.target.value)}
          placeholder="e.g. Free promo ended, BookBub featured"
          className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={!canSubmit || busy}
          className="rounded-full border border-amber-500/50 bg-amber-600/90 px-4 py-1.5 text-xs font-semibold text-amber-950 disabled:opacity-40"
        >
          {busy ? "Saving…" : "Record a win"}
        </button>
        {message ? (
          <p className={cn("text-xs", message.startsWith("Win") ? "text-emerald-400" : "text-red-400")}>{message}</p>
        ) : null}
      </div>
    </form>
  );
}
