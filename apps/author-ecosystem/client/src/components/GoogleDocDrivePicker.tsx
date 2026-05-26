import { useCallback, useEffect, useState } from "react";

import { getPreferredBffBearer } from "../lib/authAccessToken";
import { bffAuthHeaders, bffCredentials, bffUrl } from "../lib/bffFetch";
import { extractGoogleDocId } from "../lib/googleDocUrl";

export type DriveFile = {
  id: string;
  name: string;
  modifiedTime: string | null;
  webViewLink: string | null;
};

type OAuthStatus = {
  configured: boolean;
  connected: boolean;
  google_email: string | null;
};

export type GoogleDocSelection = {
  id: string;
  name: string;
  url: string;
};

export function GoogleDocDrivePicker(props: {
  manuscriptId: string;
  /** OAuth return path on Author app (default /manuscripts). */
  oauthReturnPath?: string;
  multiSelect?: boolean;
  primaryLabel?: string;
  busy?: boolean;
  onConnected?: () => void;
  onSubmit: (docs: GoogleDocSelection[], primaryId: string) => void | Promise<void>;
}) {
  const returnPath = props.oauthReturnPath ?? "/manuscripts";
  const multi = props.multiSelect ?? false;

  const [oauth, setOauth] = useState<OAuthStatus | null>(null);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [pasteUrl, setPasteUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: string };
    if (!res.ok) throw new Error(json.error || res.statusText);
    return json;
  }, []);

  const loadOAuth = useCallback(async () => {
    const json = (await api("/api/google/oauth/status")) as OAuthStatus;
    setOauth(json);
    return json;
  }, [api]);

  const loadDocs = useCallback(
    async (q?: string) => {
      setLoadingDocs(true);
      setError(null);
      try {
        const qs = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
        const token = await getPreferredBffBearer();
        const res = await fetch(bffUrl(`/api/google/drive/recent-docs${qs}`), {
          ...bffCredentials,
          headers: { ...bffAuthHeaders(token) },
        });
        const json = (await res.json().catch(() => ({}))) as { files?: DriveFile[]; error?: string };
        if (!res.ok) throw new Error(json.error || res.statusText);
        setFiles(Array.isArray(json.files) ? json.files : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setFiles([]);
      } finally {
        setLoadingDocs(false);
      }
    },
    []
  );

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const st = await loadOAuth();
        if (st.connected) await loadDocs();
      } finally {
        setLoading(false);
      }
    })();
  }, [loadOAuth, loadDocs]);

  const toggleFile = (f: DriveFile) => {
    const url = f.webViewLink ?? `https://docs.google.com/document/d/${f.id}/edit`;
    if (!multi) {
      setSelectedIds(new Set([f.id]));
      setPrimaryId(f.id);
      setPasteUrl(url);
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(f.id)) next.delete(f.id);
      else next.add(f.id);
      return next;
    });
    setPrimaryId(f.id);
    setPasteUrl(url);
  };

  const addPasteUrl = () => {
    const id = extractGoogleDocId(pasteUrl);
    if (!id) {
      setError("Paste a valid Google Docs URL.");
      return;
    }
    const url = pasteUrl.trim();
    if (!multi) {
      setSelectedIds(new Set([id]));
      setPrimaryId(id);
      return;
    }
    setSelectedIds((prev) => new Set(prev).add(id));
    setPrimaryId(id);
    setError(null);
  };

  const buildSelection = (): GoogleDocSelection[] => {
    const out: GoogleDocSelection[] = [];
    const seen = new Set<string>();
    for (const id of selectedIds) {
      const f = files.find((x) => x.id === id);
      const url = f?.webViewLink ?? `https://docs.google.com/document/d/${id}/edit`;
      const name = f?.name ?? "Google Doc";
      if (!seen.has(id)) {
        seen.add(id);
        out.push({ id, name, url });
      }
    }
    const pasteId = extractGoogleDocId(pasteUrl);
    if (pasteId && !seen.has(pasteId)) {
      out.push({
        id: pasteId,
        url: pasteUrl.trim(),
        name: files.find((x) => x.id === pasteId)?.name ?? "Google Doc",
      });
    }
    return out;
  };

  const connectGoogle = () => {
    window.location.href = bffUrl(
      `/api/google/oauth/start?return_to=${encodeURIComponent(returnPath)}&manuscript_id=${encodeURIComponent(props.manuscriptId)}`
    );
  };

  if (loading) {
    return <p className="text-xs text-zinc-500">Loading Google Drive…</p>;
  }

  if (!oauth?.configured) {
    return (
      <p className="text-xs text-amber-300/90">
        Google OAuth is not configured on the server. Paste doc URLs below or use file upload.
      </p>
    );
  }

  if (!oauth.connected) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-zinc-400">Connect Google to browse and select your docs.</p>
        <button
          type="button"
          onClick={connectGoogle}
          className="rounded-full border border-amber-500/50 bg-amber-700/80 px-3 py-1.5 text-xs font-semibold text-amber-50"
        >
          Connect Google account
        </button>
      </div>
    );
  }

  const selection = buildSelection();
  const primary = primaryId ?? selection[0]?.id ?? null;

  return (
    <div className="space-y-3">
      <p className="text-xs text-emerald-400/90">
        Connected{oauth.google_email ? ` as ${oauth.google_email}` : ""}.{" "}
        {multi ? "Select all docs for this book (chapters, outline, bible)." : "Select one doc."}
      </p>

      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search doc titles…"
          className="min-w-[10rem] flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs"
        />
        <button
          type="button"
          disabled={loadingDocs}
          onClick={() => void loadDocs(search)}
          className="rounded-full border border-zinc-700 px-2 py-1 text-[10px] text-zinc-300"
        >
          Search
        </button>
        <button
          type="button"
          disabled={loadingDocs}
          onClick={() => void loadDocs()}
          className="rounded-full border border-zinc-700 px-2 py-1 text-[10px] text-zinc-300"
        >
          Recent
        </button>
      </div>

      <ul className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/60 p-1">
        {files.length === 0 ? (
          <li className="px-2 py-2 text-[10px] text-zinc-500">No Google Docs found.</li>
        ) : (
          files.map((f) => {
            const on = selectedIds.has(f.id);
            return (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => toggleFile(f)}
                  className={[
                    "w-full rounded-md border px-2 py-1.5 text-left text-[11px] transition",
                    on
                      ? "border-violet-500/60 bg-violet-950/40 text-violet-50"
                      : "border-transparent text-zinc-200 hover:border-zinc-700",
                  ].join(" ")}
                >
                  {multi ? (on ? "☑ " : "☐ ") : null}
                  <span className="font-medium">{f.name}</span>
                </button>
              </li>
            );
          })
        )}
      </ul>

      <div className="space-y-1">
        <label className="text-[10px] uppercase tracking-wide text-zinc-500">Or paste URL(s)</label>
        <textarea
          value={pasteUrl}
          onChange={(e) => setPasteUrl(e.target.value)}
          rows={2}
          placeholder="https://docs.google.com/document/d/…/edit"
          className="w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs"
        />
        {multi ? (
          <button
            type="button"
            onClick={addPasteUrl}
            className="rounded-full border border-zinc-700 px-2 py-1 text-[10px] text-zinc-300"
          >
            Add URL to list
          </button>
        ) : null}
      </div>

      {selection.length > 0 ? (
        <p className="text-[10px] text-zinc-400">
          {selection.length} doc(s) selected
          {primary ? ` · primary: ${selection.find((s) => s.id === primary)?.name ?? primary}` : ""}
        </p>
      ) : null}

      <button
        type="button"
        disabled={props.busy || selection.length === 0 || !primary}
        onClick={() => {
          setError(null);
          void Promise.resolve(props.onSubmit(selection, primary!)).catch((e) =>
            setError(e instanceof Error ? e.message : String(e))
          );
        }}
        className="w-full rounded-full border border-emerald-500/50 bg-emerald-700/80 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
      >
        {props.busy ? "Working…" : props.primaryLabel ?? (multi ? "Use selected docs" : "Use selected doc")}
      </button>

      {error ? (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
