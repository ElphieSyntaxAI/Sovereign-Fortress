import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { VAULT_PACT_ATTESTATION_PHRASE } from "../legal/vaultPactAttestation";
import { bffAuthHeaders, bffCredentials, bffUrl } from "../lib/bffFetch";

export type VaultAttestationStatus = "signed" | "unsigned" | "outdated";

type StatusPayload = {
  status: VaultAttestationStatus | string;
  doc_slug?: string;
  reason?: string;
};

type UiPhase = "loading" | "ready" | "session_expired" | "fetch_error";

export type VaultProtectorProps = {
  children: ReactNode;
  /** Optional bearer token (extensions / CLI); cookies still sent with `credentials: "include"`. */
  getAccessToken?: () => string | null | Promise<string | null>;
};

async function resolveToken(getAccessToken?: VaultProtectorProps["getAccessToken"]): Promise<string | null> {
  if (!getAccessToken) return null;
  const t = await getAccessToken();
  return typeof t === "string" && t.trim() !== "" ? t.trim() : null;
}

/**
 * Wraps dashboard (or other) routes: on mount, checks Vault Pact attestation via the BFF.
 * If the user is **unsigned** or **outdated**, renders a full-screen modal until they re-attest.
 */
export default function VaultProtector(props: VaultProtectorProps) {
  const { children, getAccessToken } = props;
  const [phase, setPhase] = useState<UiPhase>("loading");
  const [status, setStatus] = useState<VaultAttestationStatus | null>(null);
  const [noProfile, setNoProfile] = useState(false);
  const [phraseInput, setPhraseInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const blocking = status === "unsigned" || status === "outdated";

  const loadStatus = useCallback(async () => {
    setPhase("loading");
    setSubmitError(null);
    const token = await resolveToken(getAccessToken);
    const headers: Record<string, string> = {
      accept: "application/json",
      ...bffAuthHeaders(token),
    };
    const res = await fetch(bffUrl("/api/legal/vault-attestation-status"), {
      method: "GET",
      headers,
      ...bffCredentials,
    });
    if (res.status === 401) {
      setPhase("session_expired");
      setStatus(null);
      return;
    }
    if (!res.ok) {
      setPhase("fetch_error");
      setStatus(null);
      return;
    }
    const json = (await res.json()) as StatusPayload;
    const s = json.status;
    if (s === "signed" || s === "unsigned" || s === "outdated") {
      setStatus(s);
      setNoProfile(json.reason === "no_profile");
      setPhase("ready");
      return;
    }
    setPhase("fetch_error");
    setStatus(null);
  }, [getAccessToken]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!blocking) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [blocking]);

  const canSubmit =
    phraseInput.trim() === VAULT_PACT_ATTESTATION_PHRASE && !submitting && phase === "ready" && blocking;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const token = await resolveToken(getAccessToken);
      const res = await fetch(bffUrl("/api/legal/vault-pact-attest"), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          ...bffAuthHeaders(token),
        },
        ...bffCredentials,
        body: JSON.stringify({ vault_pact_signature: VAULT_PACT_ATTESTATION_PHRASE }),
      });
      const json = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) {
        setSubmitError(json.message ?? json.error ?? `Request failed (${res.status})`);
        return;
      }
      setPhraseInput("");
      await loadStatus();
    } finally {
      setSubmitting(false);
    }
  };

  if (phase === "loading") {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-zinc-950 text-zinc-200">
        <p className="text-sm tracking-wide text-zinc-400">Checking Vault Pact status…</p>
      </div>
    );
  }

  if (phase === "session_expired") {
    return (
      <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-4 bg-zinc-950 p-6 text-center text-zinc-200">
        <p className="max-w-md text-sm text-zinc-400">Your session has expired. Sign in again to open the dashboard.</p>
        <Link to="/" className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-100 hover:bg-zinc-900">
          Back to sign in
        </Link>
      </div>
    );
  }

  if (phase === "fetch_error") {
    return (
      <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-4 bg-zinc-950 p-6 text-center text-zinc-200">
        <p className="max-w-md text-sm text-zinc-400">Could not verify Vault Pact attestation.</p>
        <button
          type="button"
          className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-100 hover:bg-zinc-900"
          onClick={() => void loadStatus()}
        >
          Retry
        </button>
      </div>
    );
  }

  if (blocking) {
    const headline =
      status === "outdated" ? "Vault Pact updated — re-attestation required" : "Vault Pact signature required";

    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/95 p-4 text-zinc-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vault-protector-title"
      >
        <div className="w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl shadow-black/60">
          <h1 id="vault-protector-title" className="text-lg font-semibold tracking-tight text-white">
            {headline}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Access to the dashboard is locked until your account attests to the current bilateral Vault Pact. Read the
            full text, then type the exact legal phrase below to enable Submit.
          </p>
          {noProfile ? (
            <p className="mt-3 rounded-md border border-amber-900/60 bg-amber-950/40 p-3 text-xs text-amber-100/90">
              No Supabase profile is linked to this login yet. Submit may fail until onboarding creates your{" "}
              <code className="rounded bg-zinc-950 px-1">profiles</code> row.
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <Link to="/vault-pact" className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300">
              Open Vault Pact
            </Link>
            <Link to="/" className="text-zinc-400 underline underline-offset-2 hover:text-zinc-200">
              Leave dashboard
            </Link>
          </div>
          <label className="mt-6 block text-xs font-medium uppercase tracking-wide text-zinc-500">
            Type the attestation phrase exactly
          </label>
          <input
            type="text"
            autoComplete="off"
            spellCheck={false}
            className="mt-2 w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-700/40 focus:ring-2"
            placeholder={VAULT_PACT_ATTESTATION_PHRASE}
            value={phraseInput}
            onChange={(e) => setPhraseInput(e.target.value)}
          />
          {submitError ? <p className="mt-2 text-xs text-red-400">{submitError}</p> : null}
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void onSubmit()}
            className="mt-5 w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
          >
            {submitting ? "Submitting…" : "Submit attestation"}
          </button>
        </div>
      </div>
    );
  }

  if (status === "signed") {
    return <>{children}</>;
  }

  return null;
}
