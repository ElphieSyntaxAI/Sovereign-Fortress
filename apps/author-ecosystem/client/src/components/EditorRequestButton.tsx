import { useCallback, useEffect, useState } from "react";

import { bffAuthHeaders, bffCredentials } from "../lib/bffFetch";

const FALLBACK_REQUIREMENTS =
  "Editor hub unlock requires: (1) p4_manuscripts.revision_count >= 2, and (2) the latest p4_revision_reports row must have report_json.continuity_score >= 0.78.";

type EditorRequestGateResponse = {
  ok?: boolean;
  requirements_tooltip?: string;
  is_manuscript_quality_verified?: boolean;
  reason?: string;
  error?: string;
};

export type EditorRequestButtonProps = {
  manuscriptId: string;
  getAccessToken: () => string | null | Promise<string | null>;
  /** Optional label override. */
  label?: string;
};

/**
 * Editor hub entry control: enabled only when the BFF reports manuscript quality verified
 * (`revision_count` + latest `p4_revision_reports.report_json.continuity_score`).
 */
export function EditorRequestButton(props: EditorRequestButtonProps) {
  const { manuscriptId, getAccessToken, label = "Request editor (hub)" } = props;
  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [verified, setVerified] = useState(false);
  const [requirementsTooltip, setRequirementsTooltip] = useState(FALLBACK_REQUIREMENTS);
  const [err, setErr] = useState<string | null>(null);

  const id = manuscriptId.trim();
  const canQuery = Boolean(id);

  const load = useCallback(async () => {
    if (!canQuery) {
      setPhase("ready");
      setVerified(false);
      setRequirementsTooltip(FALLBACK_REQUIREMENTS);
      setErr(null);
      return;
    }
    setPhase("loading");
    setErr(null);
    try {
      const token = await getAccessToken();
      const url = `/api/manuscripts/${encodeURIComponent(id)}/editor-request-gate`;
      const res = await fetch(url, { ...bffCredentials, headers: bffAuthHeaders(token) });
      const json = (await res.json().catch(() => ({}))) as EditorRequestGateResponse;
      if (!res.ok) {
        throw new Error(json.error || res.statusText);
      }
      setRequirementsTooltip(
        typeof json.requirements_tooltip === "string" && json.requirements_tooltip.trim()
          ? json.requirements_tooltip.trim()
          : FALLBACK_REQUIREMENTS
      );
      setVerified(json.is_manuscript_quality_verified === true);
      setPhase("ready");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setVerified(false);
      setPhase("error");
    }
  }, [canQuery, getAccessToken, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const disabled = !canQuery || phase === "loading" || phase === "error" || !verified;
  const title =
    disabled && canQuery && phase === "ready"
      ? requirementsTooltip
      : disabled && phase === "loading"
        ? "Checking editor hub requirements…"
        : disabled && phase === "error" && err
          ? err
          : undefined;

  return (
    <div className="flex flex-col items-end gap-1">
      {phase === "error" && err ? (
        <button
          type="button"
          onClick={() => void load()}
          className="text-xs text-amber-300/90 underline decoration-dotted underline-offset-2"
        >
          Retry gate check
        </button>
      ) : null}
      <button
        type="button"
        disabled={disabled}
        title={title}
        onClick={() => {
          if (disabled) return;
          // Hub navigation / mutation can be wired when the editor assignment flow exists.
        }}
        className="rounded-full border border-violet-600/70 bg-violet-950/50 px-3 py-1.5 text-xs font-medium text-violet-100 hover:bg-violet-900/60 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {phase === "loading" ? "Checking…" : label}
      </button>
    </div>
  );
}
