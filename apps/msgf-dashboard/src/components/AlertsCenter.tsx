import { useEffect, useMemo, useState } from "react";
import { ConsensusView } from "@elphie-syntax/ui";
import {
  JIRA_BRIDGE_HOST_IDENTITY,
  alertUsesCanonicalBridge,
  sourceDomainFromAlert,
} from "../lib/alertBridge";
import type { LogicAlert } from "../data/mockAlerts";

type SourceFilter = "all" | string;

export function AlertsCenter({ alerts }: { alerts: LogicAlert[] }) {
  const [bridgeOnly, setBridgeOnly] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  const sources = useMemo(() => {
    const s = new Set<string>();
    for (const a of alerts) {
      const d = sourceDomainFromAlert(a.description, a.bridgeIdentityHeader);
      if (d) s.add(d);
    }
    return [...s].sort();
  }, [alerts]);

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (bridgeOnly && !alertUsesCanonicalBridge(a.description, a.bridgeIdentityHeader)) {
        return false;
      }
      if (sourceFilter === "all") return true;
      const dom = sourceDomainFromAlert(a.description, a.bridgeIdentityHeader);
      return dom === sourceFilter;
    });
  }, [alerts, bridgeOnly, sourceFilter]);

  const [openId, setOpenId] = useState<string | null>(filtered[0]?.id ?? null);
  const open = filtered.find((a) => a.id === openId) ?? filtered[0];

  useEffect(() => {
    if (!filtered.some((a) => a.id === openId)) {
      setOpenId(filtered[0]?.id ?? null);
    }
  }, [filtered, openId]);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Master admin — logic alerts</h2>
          <p className="text-xs text-zinc-500">
            Filter using{" "}
            <code className="text-zinc-400">{JIRA_BRIDGE_HOST_IDENTITY}</code> bridge
            identity and parsed <code className="text-zinc-400">source:</code> host.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={bridgeOnly}
              onChange={(e) => setBridgeOnly(e.target.checked)}
              className="rounded border-zinc-600"
            />
            Bridge identity only
          </label>
          <label className="text-xs text-zinc-500">
            Source
            <select
              className="ml-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
            >
              <option value="all">All</option>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <ul className="max-h-[22rem] space-y-1 overflow-y-auto rounded-lg border border-zinc-800/80 p-1">
          {filtered.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => setOpenId(a.id)}
                className={`w-full rounded-md px-2 py-2 text-left text-xs transition ${
                  open?.id === a.id
                    ? "bg-zinc-800 text-zinc-50"
                    : "text-zinc-400 hover:bg-zinc-900"
                }`}
              >
                <div className="font-medium text-zinc-200">{a.summary}</div>
                <div className="mt-0.5 font-mono text-[10px] text-zinc-500">
                  {sourceDomainFromAlert(a.description, a.bridgeIdentityHeader) ?? "—"}
                </div>
              </button>
            </li>
          ))}
        </ul>

        {open ? (
          <ConsensusView
            heading={`${open.id} · ${open.summary}`}
            jiraBridgeIdentity={
              open.bridgeIdentityHeader ?? JIRA_BRIDGE_HOST_IDENTITY
            }
            reportingSourceHost={
              sourceDomainFromAlert(open.description, open.bridgeIdentityHeader) ??
              undefined
            }
            modelA={{
              name: "Inbound payload (trimmed)",
              content: open.description.slice(0, 1200),
              footer: `Reported ${new Date(open.reportedAt).toLocaleString()}`,
            }}
            modelB={{
              name: "Bridge filter context",
              content: `bridge-only: ${bridgeOnly}\nsource filter: ${sourceFilter}\n\nHeader ${"x-msgf-jira-bridge-identity"}:\n${open.bridgeIdentityHeader ?? "(from description parse)"}`,
              footer: `Canonical bridge host: ${JIRA_BRIDGE_HOST_IDENTITY}`,
            }}
          />
        ) : (
          <p className="text-sm text-zinc-500">No alerts match filters.</p>
        )}
      </div>
    </section>
  );
}
