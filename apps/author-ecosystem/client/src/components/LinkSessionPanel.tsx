import { useCallback, useEffect, useState } from "react";

import { GoogleDocDrivePicker } from "./GoogleDocDrivePicker";
import { getPreferredBffBearer } from "../lib/authAccessToken";
import { bffAuthHeaders, bffCredentials, bffUrl } from "../lib/bffFetch";
import { displayTitle, isManuscriptGoogleLinked, type HubManuscript } from "../lib/manuscriptTypes";

type LinkSession = {
  id: string;
  status: string;
  google_doc_id?: string | null;
  google_doc_title?: string | null;
  google_doc_url?: string | null;
  reported_docs?: Array<{
    google_doc_id: string;
    google_doc_url: string;
    google_doc_title?: string;
  }>;
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
  const [tokenCopied, setTokenCopied] = useState(false);
  const linked = isManuscriptGoogleLinked(props.row);

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

  const clearStoredSession = useCallback(() => {
    try {
      localStorage.removeItem("elphie_active_link_session_id");
      localStorage.removeItem("elphie_active_link_manuscript_id");
    } catch {
      /* ignore */
    }
    setSession(null);
  }, []);

  const startSession = useCallback(async () => {
    const json = (await api(`/api/manuscripts/${encodeURIComponent(props.row.id)}/link-session`, {
      method: "POST",
    })) as { session: LinkSession };
    setSession(json.session);
    await pollSession(json.session.id);
    return json.session;
  }, [api, pollSession, props.row.id]);

  useEffect(() => {
    if (linked) {
      clearStoredSession();
      return;
    }
    try {
      const sid = localStorage.getItem("elphie_active_link_session_id");
      const mid = localStorage.getItem("elphie_active_link_manuscript_id");
      if (sid && mid === props.row.id) {
        void pollSession(sid).catch(() => clearStoredSession());
      }
    } catch {
      /* ignore */
    }
  }, [props.row.id, pollSession, linked, clearStoredSession]);

  useEffect(() => {
    if (!session?.id || session.status === "confirmed" || session.status === "expired" || linked) return;
    const t = window.setInterval(() => {
      void pollSession(session.id).catch(() => {});
    }, 4000);
    return () => window.clearInterval(t);
  }, [session?.id, session?.status, pollSession, linked]);

  const confirmLink = async () => {
    if (!session?.id) return;
    setBusy(true);
    setError(null);
    try {
      await api(
        `/api/manuscripts/${encodeURIComponent(props.row.id)}/link-session/${encodeURIComponent(session.id)}/confirm`,
        { method: "POST" }
      );
      clearStoredSession();
      props.onLinked();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const reportDocs = async (
    docs: { id: string; name: string; url: string }[],
    primaryId: string
  ) => {
    let sid = session?.id;
    if (!sid) {
      const s = await startSession();
      sid = s.id;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/api/manuscripts/link-session/${encodeURIComponent(sid)}/report`, {
        method: "POST",
        body: JSON.stringify({
          docs: docs.map((d) => ({
            google_doc_id: d.id,
            google_doc_url: d.url,
            google_doc_title: d.name,
          })),
          primary_google_doc_id: primaryId,
        }),
      });
      await pollSession(sid);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const connectGoogle = () => {
    window.location.href = bffUrl(
      `/api/google/oauth/start?return_to=${encodeURIComponent("/manuscripts")}&manuscript_id=${encodeURIComponent(props.row.id)}`
    );
  };

  const copyExtensionToken = async () => {
    const token = await getPreferredBffBearer();
    if (!token) {
      setError("No session token — sign in again at /sign-in.");
      return;
    }
    try {
      await navigator.clipboard.writeText(token);
      setTokenCopied(true);
      window.setTimeout(() => setTokenCopied(false), 4000);
    } catch {
      setError("Could not copy token.");
    }
  };

  if (linked) {
    const companions = props.row.companion_google_docs ?? [];
    return (
      <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-3 py-2">
        <p className="text-xs text-emerald-400/90">
          Linked · {props.row.google_doc_title || props.row.google_doc_id || "Google Doc"} · HAL enabled
        </p>
        {companions.length > 0 ? (
          <p className="mt-1 text-[10px] text-zinc-500">
            +{companions.length} companion doc(s) for this book
          </p>
        ) : null}
        {props.row.google_doc_url ? (
          <a
            href={props.row.google_doc_url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-[10px] text-emerald-300 underline"
          >
            Open primary doc
          </a>
        ) : null}
      </div>
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
          <GoogleDocDrivePicker
            manuscriptId={props.row.id}
            oauthReturnPath="/manuscripts"
            multiSelect
            busy={busy}
            primaryLabel={
              session?.status === "reported" ? "Update selected docs" : "Select docs for this book"
            }
            onSubmit={reportDocs}
          />

          {session?.status === "reported" ? (
            <div className="rounded border border-emerald-900/40 bg-emerald-950/30 px-2 py-1.5 text-xs text-emerald-200/90">
              Ready to link: <strong>{session.google_doc_title}</strong>
              {Array.isArray(session.reported_docs) && session.reported_docs.length > 1
                ? ` (+${session.reported_docs.length - 1} more)`
                : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void confirmLink()}
                  className="rounded-full border border-emerald-500/50 bg-emerald-700/80 px-3 py-1 text-[11px] font-semibold text-white"
                >
                  Confirm link session
                </button>
              </div>
            </div>
          ) : null}

          <details className="text-[10px] text-zinc-500">
            <summary className="cursor-pointer text-zinc-400">HAL extension (optional)</summary>
            <p className="mt-1">
              You can also report from the extension side panel after Sync session.{" "}
              <button
                type="button"
                className="text-violet-300 underline"
                onClick={() => void copyExtensionToken()}
              >
                {tokenCopied ? "Token copied" : "Copy token for extension"}
              </button>
            </p>
          </details>
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
