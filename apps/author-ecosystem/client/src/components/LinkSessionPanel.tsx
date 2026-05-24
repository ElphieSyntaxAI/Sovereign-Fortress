import { useCallback, useEffect, useState } from "react";

import { getPreferredBffBearer } from "../lib/authAccessToken";
import { bffAuthHeaders, bffCredentials, bffUrl } from "../lib/bffFetch";
import { displayTitle, type HubManuscript } from "../lib/manuscriptTypes";

type LinkSession = {
  id: string;
  status: string;
  google_doc_id?: string | null;
  google_doc_title?: string | null;
  google_doc_url?: string | null;
  reported_at?: string | null;
  expires_at: string;
};

export function LinkSessionPanel(props: {
  row: HubManuscript;
  googleConnected: boolean;
  onLinked: () => void;
}) {
  const [session, setSession] = useState<LinkSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const api = useCallback(
    async (path: string, init?: RequestInit) => {
      const token = await getPreferredBffBearer();
      const res = await fetch(bffUrl(path), {
        ...bffCredentials,
        ...init,
        headers: {
          ...bffAuthHeaders(token),
          ...(init?.body ? { "Content-Type": "application/json" } : {}),
          ...init?.headers,
        },
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || res.statusText);
      return json;
    },
    []
  );

  const pollSession = useCallback(
    async (sessionId: string) => {
      const json = (await api(
        `/api/manuscripts/${encodeURIComponent(props.row.id)}/link-session/${encodeURIComponent(sessionId)}`
      )) as { session: LinkSession };
      setSession(json.session);
      try {
        localStorage.setItem("elphie_active_link_session_id", sessionId);
        localStorage.setItem("elphie_active_link_manuscript_id", props.row.id);
      } catch {
        /* ignore */
      }
      return json.session;
    },
    [api, props.row.id]
  );

  useEffect(() => {
    try {
      const sid = localStorage.getItem("elphie_active_link_session_id");
      const mid = localStorage.getItem("elphie_active_link_manuscript_id");
      if (sid && mid === props.row.id) {
        void pollSession(sid).catch(() => {});
      }
    } catch {
      /* ignore */
    }
  }, [props.row.id, pollSession]);

  useEffect(() => {
    if (!session?.id || session.status === "confirmed" || session.status === "expired") return;
    const t = window.setInterval(() => {
      void pollSession(session.id).catch(() => {});
    }, 2500);
    return () => window.clearInterval(t);
  }, [session?.id, session?.status, pollSession]);

  const startSession = async () => {
    setBusy(true);
    setError(null);
    try {
      const json = (await api(`/api/manuscripts/${encodeURIComponent(props.row.id)}/link-session`, {
        method: "POST",
      })) as { session: LinkSession };
      setSession(json.session);
      await pollSession(json.session.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmLink = async () => {
    if (!session?.id) return;
    setBusy(true);
    setError(null);
    try {
      await api(
        `/api/manuscripts/${encodeURIComponent(props.row.id)}/link-session/${encodeURIComponent(session.id)}/confirm`,
        { method: "POST" }
      );
      try {
        localStorage.removeItem("elphie_active_link_session_id");
        localStorage.removeItem("elphie_active_link_manuscript_id");
      } catch {
        /* ignore */
      }
      props.onLinked();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const connectGoogle = () => {
    const returnTo = `/manuscripts`;
    window.location.href = bffUrl(
      `/api/google/oauth/start?return_to=${encodeURIComponent(returnTo)}&manuscript_id=${encodeURIComponent(props.row.id)}`
    );
  };

  if (props.row.linked_at) {
    return (
      <p className="text-xs text-emerald-400/90">
        Linked · {props.row.google_doc_title || props.row.google_doc_id || "Google Doc"} · HAL enabled
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/80 p-3">
      <p className="text-sm font-medium text-zinc-200">{displayTitle(props.row)}</p>
      {!props.googleConnected ? (
        <button
          type="button"
          onClick={connectGoogle}
          className="rounded-full border border-amber-500/50 bg-amber-900/40 px-3 py-1.5 text-xs font-semibold text-amber-100"
        >
          Connect Google account
        </button>
      ) : (
        <>
          {!session ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void startSession()}
              className="rounded-full border border-violet-500/50 bg-violet-700/80 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              Start link session
            </button>
          ) : (
            <div className="space-y-2 text-xs text-zinc-400">
              <p>
                1. Open the correct Google Doc in this browser (with the HAL extension).
                <br />
                2. In the extension side panel, click <strong className="text-zinc-200">Report doc</strong>.
                <br />
                3. Return here and click <strong className="text-zinc-200">Link session</strong> to confirm.
              </p>
              {session.status === "reported" && session.google_doc_title ? (
                <p className="rounded border border-emerald-900/40 bg-emerald-950/30 px-2 py-1.5 text-emerald-200/90">
                  Reported: {session.google_doc_title}
                  {session.google_doc_url ? (
                    <>
                      {" "}
                      ·{" "}
                      <a
                        href={session.google_doc_url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        Open doc
                      </a>
                    </>
                  ) : null}
                </p>
              ) : (
                <p className="text-amber-300/80">Waiting for extension to report the active doc…</p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || session.status !== "reported"}
                  onClick={() => void confirmLink()}
                  className="rounded-full border border-emerald-500/50 bg-emerald-700/80 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                >
                  Link session
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void pollSession(session.id)}
                  className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300"
                >
                  Refresh
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {error ? (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
