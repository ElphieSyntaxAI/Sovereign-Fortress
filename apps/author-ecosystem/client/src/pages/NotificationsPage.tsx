import { useCallback, useEffect, useState } from "react";

import { getPreferredBffBearer } from "../lib/authAccessToken";
import { bffAuthHeaders, bffCredentials, bffUrl } from "../lib/bffFetch";

type Notice = {
  id: string;
  title: string;
  body: string;
  at: string;
  kind: "info" | "alert" | "success";
};

export default function NotificationsPage() {
  const [items, setItems] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getPreferredBffBearer();
      const res = await fetch(bffUrl("/api/status"), { ...bffCredentials, headers: bffAuthHeaders(token) });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const notices: Notice[] = [];
      if (!res.ok) {
        notices.push({
          id: "status-err",
          title: "Connection",
          body: String(data.error ?? "Could not reach Author BFF."),
          at: new Date().toISOString(),
          kind: "alert",
        });
      } else {
        const mapping = data.msgf_mapping as Record<string, unknown> | undefined;
        if (mapping?.ready === false) {
          notices.push({
            id: "msgf-warn",
            title: "MSGF bridge",
            body: `Mapping incomplete: ${Array.isArray(mapping.missing) ? (mapping.missing as string[]).join(", ") : "check env"}.`,
            at: new Date().toISOString(),
            kind: "alert",
          });
        } else {
          notices.push({
            id: "msgf-ok",
            title: "MSGF connected",
            body: "Pulse and pillar health proxies are ready for this session.",
            at: new Date().toISOString(),
            kind: "success",
          });
        }
      }
      setItems(notices);
    } catch (e) {
      setItems([
        {
          id: "net",
          title: "Offline",
          body: e instanceof Error ? e.message : "Network error",
          at: new Date().toISOString(),
          kind: "alert",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-zinc-400">
            System alerts, MSGF sync status, and revision locks (inbox expansion planned).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900"
        >
          Refresh
        </button>
      </header>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li
              key={n.id}
              className={[
                "rounded-lg border px-4 py-3 text-sm",
                n.kind === "alert"
                  ? "border-amber-900/50 bg-amber-950/30 text-amber-100"
                  : n.kind === "success"
                    ? "border-emerald-900/50 bg-emerald-950/30 text-emerald-100"
                    : "border-zinc-800 bg-zinc-950/50 text-zinc-200",
              ].join(" ")}
            >
              <p className="font-medium">{n.title}</p>
              <p className="mt-0.5 text-xs opacity-90">{n.body}</p>
              <p className="mt-1 text-[10px] opacity-60">{new Date(n.at).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
