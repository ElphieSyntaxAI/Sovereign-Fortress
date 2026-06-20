import { useMemo, useState } from "react";

import type { OutlineLoreKind } from "../../lib/outlineLoreKinds";
import { getOutlineLoreKindConfig } from "../../lib/outlineLoreKinds";
import {
  parseWikiArticleSections,
  wikiChunkKind,
  wikiChunkKindLabel,
  wikiChunkTitle,
  wikiDisplayBody,
  type WikiChunkLike,
} from "../../lib/wikiArticleParse";
import { WikiArticleBody } from "./WikiArticleBody";

type WikiArticlePageProps = {
  chunk: WikiChunkLike;
  wikiEditable: boolean;
  onEdit: () => void;
  onRemove?: () => void;
  removeBusy?: boolean;
};

function infoboxRows(chunk: WikiChunkLike): { label: string; value: string }[] {
  const meta = chunk.metadata;
  const rows: { label: string; value: string }[] = [];

  const kind = wikiChunkKind(chunk);
  rows.push({ label: "Type", value: wikiChunkKindLabel(kind) });

  if (meta.wiki_form_tier) {
    rows.push({ label: "Form", value: String(meta.wiki_form_tier) });
  }
  if (meta.plot_point && String(meta.plot_point) !== "not_applicable") {
    rows.push({ label: "Plot beat", value: String(meta.plot_point).replace(/_/g, " ") });
  }
  if (meta.spoiler_level) {
    rows.push({ label: "Spoiler", value: String(meta.spoiler_level) });
  }
  if (meta.wiki_visibility) {
    rows.push({ label: "Visibility", value: String(meta.wiki_visibility) });
  }
  if (chunk.chunk_type) {
    rows.push({ label: "Chunk", value: chunk.chunk_type });
  }

  const tags = meta.tags;
  if (Array.isArray(tags) && tags.length) {
    const tagStr = tags
      .map((t) => (typeof t === "object" && t && "name" in t ? String((t as { name: string }).name) : String(t)))
      .filter(Boolean)
      .slice(0, 6)
      .join(", ");
    if (tagStr) rows.push({ label: "Tags", value: tagStr });
  }

  return rows;
}

export function WikiArticlePage({
  chunk,
  wikiEditable,
  onEdit,
  onRemove,
  removeBusy,
}: WikiArticlePageProps) {
  const title = wikiChunkTitle(chunk);
  const kind = wikiChunkKind(chunk);
  let categoryLabel = wikiChunkKindLabel(kind);
  try {
    if (kind !== "other") categoryLabel = getOutlineLoreKindConfig(kind as OutlineLoreKind).label;
  } catch {
    /* keep label */
  }

  const displayMarkdown = useMemo(() => wikiDisplayBody(chunk.content), [chunk.content]);
  const parsedSections = useMemo(
    () => parseWikiArticleSections(chunk.content),
    [chunk.content]
  );
  const [toc, setToc] = useState<{ id: string; title: string; level: 2 | 3 }[]>([]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <article className="wiki-article min-w-0">
      <div className="border-b border-zinc-200 bg-white px-6 py-5 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-amber-700 dark:text-amber-400">
              {categoryLabel}
            </p>
            <h1 className="mt-1 font-[Georgia,serif] text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {title}
            </h1>
          </div>
          {wikiEditable ? (
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={onEdit}
                className="rounded-md border border-amber-600/50 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/70"
              >
                Edit article
              </button>
              {onRemove ? (
                <button
                  type="button"
                  onClick={onRemove}
                  disabled={removeBusy}
                  className="rounded-md border border-red-800/50 bg-red-950/30 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-950/50 disabled:opacity-50"
                >
                  {removeBusy ? "Removing…" : "Remove"}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 bg-zinc-50 px-6 py-6 dark:bg-zinc-950/30 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div
          className={[
            "min-w-0 rounded-lg border border-zinc-200 bg-white px-6 py-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60",
            wikiEditable ? "wiki-article-selectable" : "",
          ].join(" ")}
        >
          {wikiEditable ? (
            <p className="mb-4 rounded-md border border-violet-500/25 bg-violet-50/80 px-3 py-2 text-xs text-violet-900 dark:border-violet-800/40 dark:bg-violet-950/30 dark:text-violet-200">
              Highlight any passage to assign it to a character, setting, or environment — click a
              button or drag onto the wiki rail.
            </p>
          ) : null}
          {parsedSections.length > 1 ? (
            <div className="space-y-8">
              {parsedSections.map((section) => (
                <section key={section.id} id={`section-${section.id}`}>
                  <h2 className="border-b border-amber-500/30 pb-1 font-[Georgia,serif] text-xl font-bold text-zinc-900 dark:text-zinc-50">
                    {section.title}
                  </h2>
                  <div className="mt-4">
                    <WikiArticleBody markdown={section.body} selectable={wikiEditable} />
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <WikiArticleBody markdown={displayMarkdown} onHeadings={setToc} selectable={wikiEditable} />
          )}

          {toc.length > 0 && parsedSections.length <= 1 ? (
            <nav
              className="mt-8 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-950/50 lg:hidden"
              aria-label="On this page"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Contents</p>
              <ul className="mt-2 space-y-1 text-sm">
                {toc.map((h) => (
                  <li key={h.id} className={h.level === 3 ? "pl-3" : ""}>
                    <button
                      type="button"
                      onClick={() => scrollTo(h.id)}
                      className="text-left text-amber-800 hover:underline dark:text-amber-300"
                    >
                      {h.title}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900/80">
            <div className="border-b border-zinc-200 bg-zinc-100 px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              Infobox
            </div>
            <dl className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
              {infoboxRows(chunk).map((row) => (
                <div key={row.label} className="px-3 py-2">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    {row.label}
                  </dt>
                  <dd className="mt-0.5 capitalize text-zinc-800 dark:text-zinc-200">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {toc.length > 0 && parsedSections.length <= 1 ? (
            <nav
              className="hidden rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900/80 lg:block"
              aria-label="On this page"
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Contents</p>
              <ul className="mt-2 space-y-1 text-sm">
                {toc.map((h) => (
                  <li key={h.id} className={h.level === 3 ? "pl-3" : ""}>
                    <button
                      type="button"
                      onClick={() => scrollTo(h.id)}
                      className="text-left text-amber-800 hover:underline dark:text-amber-300"
                    >
                      {h.title}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </aside>
      </div>
    </article>
  );
}
