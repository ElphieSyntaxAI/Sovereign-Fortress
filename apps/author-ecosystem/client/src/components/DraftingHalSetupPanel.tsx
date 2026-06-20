import { useCallback, useEffect, useState } from "react";

import { GoogleDocDrivePicker, type GoogleDocSelection } from "./GoogleDocDrivePicker";
import { getPreferredBffBearer } from "../lib/authAccessToken";
import { bffAuthHeaders, bffCredentials, bffUrl } from "../lib/bffFetch";
import {
  displayTitle,
  findHubManuscript,
  isManuscriptGoogleLinked,
  type HubManuscript,
  type ManuscriptHubPayload,
} from "../lib/manuscriptTypes";

export function DraftingHalSetupPanel(props: { manuscriptId: string }) {
  const [row, setRow] = useState<HubManuscript | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showRelink, setShowRelink] = useState(false);

  const api = useCallback(async (path: string, init?: RequestInit) => {
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
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getPreferredBffBearer();
      const [hubRes, oauthRes] = await Promise.all([
        fetch(bffUrl("/api/manuscripts/hub"), {
          ...bffCredentials,
          headers: bffAuthHeaders(token),
        }),
        fetch(bffUrl("/api/google/oauth/status"), {
          ...bffCredentials,
          headers: bffAuthHeaders(token),
        }),
      ]);
      const hubJson = (await hubRes.json().catch(() => ({}))) as ManuscriptHubPayload & {
        error?: string;
      };
      if (!hubRes.ok) throw new Error(hubJson.error || hubRes.statusText);

      const oauthJson = (await oauthRes.json().catch(() => ({}))) as {
        connected?: boolean;
        google_email?: string | null;
      };
      setGoogleConnected(Boolean(oauthJson.connected));
      setGoogleEmail(oauthJson.google_email ?? null);
      setRow(findHubManuscript(hubJson, props.manuscriptId));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRow(null);
    } finally {
      setLoading(false);
    }
  }, [props.manuscriptId]);

  useEffect(() => {
    void load();
  }, [load]);

  const connectGoogle = () => {
    window.location.href = bffUrl(
      `/api/google/oauth/start?return_to=${encodeURIComponent("/drafting")}&manuscript_id=${encodeURIComponent(props.manuscriptId)}`
    );
  };

  const linkHalDoc = async (docs: GoogleDocSelection[], primaryId: string) => {
    const primary = docs.find((d) => d.id === primaryId) ?? docs[0];
    if (!primary) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const json = (await api(
        `/api/manuscripts/${encodeURIComponent(props.manuscriptId)}/google-doc/connect`,
        {
          method: "POST",
          body: JSON.stringify({
            google_doc_id: primary.id,
            google_doc_url: primary.url,
            import_outline: false,
            link_hal: true,
          }),
        }
      )) as { message?: string; doc?: { name?: string } };
      setMessage(
        json.message ||
          `HAL enabled for “${json.doc?.name ?? primary.name}”. Open it in Google Docs to draft.`
      );
      setShowRelink(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading draft link…</p>;
  }

  if (!row) {
    return (
      <p className="text-sm text-amber-300/90">
        Manuscript not found. Select a project on Manuscripts first.
      </p>
    );
  }

  const linked = isManuscriptGoogleLinked(row);
  const docUrl =
    row.google_doc_url ||
    (row.google_doc_id
      ? `https://docs.google.com/document/d/${row.google_doc_id}/edit`
      : null);
  const docLabel = row.google_doc_id || "Google Doc";

  return (
    <section className="space-y-4 rounded-xl border border-emerald-900/35 bg-emerald-950/10 p-4">
      <header className="space-y-1">
        <h2 className="text-sm font-semibold text-emerald-100">Draft in Google Docs</h2>
        <p className="text-xs text-zinc-400">
          Author does not host a drafting editor. Link a Google Doc for{" "}
          <span className="text-zinc-200">{displayTitle(row)}</span>, then write in Google Docs with
          the HAL browser extension capturing your rhythm.
        </p>
      </header>

      {linked && !showRelink ? (
        <div className="space-y-3 rounded-lg border border-emerald-800/50 bg-emerald-950/25 p-4">
          <p className="text-xs text-emerald-300/90">
            HAL enabled · {docLabel}
            {googleEmail ? ` · Google ${googleEmail}` : ""}
          </p>
          {docUrl ? (
            <a
              href={docUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-full border border-emerald-500/60 bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
            >
              Open Google Doc &amp; draft
            </a>
          ) : null}
          <ol className="list-decimal space-y-1 pl-4 text-xs text-zinc-400">
            <li>Install the Elphie Syntax extension (Chrome → Load unpacked → apps/author-ecosystem/extension).</li>
            <li>Stay signed in on this Author dashboard with this manuscript selected.</li>
            <li>Open the doc above — use the ✎ button in Google Docs for HAL + Librarian.</li>
          </ol>
          <button
            type="button"
            onClick={() => setShowRelink(true)}
            className="text-[11px] text-zinc-500 underline hover:text-zinc-300"
          >
            Link a different Google Doc
          </button>
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          {!googleConnected ? (
            <>
              <p className="text-xs text-zinc-400">
                Connect Google to pick the manuscript doc from Drive.
              </p>
              <button
                type="button"
                onClick={connectGoogle}
                className="rounded-full border border-amber-500/50 bg-amber-700/80 px-4 py-1.5 text-xs font-semibold text-amber-50"
              >
                Connect Google account
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-emerald-400/90">
                Connected{googleEmail ? ` as ${googleEmail}` : ""}. Select the Google Doc you draft
                in — HAL will attach to that doc only.
              </p>
              <GoogleDocDrivePicker
                manuscriptId={props.manuscriptId}
                oauthReturnPath="/drafting"
                multiSelect={false}
                busy={busy}
                primaryLabel="Enable HAL for this doc"
                onSubmit={linkHalDoc}
                onConnected={() => void load()}
              />
              {showRelink ? (
                <button
                  type="button"
                  onClick={() => setShowRelink(false)}
                  className="text-[11px] text-zinc-500 underline"
                >
                  Cancel
                </button>
              ) : null}
            </>
          )}
        </div>
      )}

      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-sm text-emerald-300/90">{message}</p> : null}
    </section>
  );
}
