import { useCallback, useEffect, useState } from "react";

import {
  formatWikiRef,
  parseWikiRef,
  type WikiEntityRef,
} from "../../lib/planningBlockTypes";
import { fetchWikiChunks, titleForWikiChunk, type WikiChunkRow } from "../../lib/wikiChunksClient";

export type WikiEntityPickerProps = {
  manuscriptId: string;
  kindFilter?: string | string[];
  value: string;
  onChange: (value: string, ref?: WikiEntityRef) => void;
  label?: string;
  placeholder?: string;
};

export function WikiEntityPicker({
  manuscriptId,
  kindFilter,
  value,
  onChange,
  label = "Wiki link",
  placeholder = "Pick from wiki…",
}: WikiEntityPickerProps) {
  const [chunks, setChunks] = useState<WikiChunkRow[]>([]);
  const [loading, setLoading] = useState(false);
  const selected = parseWikiRef(value);

  const load = useCallback(async () => {
    if (!manuscriptId) return;
    setLoading(true);
    try {
      setChunks(await fetchWikiChunks(manuscriptId));
    } finally {
      setLoading(false);
    }
  }, [manuscriptId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filters = Array.isArray(kindFilter) ? kindFilter : kindFilter ? [kindFilter] : [];

  const options = chunks.filter((c) => {
    if (!filters.length) return true;
    const kind = String(c.metadata?.outline_entity_kind ?? "").toLowerCase();
    return filters.some((f) => kind === f.toLowerCase() || kind.includes(f.toLowerCase()));
  });

  return (
    <label className="block space-y-1">
      <span className="text-[10px] text-zinc-500">{label}</span>
      <div className="flex gap-1">
        <select
          value={selected?.chunkId ?? ""}
          onChange={(e) => {
            const id = e.target.value;
            if (!id) {
              onChange("");
              return;
            }
            const chunk = chunks.find((c) => c.id === id);
            if (!chunk) return;
            const ref: WikiEntityRef = {
              chunkId: id,
              title: titleForWikiChunk(chunk.content, chunk.metadata),
              kind: String(chunk.metadata?.outline_entity_kind ?? ""),
            };
            onChange(formatWikiRef(ref), ref);
          }}
          className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
        >
          <option value="">{loading ? "Loading wiki…" : placeholder}</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {titleForWikiChunk(c.content, c.metadata)}
            </option>
          ))}
        </select>
        <button
          type="button"
          title="Refresh wiki list"
          onClick={() => void load()}
          className="shrink-0 rounded border border-zinc-600 px-2 text-[10px] text-zinc-400"
        >
          ↻
        </button>
      </div>
      {selected ? (
        <p className="text-[10px] text-emerald-400/80">Linked: {selected.title}</p>
      ) : null}
    </label>
  );
}
