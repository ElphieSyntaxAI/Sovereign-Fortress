import { useMemo } from "react";

import type { OutlineLoreKind } from "../../lib/outlineLoreKinds";
import {
  buildEnvironmentTraitLinks,
  buildWikiEntityCard,
  groupEnvironmentTraitsByTheme,
  resolveAuthorDisplayName,
  type WikiChunkLike,
} from "../../lib/wikiEntityCard";
import { wikiChunkKind, wikiChunkTitle } from "../../lib/wikiArticleParse";
import { WikiEntityLink } from "./WikiEntityLink";
import { WikiEnvironmentTraitLink } from "./WikiEnvironmentTraitLink";

type WikiManuscriptOverviewProps = {
  manuscriptTitle?: string | null;
  authorName?: string | null;
  chunks: WikiChunkLike[];
  onOpenArticle: (chunkId: string) => void;
};

function chunksByKind(chunks: WikiChunkLike[], kind: OutlineLoreKind): WikiChunkLike[] {
  return chunks
    .filter((c) => wikiChunkKind(c) === kind)
    .sort((a, b) => wikiChunkTitle(a).localeCompare(wikiChunkTitle(b)));
}

function EntityListSection(props: {
  title: string;
  hint: string;
  empty: string;
  chunks: WikiChunkLike[];
  onOpenArticle: (id: string) => void;
}) {
  const cards = useMemo(
    () => props.chunks.map((c) => ({ chunk: c, card: buildWikiEntityCard(c) })),
    [props.chunks]
  );

  return (
    <section className="wiki-overview-section">
      <h2 className="border-b border-amber-500/35 pb-1 font-[Georgia,serif] text-xl font-bold text-zinc-900 dark:text-zinc-50">
        {props.title}
      </h2>
      <p className="mt-1 text-xs text-zinc-500">{props.hint}</p>
      {cards.length === 0 ? (
        <p className="mt-3 text-sm italic text-zinc-500">{props.empty}</p>
      ) : (
        <ul className="mt-4 flex flex-wrap gap-x-3 gap-y-2">
          {cards.map(({ chunk, card }) => (
            <li key={chunk.id} className="inline">
              <WikiEntityLink
                label={card.title}
                card={card}
                onOpenArticle={props.onOpenArticle}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function WikiManuscriptOverview({
  manuscriptTitle,
  authorName,
  chunks,
  onOpenArticle,
}: WikiManuscriptOverviewProps) {
  const characters = useMemo(() => chunksByKind(chunks, "character"), [chunks]);
  const settings = useMemo(() => chunksByKind(chunks, "setting"), [chunks]);
  const envTraits = useMemo(() => buildEnvironmentTraitLinks(chunks), [chunks]);
  const envGroups = useMemo(() => groupEnvironmentTraitsByTheme(envTraits), [envTraits]);

  const title = manuscriptTitle?.trim() || "Untitled manuscript";
  const author = authorName?.trim() || resolveAuthorDisplayName(null);

  return (
    <div className="wiki-manuscript-overview px-6 py-8">
      <header className="border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-700 dark:text-amber-400">
          Lore encyclopedia
        </p>
        <h1 className="mt-2 font-[Georgia,serif] text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {title}
        </h1>
        <p className="mt-2 text-base text-zinc-600 dark:text-zinc-400">
          By{" "}
          <span className="font-medium text-zinc-800 dark:text-zinc-200">{author}</span>
        </p>
        <p className="mt-3 max-w-2xl text-sm text-zinc-500">
          Hover or tap a name for a quick lore card — description, traits, and abilities. Click to
          open the full article.
        </p>
      </header>

      <div className="mt-8 space-y-10">
        <EntityListSection
          title="Characters"
          hint="Cast and story roles — hover for bio, traits, and abilities."
          empty="No characters yet. Add them from the + rail when editing."
          chunks={characters}
          onOpenArticle={onOpenArticle}
        />

        <EntityListSection
          title="Settings"
          hint="Places and venues where scenes unfold."
          empty="No settings yet."
          chunks={settings}
          onOpenArticle={onOpenArticle}
        />

        <section className="wiki-overview-section">
          <h2 className="border-b border-teal-500/35 pb-1 font-[Georgia,serif] text-xl font-bold text-zinc-900 dark:text-zinc-50">
            Environmental characteristics
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            World-level forces, climate, and ecology — each trait opens a detail card.
          </p>

          {envGroups.length === 0 ? (
            <p className="mt-3 text-sm italic text-zinc-500">No environment lore yet.</p>
          ) : (
            <div className="mt-5 space-y-6">
              {envGroups.map((group) => (
                <div key={group.theme}>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-teal-800 dark:text-teal-300">
                    {group.theme}
                  </h3>
                  <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-2">
                    {group.items.map((trait) => (
                      <li key={trait.id} className="inline">
                        <WikiEnvironmentTraitLink trait={trait} onOpenArticle={onOpenArticle} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
