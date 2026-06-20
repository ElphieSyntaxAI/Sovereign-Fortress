import { useMemo, useState } from "react";

import type { WikiNavSection } from "../../lib/wikiArticleParse";

type WikiSectionSidebarProps = {
  sections: WikiNavSection[];
  selectedId: string | null;
  overviewActive?: boolean;
  onSelectOverview?: () => void;
  onSelect: (chunkId: string) => void;
  manuscriptTitle?: string | null;
};

export function WikiSectionSidebar({
  sections,
  selectedId,
  overviewActive = false,
  onSelectOverview,
  onSelect,
  manuscriptTitle,
}: WikiSectionSidebarProps) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections
      .map((s) => ({
        ...s,
        articles: s.articles.filter((a) => a.title.toLowerCase().includes(q)),
      }))
      .filter((s) => s.articles.length > 0);
  }, [sections, query]);

  const total = sections.reduce((n, s) => n + s.articles.length, 0);

  return (
    <aside className="wiki-sidebar flex h-full min-h-[480px] flex-col border-r border-zinc-300/20 bg-zinc-100/95 dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="border-b border-zinc-300/30 px-4 py-4 dark:border-zinc-800">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400">
          Lore wiki
        </p>
        <h2 className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {manuscriptTitle?.trim() || "Manuscript"}
        </h2>
        <p className="mt-1 text-xs text-zinc-500">{total} articles</p>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search articles…"
          className="mt-3 w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-800 placeholder:text-zinc-400 focus:border-amber-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Wiki sections">
        {onSelectOverview ? (
          <button
            type="button"
            onClick={onSelectOverview}
            className={[
              "mb-3 w-full rounded-md px-3 py-2.5 text-left text-sm font-semibold transition",
              overviewActive
                ? "bg-amber-100 text-amber-950 dark:bg-amber-950/50 dark:text-amber-100"
                : "text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-900",
            ].join(" ")}
          >
            Overview
          </button>
        ) : null}
        {filtered.length === 0 ? (
          <p className="px-2 text-xs text-zinc-500">No articles match your search.</p>
        ) : (
          filtered.map((section) => {
            const key = section.kind;
            const isCollapsed = collapsed[key] ?? false;
            return (
              <div key={key} className="mb-3">
                <button
                  type="button"
                  onClick={() => setCollapsed((c) => ({ ...c, [key]: !isCollapsed }))}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs font-bold uppercase tracking-wide text-zinc-600 hover:bg-zinc-200/80 dark:text-zinc-400 dark:hover:bg-zinc-900"
                >
                  <span>{section.label}</span>
                  <span className="text-zinc-400">{isCollapsed ? "+" : "−"}</span>
                </button>
                {!isCollapsed ? (
                  <ul className="mt-1 space-y-0.5">
                    {section.articles.map((article) => {
                      const active = article.id === selectedId;
                      return (
                        <li key={article.id}>
                          <button
                            type="button"
                            onClick={() => onSelect(article.id)}
                            className={[
                              "w-full rounded-md px-3 py-2 text-left text-sm transition",
                              active
                                ? "bg-amber-100 font-medium text-amber-950 dark:bg-amber-950/50 dark:text-amber-100"
                                : "text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-900",
                            ].join(" ")}
                          >
                            {article.title}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            );
          })
        )}
      </nav>
    </aside>
  );
}
