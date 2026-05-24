import { useCallback, useEffect, useState } from "react";

import { bffCredentials, bffUrl, formatBffFetchError } from "../lib/bffFetch";

type MsgfMapping = {
  tenant_id?: string;
  msgf_app_url?: string | null;
  ready?: boolean;
  missing?: string[];
  hal_pulse_enabled?: boolean;
};

export function MsgfConnectionStatus() {
  const [mapping, setMapping] = useState<MsgfMapping | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(bffUrl("/api/status"), { ...bffCredentials });
      const data = (await res.json()) as { msgf_mapping?: MsgfMapping; error?: string };
      if (!res.ok) throw new Error(data.error ?? `Status failed (${res.status})`);
      setMapping(data.msgf_mapping ?? null);
    } catch (e) {
      setError(formatBffFetchError(e, "/api/status"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <pre className="whitespace-pre-wrap rounded-lg border border-amber-900/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
        {error}
      </pre>
    );
  }

  if (!mapping) return null;

  const ready = mapping.ready === true;
  const tenant = mapping.tenant_id ?? "author_ecosystem";

  return (
    <div
      className={[
        "rounded-lg border px-3 py-2 text-xs",
        ready
          ? "border-emerald-800/50 bg-emerald-950/25 text-emerald-100"
          : "border-amber-800/50 bg-amber-950/25 text-amber-100",
      ].join(" ")}
    >
      <p className="font-medium">
        {ready ? "MSGF linked" : "MSGF bridge incomplete"} · tenant{" "}
        <span className="font-mono text-[11px]">{tenant}</span>
      </p>
      <p className="mt-1 text-[11px] opacity-90">
        {ready
          ? `HAL chunks (175w / 10 overlap) sync to ${mapping.msgf_app_url ?? "MSGF"} when you sign sessions.`
          : `Set on the Author BFF: ${(mapping.missing ?? []).join(", ") || "see server .env.example"}.`}
        {mapping.hal_pulse_enabled === false ? " HAL→MSGF sync is disabled (MSGF_AUTHOR_HAL_PULSE_ENABLED=0)." : null}
      </p>
    </div>
  );
}
