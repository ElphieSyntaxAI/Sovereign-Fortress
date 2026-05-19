import { useCallback, useRef, useState } from "react";
import { bffAuthHeaders, bffCredentials, bffUrl } from "../lib/bffFetch";
import { usePlanningSession } from "../planning/PlanningSessionContext";

export type ProposedLoreChunk = {
  title: string;
  excerpt: string;
  chunk_type: string;
  tags: string[];
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ProposedWithKey = ProposedLoreChunk & { _key: string };

export type LibrarianInterviewChatProps = {
  /** Sent as `project_id` to RAG / lore-git (often same as manuscript id). */
  projectId: string | null;
  getAccessToken: () => string | null | Promise<string | null>;
};

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: text };
  }
}

export function LibrarianInterviewChat({ projectId, getAccessToken }: LibrarianInterviewChatProps) {
  const { appendInterviewTurn } = usePlanningSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposed, setProposed] = useState<ProposedWithKey[]>([]);
  const [committingKey, setCommittingKey] = useState<string | null>(null);
  const [committedKeys, setCommittedKeys] = useState<Set<string>>(() => new Set());
  const listEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    queueMicrotask(() => listEndRef.current?.scrollIntoView({ behavior: "smooth" }));
  };

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || pending) return;
    if (!projectId?.trim()) {
      setError("Set VITE_PLANNING_MANUSCRIPT_ID (or pass manuscriptId) so project_id is sent to the librarian.");
      return;
    }

    setError(null);
    setInput("");
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setPending(true);
    scrollToBottom();

    try {
      const token = await getAccessToken();

      const res = await fetch(bffUrl("/api/rag/chat"), {
        method: "POST",
        ...bffCredentials,
        headers: {
          ...bffAuthHeaders(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audience: "author",
          question: text,
          project_id: projectId.trim(),
          system_prompt: "lore_extraction",
          include_wiki_drafts: true,
          hud_state: {},
        }),
      });

      const json = (await readJson(res)) as {
        success?: boolean;
        lore_extraction?: boolean;
        proposed_chunks?: ProposedLoreChunk[];
        error?: string;
        message?: string;
      };

      if (!res.ok) {
        throw new Error(json.message || json.error || res.statusText);
      }

      const chunks = Array.isArray(json.proposed_chunks) ? json.proposed_chunks : [];
      const normalized: ProposedWithKey[] = chunks.map((c) => ({
        title: String(c.title ?? ""),
        excerpt: String(c.excerpt ?? ""),
        chunk_type: String(c.chunk_type ?? "other"),
        tags: Array.isArray(c.tags) ? c.tags.map((t) => String(t)) : [],
        _key: crypto.randomUUID(),
      }));

      setProposed(normalized);

      const summary =
        normalized.length === 0
          ? "No proposed chunks (model returned an empty list)."
          : `Proposed ${normalized.length} wiki chunk(s) — review below and approve to commit.`;

      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", content: summary }]);
      appendInterviewTurn(text, summary);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", content: `Error: ${msg}` }]);
    } finally {
      setPending(false);
      scrollToBottom();
    }
  }, [appendInterviewTurn, getAccessToken, input, pending, projectId]);

  const commitChunk = useCallback(
    async (chunk: ProposedWithKey) => {
      if (committingKey) return;
      setError(null);
      setCommittingKey(chunk._key);
      try {
        const token = await getAccessToken();

        const { _key, ...proposed_chunk } = chunk;
        void _key;

        const res = await fetch(bffUrl("/api/lore-git/commit"), {
          method: "POST",
          ...bffCredentials,
          headers: {
            ...bffAuthHeaders(token),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            lore_extraction_commit: true,
            project_id: projectId?.trim() || null,
            proposed_chunk,
            stylistic_metadata: {},
          }),
        });

        const json = (await readJson(res)) as { error?: string; success?: boolean };
        if (!res.ok) {
          throw new Error(json.error || res.statusText);
        }

        setCommittedKeys((prev) => new Set(prev).add(chunk._key));
        appendInterviewTurn(
          `Committed wiki: ${chunk.title}`,
          chunk.excerpt.slice(0, 500) + (chunk.excerpt.length > 500 ? "…" : "")
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setCommittingKey(null);
      }
    },
    [appendInterviewTurn, committingKey, getAccessToken, projectId]
  );

  return (
    <div className="space-y-4">
      <SharedSessionDigestInline />
      <p className="text-sm text-zinc-400">
        Lore Extraction mode: each message calls{" "}
        <code className="text-zinc-300">POST /api/rag/chat</code> with{" "}
        <code className="text-zinc-300">system_prompt: &quot;lore_extraction&quot;</code>. The model returns
        structured proposed chunks; use <strong className="text-zinc-200">Approve &amp; Commit to Wiki</strong> to
        persist via <code className="text-zinc-300">POST /api/lore-git/commit</code>.
      </p>

      <div className="flex max-h-72 flex-col gap-2 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/80 p-3">
        {messages.length === 0 ? (
          <p className="text-xs text-zinc-500">Ask the librarian to extract lore from your indexed sources…</p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={
                msg.role === "user"
                  ? "ml-6 rounded-lg border border-violet-900/50 bg-violet-950/30 px-2 py-1.5 text-sm text-zinc-100"
                  : "mr-6 rounded-lg border border-zinc-700 bg-zinc-900/60 px-2 py-1.5 text-sm text-zinc-200"
              }
            >
              <span className="text-[10px] font-semibold uppercase text-zinc-500">
                {msg.role === "user" ? "You" : "Librarian"}
              </span>
              <p className="mt-1 whitespace-pre-wrap">{msg.content}</p>
            </div>
          ))
        )}
        <div ref={listEndRef} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={2}
          placeholder="e.g. What locations and rules should we add to the wiki from the latest outline?"
          className="min-h-[3rem] flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void sendMessage();
            }
          }}
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => void sendMessage()}
          className="h-fit shrink-0 rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-50"
        >
          {pending ? "Thinking…" : "Send"}
        </button>
      </div>
      <p className="text-[10px] text-zinc-600">Ctrl+Enter to send.</p>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {proposed.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-200">Proposed chunks</h3>
          <ul className="space-y-3">
            {proposed.map((c) => {
              const done = committedKeys.has(c._key);
              return (
                <li
                  key={c._key}
                  className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-3 text-sm text-zinc-200"
                >
                  <p className="font-medium text-zinc-100">{c.title}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-zinc-500">
                    {c.chunk_type}
                    {c.tags.length > 0 ? (
                      <span className="normal-case text-zinc-400">
                        {" "}
                        · tags: {c.tags.join(", ")}
                      </span>
                    ) : null}
                  </p>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded border border-zinc-800 bg-zinc-950/80 p-2 text-xs text-zinc-300">
                    {c.excerpt}
                  </pre>
                  {done ? (
                    <p className="mt-2 text-xs text-emerald-400/90">Committed to wiki.</p>
                  ) : (
                    <button
                      type="button"
                      disabled={committingKey !== null}
                      onClick={() => void commitChunk(c)}
                      className="mt-2 rounded-md border border-emerald-700/60 bg-emerald-950/40 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-900/50 disabled:opacity-50"
                    >
                      {committingKey === c._key ? "Committing…" : "Approve & Commit to Wiki"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function SharedSessionDigestInline() {
  const { interviewTurns, plotBeats, wikiNotes } = usePlanningSession();
  const last = interviewTurns[interviewTurns.length - 1];
  return (
    <aside className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-xs text-zinc-300">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Shared session</p>
      <p className="mt-1">
        Interview turns: <span className="text-zinc-100">{interviewTurns.length}</span> · Plot beats:{" "}
        <span className="text-zinc-100">{plotBeats.length}</span>
      </p>
      {last ? (
        <p className="mt-2 line-clamp-2 text-zinc-400">
          Latest: <span className="text-zinc-200">{last.question}</span>
        </p>
      ) : null}
      {wikiNotes.trim() ? (
        <p className="mt-1 line-clamp-2 text-zinc-500">Wiki notes: {wikiNotes.trim()}</p>
      ) : null}
    </aside>
  );
}
