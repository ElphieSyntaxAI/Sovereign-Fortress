import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { getPreferredBffBearer } from "../lib/authAccessToken";
import { bffAuthHeaders, bffCredentials, bffUrl } from "../lib/bffFetch";
import { extractGoogleDocId } from "../lib/googleDocUrl";

type DriveFile = {
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

export function OutlineGoogleDocPicker(props: {
  manuscriptId: string;
  /** Called after outline text is imported so Blank page tab can refresh. */
  onOutlineImported?: (outline: string) => void;
  onLinked?: () => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [oauth, setOauth] = useState<OAuthStatus | null>(null);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pasteUrl, setPasteUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [busy, setBusy] = useState<"import" | "link" | "both" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
        const json = (await res.json().catch(() => ({}))) as {
          files?: DriveFile[];
          error?: string;
        };
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

  useEffect(() => {
    if (searchParams.get("google") === "connected") {
      const next = new URLSearchParams(searchParams);
      next.delete("google");
      next.delete("manuscript_id");
      setSearchParams(next, { replace: true });
      void loadOAuth().then((st) => {
        if (st.connected) void loadDocs();
      });
      setMessage("Google account connected. Pick a doc below.");
    }
  }, [searchParams, setSearchParams, loadOAuth, loadDocs]);

  const resolveDocId = (): string | null => {
    if (selectedId) return selectedId;
    const fromPaste = extractGoogleDocId(pasteUrl);
    return fromPaste;
  };

  const connectDoc = async (mode: "import" | "link" | "both") => {
    const docId = resolveDocId();
    if (!docId) {
      setError("Select a doc from the list or paste a Google Docs URL.");
      return;
    }
    setBusy(mode);
    setError(null);
    setMessage(null);
    try {
      const json = (await api(
        `/api/manuscripts/${encodeURIComponent(props.manuscriptId)}/google-doc/connect`,
        {
          method: "POST",
          body: JSON.stringify({
            google_doc_id: docId,
            google_doc_url: pasteUrl.trim() || undefined,
            import_outline: mode === "import" || mode === "both",
            link_hal: mode === "link" || mode === "both",
          }),
        }
      )) as {
        message?: string;
        manuscript?: { outline?: string | null };
        outline_chars?: number;
      };
      const outline = json.manuscript?.outline ?? "";
      if (outline && props.onOutlineImported) props.onOutlineImported(outline);
      if (mode === "link" || mode === "both") props.onLinked?.();
      setMessage(
        json.message ||
          (mode === "import"
            ? `Imported ${json.outline_chars ?? 0} characters into outline.`
            : mode === "link"
              ? "Google Doc linked for HAL."
              : "Outline imported and doc linked for HAL.")
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const connectGoogle = () => {
    const returnTo = `/outline`;
    window.location.href = bffUrl(
      `/api/google/oauth/start?return_to=${encodeURIComponent(returnTo)}&manuscript_id=${encodeURIComponent(props.manuscriptId)}`
    );
  };

  const selected = files.find((f) => f.id === selectedId);

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading Google Drive…</p>;
  }

  if (!oauth?.configured) {
    return (
      <p className="text-sm text-amber-300/90">
        Google OAuth is not configured on this server. Use file import below, or set{" "}
        <code className="text-amber-200">GOOGLE_OAUTH_*</code> env vars on the BFF.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {!oauth.connected ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-zinc-400">Connect Google to browse your completed outline docs.</p>
          <button
            type="button"
            onClick={connectGoogle}
            className="rounded-full border border-amber-500/50 bg-amber-700/80 px-4 py-1.5 text-xs font-semibold text-amber-50"
          >
            Connect Google account
          </button>
        </div>
      ) : (
        <>
          <p className="text-xs text-emerald-400/90">
            Connected{oauth.google_email ? ` as ${oauth.google_email}` : ""}. Select a doc, then import
            and/or link for HAL.
          </p>

          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search doc titles…"
              className="min-w-[12rem] flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={loadingDocs}
              onClick={() => void loadDocs(search)}
              className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300"
            >
              {loadingDocs ? "Searching…" : "Search Drive"}
            </button>
            <button
              type="button"
              disabled={loadingDocs}
              onClick={() => void loadDocs()}
              className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300"
            >
              Recent
            </button>
          </div>

          <ul className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/60 p-2">
            {files.length === 0 ? (
              <li className="px-2 py-3 text-xs text-zinc-500">No Google Docs found.</li>
            ) : (
              files.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(f.id);
                      setPasteUrl(f.webViewLink ?? `https://docs.google.com/document/d/${f.id}/edit`);
                    }}
                    className={[
                      "w-full rounded-md border px-3 py-2 text-left text-xs transition",
                      selectedId === f.id
                        ? "border-amber-500/60 bg-amber-950/40 text-amber-50"
                        : "border-zinc-800 text-zinc-200 hover:border-zinc-600",
                    ].join(" ")}
                  >
                    <span className="font-medium">{f.name}</span>
                    {f.modifiedTime ? (
                      <span className="mt-0.5 block text-[10px] text-zinc-500">
                        Modified {new Date(f.modifiedTime).toLocaleString()}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>

          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-wide text-zinc-500">
              Or paste Google Docs URL
            </span>
            <input
              type="url"
              value={pasteUrl}
              onChange={(e) => {
                setPasteUrl(e.target.value);
                const id = extractGoogleDocId(e.target.value);
                if (id) setSelectedId(id);
              }}
              placeholder="https://docs.google.com/document/d/…"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
          </label>

          {selected ? (
            <p className="text-xs text-zinc-400">
              Selected: <span className="text-zinc-200">{selected.name}</span>
              {selected.webViewLink ? (
                <>
                  {" "}
                  ·{" "}
                  <a
                    href={selected.webViewLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-300 underline"
                  >
                    Open in Google
                  </a>
                </>
              ) : null}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy != null}
              onClick={() => void connectDoc("import")}
              className="rounded-full border border-violet-500/50 bg-violet-800/80 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {busy === "import" ? "Importing…" : "Import outline text"}
            </button>
            <button
              type="button"
              disabled={busy != null}
              onClick={() => void connectDoc("link")}
              className="rounded-full border border-emerald-600/50 bg-emerald-900/50 px-3 py-1.5 text-xs font-semibold text-emerald-100 disabled:opacity-50"
            >
              {busy === "link" ? "Linking…" : "Link for HAL only"}
            </button>
            <button
              type="button"
              disabled={busy != null}
              onClick={() => void connectDoc("both")}
              className="rounded-full border border-amber-500/50 bg-amber-700/80 px-3 py-1.5 text-xs font-semibold text-amber-50 disabled:opacity-50"
            >
              {busy === "both" ? "Working…" : "Import + link HAL"}
            </button>
          </div>
        </>
      )}

      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-sm text-emerald-300/90">{message}</p> : null}
    </div>
  );
}
