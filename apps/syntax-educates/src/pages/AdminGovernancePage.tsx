/**
 * Tech Admin — Utah / FERPA governance snapshot.
 */
import { useEffect, useState } from "react";

import { PillarBadge } from "@elphie-syntax/ui";

import { msgfFetch, msgfBaseUrl } from "../lib/msgfClient";
import { buildEducatesAdminMsgfLinks } from "@elphie-syntax/core/educates-admin-msgf-links";

type Snapshot = {
  legalVersion: string;
  disclosurePolicyId: string;
  hb273: { autoGradeForbidden: boolean; iepMutationForbidden: boolean };
  defaults: {
    maxAiAllowanceLevel: number;
    retentionDaysHint: number;
    ferpaMode: string;
    coppaMode: string;
  };
  attestationCount30d: number;
  activeCatalogTitles: number;
  activeLessons: number;
  disclosureCopyPreview: { title: string; summary: string };
  trustedResearchDomains?: string[];
  trustedResearchDomainsSource?: "env" | "platform_defaults";
};

export function AdminGovernancePage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const msgfLinks = buildEducatesAdminMsgfLinks(msgfBaseUrl());

  useEffect(() => {
    void (async () => {
      try {
        const json = await msgfFetch<{ snapshot: Snapshot }>(
          "/api/msgf/education/admin/governance",
          { persona: "admin" }
        );
        setSnapshot(json.snapshot);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  return (
    <div className="px-6 py-6">
      <header className="mb-6 flex items-center gap-3">
        <PillarBadge lineageLabel="P1" pillar="P1" />
        <h1 className="text-xl font-semibold">Admin legal governance</h1>
      </header>

      {error && <p className="text-sm text-rose-400">{error}</p>}
      {!snapshot && !error && (
        <p className="text-sm text-zinc-500">Loading governance snapshot…</p>
      )}

      {snapshot && (
        <div className="max-w-3xl space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Legal version" value={snapshot.legalVersion} />
            <Stat label="Disclosures (30d)" value={String(snapshot.attestationCount30d)} />
            <Stat label="Catalog titles" value={String(snapshot.activeCatalogTitles)} />
            <Stat label="Lessons" value={String(snapshot.activeLessons)} />
          </div>

          <section className="rounded border border-zinc-800 bg-zinc-900/50 p-4 text-sm">
            <h2 className="mb-2 text-xs uppercase tracking-wider text-zinc-500">
              Hard rules (always on)
            </h2>
            <ul className="list-disc space-y-1 pl-5 text-zinc-300">
              <li>S.B. 149 disclosure required before AI / HAL Lite ({snapshot.disclosurePolicyId})</li>
              <li>
                H.B. 273 auto-grade:{" "}
                {snapshot.hb273.autoGradeForbidden ? "forbidden" : "allowed"}
              </li>
              <li>
                H.B. 273 IEP mutation:{" "}
                {snapshot.hb273.iepMutationForbidden ? "forbidden" : "allowed"}
              </li>
              <li>FERPA mode: {snapshot.defaults.ferpaMode}</li>
              <li>COPPA: {snapshot.defaults.coppaMode}</li>
              <li>Max AI allowance envelope: L{snapshot.defaults.maxAiAllowanceLevel}</li>
              <li>Retention hint: {snapshot.defaults.retentionDaysHint} days</li>
            </ul>
          </section>

          <section className="rounded border border-zinc-800 p-4 text-sm text-zinc-400">
            <h2 className="mb-1 text-xs uppercase tracking-wider text-zinc-500">
              Student-facing disclosure preview
            </h2>
            <p className="font-medium text-zinc-200">{snapshot.disclosureCopyPreview.title}</p>
            <p className="mt-1">{snapshot.disclosureCopyPreview.summary}</p>
          </section>

          <section className="rounded border border-zinc-800 bg-zinc-900/50 p-4 text-sm">
            <h2 className="mb-2 text-xs uppercase tracking-wider text-zinc-500">
              Trusted research domains (Citation Hall)
            </h2>
            <p className="mb-2 text-xs text-zinc-500">
              Source: {snapshot.trustedResearchDomainsSource ?? "platform_defaults"}
              {snapshot.trustedResearchDomainsSource === "env"
                ? " (EDUCATION_TRUSTED_DOMAINS)"
                : " — override via EDUCATION_TRUSTED_DOMAINS"}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(snapshot.trustedResearchDomains ?? []).slice(0, 24).map((d) => (
                <span
                  key={d}
                  className="rounded border border-zinc-700 bg-zinc-950 px-2 py-0.5 font-mono text-[11px] text-zinc-300"
                >
                  {d}
                </span>
              ))}
            </div>
          </section>

          <section className="rounded border border-cyan-900/40 bg-cyan-950/20 p-4 text-sm">
            <h2 className="mb-2 text-xs uppercase tracking-wider text-cyan-400/90">
              MSGF governance (tenant {msgfLinks.tenant_id})
            </h2>
            <p className="mb-3 text-xs text-zinc-500">
              Same audit hub / Session Replay / fitness surfaces as MSGF Ops — scoped to Educates.
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["Ops console", msgfLinks.ops_console],
                  ["Audit hub", msgfLinks.audit_hub],
                  ["Session Replay", msgfLinks.session_replay],
                  ["Model fitness", msgfLinks.model_fitness],
                  ["SIEM", msgfLinks.siem_integrations],
                  ["Dashboard", msgfLinks.governance_dashboard],
                ] as const
              ).map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded border border-cyan-800/60 bg-zinc-950 px-2.5 py-1 text-xs text-cyan-100 hover:border-cyan-500/70"
                >
                  {label} ↗
                </a>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Stat(props: { label: string; value: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{props.label}</div>
      <div className="truncate text-sm text-zinc-100">{props.value}</div>
    </div>
  );
}
