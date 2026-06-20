import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { getPreferredBffBearer } from "../lib/authAccessToken";
import { bffAuthHeaders, bffCredentials, bffUrl } from "../lib/bffFetch";

type OAuthStatus = {
  configured: boolean;
  connected: boolean;
  google_email: string | null;
};

export function GoogleOAuthConnectPanel(props: {
  /** OAuth return path on the Author app (default /manuscripts). */
  returnPath?: string;
  manuscriptId?: string;
  /** Called after status reload (e.g. post-connect redirect). */
  onStatusChange?: () => void;
  /** Hide the connected-state banner (parent shows its own). */
  hideWhenConnected?: boolean;
  className?: string;
}) {
  const returnPath = props.returnPath ?? "/manuscripts";
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<OAuthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getPreferredBffBearer();
      const res = await fetch(bffUrl("/api/google/oauth/status"), {
        ...bffCredentials,
        headers: bffAuthHeaders(token),
      });
      const json = (await res.json().catch(() => ({}))) as Partial<OAuthStatus> & {
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || res.statusText);
      setStatus({
        configured: json.configured !== false,
        connected: Boolean(json.connected),
        google_email: json.google_email ?? null,
      });
    } catch {
      setStatus({ configured: false, connected: false, google_email: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (searchParams.get("google") !== "connected") return;
    const next = new URLSearchParams(searchParams);
    next.delete("google");
    next.delete("manuscript_id");
    setSearchParams(next, { replace: true });
    void loadStatus().then(() => props.onStatusChange?.());
  }, [searchParams, setSearchParams, loadStatus, props.onStatusChange]);

  const connectGoogle = () => {
    const q = props.manuscriptId
      ? `&manuscript_id=${encodeURIComponent(props.manuscriptId)}`
      : "";
    window.location.href = bffUrl(
      `/api/google/oauth/start?return_to=${encodeURIComponent(returnPath)}${q}`
    );
  };

  if (loading) {
    return <p className={`text-xs text-zinc-500 ${props.className ?? ""}`}>Checking Google account…</p>;
  }

  if (!status?.configured) {
    return (
      <p className={`text-xs text-amber-300/90 ${props.className ?? ""}`}>
        Google Drive picker is not configured on this server. You can still upload PDF, DOCX, or TXT files.
      </p>
    );
  }

  if (status.connected) {
    if (props.hideWhenConnected) return null;
    return (
      <p className={`text-xs text-emerald-400/90 ${props.className ?? ""}`}>
        Google connected{status.google_email ? ` as ${status.google_email}` : ""}.
      </p>
    );
  }

  return (
    <div className={`space-y-2 ${props.className ?? ""}`}>
      <p className="text-xs text-amber-200/90">
        Connect Google to browse Drive and link docs for HAL, imports, and drafting.
      </p>
      <button
        type="button"
        onClick={connectGoogle}
        className="rounded-full border border-amber-500/50 bg-amber-700/80 px-4 py-1.5 text-xs font-semibold text-amber-50 hover:bg-amber-600/90"
      >
        Connect Google account
      </button>
    </div>
  );
}

/** Hook for parent components that track connected state in their own UI. */
export function useGoogleOAuthStatus() {
  const [connected, setConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);

  const refresh = useCallback(async () => {
    const token = await getPreferredBffBearer();
    const res = await fetch(bffUrl("/api/google/oauth/status"), {
      ...bffCredentials,
      headers: bffAuthHeaders(token),
    });
    const json = (await res.json().catch(() => ({}))) as Partial<OAuthStatus>;
    setConfigured(json.configured !== false);
    setConnected(Boolean(json.connected));
    setGoogleEmail(json.google_email ?? null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { connected, googleEmail, configured, refresh };
}
