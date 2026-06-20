import type { OutlineLoreKind } from "./outlineLoreKinds";
import { getOutlineLoreKindConfig } from "./outlineLoreKinds";
import { parseFormStateFromMetadata } from "./wikiEntityForms";
import {
  parseWikiArticleSections,
  wikiChunkKind,
  wikiChunkKindLabel,
  wikiChunkTitle,
  wikiDisplayBody,
  type WikiChunkLike,
} from "./wikiArticleParse";

export type WikiEntityTrait = {
  id: string;
  label: string;
  value: string;
};

export type WikiEntityCardData = {
  chunkId: string;
  title: string;
  kind: OutlineLoreKind | "other";
  kindLabel: string;
  summary: string;
  traits: WikiEntityTrait[];
  abilities: WikiEntityTrait[];
};

export type WikiEnvironmentTraitLink = {
  id: string;
  label: string;
  description: string;
  details: WikiEntityTrait[];
  chunkId: string;
  chunkTitle: string;
};

const CHARACTER_SUMMARY_KEYS = ["who", "role", "freeform"];
const CHARACTER_ABILITY_KEYS = [
  "persona_logic",
  "speech",
  "values",
  "motivation",
  "like",
  "visual_identity",
  "persona_emotion",
  "agenda",
  "flaw_or_secret",
  "hidden_secret",
];

const SETTING_SUMMARY_KEYS = ["scene_now", "parent_place", "micro_climate", "freeform"];
const SETTING_DETAIL_KEYS = [
  "lighting",
  "landmarks",
  "soundscape",
  "local_authority",
  "security",
  "local_bans",
  "local_fauna",
  "slang",
];

const ENVIRONMENT_SUMMARY_KEYS = ["exterior_force", "climate", "impact", "world_tone", "freeform"];

function slugId(...parts: string[]): string {
  return parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function firstSentence(text: string, max = 220): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "";
  const m = t.match(/^(.{1,220}?[.!?])(\s|$)/);
  if (m?.[1]) return m[1].trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function pickAnswers(
  answers: Record<string, string>,
  keys: string[]
): WikiEntityTrait[] {
  const out: WikiEntityTrait[] = [];
  for (const key of keys) {
    const value = String(answers[key] ?? "").trim();
    if (!value) continue;
    const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    out.push({ id: key, label, value });
  }
  return out;
}

function traitsFromSections(chunkId: string, content: string): WikiEntityTrait[] {
  return parseWikiArticleSections(content)
    .filter((s) => s.id !== "overview")
    .map((s) => ({
      id: slugId(chunkId, s.id),
      label: s.title,
      value: s.body.trim(),
    }))
    .filter((t) => t.value);
}

function summaryFromBody(content: string): string {
  const body = wikiDisplayBody(content);
  return firstSentence(body.replace(/^#+\s+.+$/gm, "").replace(/\*\*[^*]+\*\*/g, "").trim());
}

export function buildWikiEntityCard(chunk: WikiChunkLike): WikiEntityCardData {
  const kind = wikiChunkKind(chunk);
  const title = wikiChunkTitle(chunk);
  const parsed = parseFormStateFromMetadata(chunk.metadata);
  const answers = parsed?.answers ?? {};
  const sectionTraits = traitsFromSections(chunk.id, chunk.content);

  let summary = "";
  let traits: WikiEntityTrait[] = [];
  let abilities: WikiEntityTrait[] = [];

  if (kind === "character") {
    summary =
      pickAnswers(answers, CHARACTER_SUMMARY_KEYS).map((t) => t.value).join(" ") ||
      sectionTraits.find((t) => /who|bio|role/i.test(t.label))?.value ||
      summaryFromBody(chunk.content);
    traits = pickAnswers(answers, ["role", "who", "like", "motivation", "backstory"]);
    if (!traits.length) traits = sectionTraits.slice(0, 4);
    abilities = pickAnswers(answers, CHARACTER_ABILITY_KEYS);
    if (!abilities.length) {
      abilities = sectionTraits.filter((t) =>
        /speech|persona|values|agenda|ability|skill|power/i.test(t.label)
      );
    }
  } else if (kind === "setting") {
    summary =
      pickAnswers(answers, SETTING_SUMMARY_KEYS).map((t) => t.value).join(" ") ||
      summaryFromBody(chunk.content);
    traits = pickAnswers(answers, SETTING_SUMMARY_KEYS);
    if (!traits.length) traits = sectionTraits.slice(0, 4);
    abilities = pickAnswers(answers, SETTING_DETAIL_KEYS);
    if (!abilities.length) abilities = sectionTraits.slice(4, 8);
  } else if (kind === "environment") {
    summary =
      pickAnswers(answers, ENVIRONMENT_SUMMARY_KEYS).map((t) => t.value).join(" ") ||
      summaryFromBody(chunk.content);
    traits = pickAnswers(answers, ENVIRONMENT_SUMMARY_KEYS);
    if (!traits.length) traits = sectionTraits;
    abilities = pickAnswers(answers, [
      "gravity_atmosphere",
      "biome",
      "culture_values",
      "history_wound",
      "system_law",
      "tech_level",
    ]);
  } else {
    summary = summaryFromBody(chunk.content);
    traits = sectionTraits.slice(0, 6);
  }

  if (!summary && traits[0]?.value) summary = firstSentence(traits[0].value);
  if (!summary) summary = "Open for full article details.";

  let kindLabel = wikiChunkKindLabel(kind);
  try {
    if (kind !== "other") kindLabel = getOutlineLoreKindConfig(kind as OutlineLoreKind).label;
  } catch {
    /* keep */
  }

  return {
    chunkId: chunk.id,
    title,
    kind,
    kindLabel,
    summary: firstSentence(summary, 280),
    traits: traits.filter((t) => t.value).slice(0, 6),
    abilities: abilities.filter((t) => t.value).slice(0, 5),
  };
}

/** Environment articles split into characteristic links (form fields or ### sections). */
export function buildEnvironmentTraitLinks(chunks: WikiChunkLike[]): WikiEnvironmentTraitLink[] {
  const envChunks = chunks.filter((c) => wikiChunkKind(c) === "environment");
  const links: WikiEnvironmentTraitLink[] = [];

  for (const chunk of envChunks) {
    const chunkTitle = wikiChunkTitle(chunk);
    const parsed = parseFormStateFromMetadata(chunk.metadata);
    const answers = parsed?.answers ?? {};
    const sections = parseWikiArticleSections(chunk.content).filter((s) => s.id !== "overview");

    const fromAnswers = Object.entries(answers)
      .map(([key, raw]) => {
        const value = String(raw ?? "").trim();
        if (!value) return null;
        const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        return {
          id: slugId(chunk.id, key),
          label,
          description: firstSentence(value, 300),
          details: [{ id: key, label, value }],
          chunkId: chunk.id,
          chunkTitle,
        };
      })
      .filter((x): x is WikiEnvironmentTraitLink => Boolean(x));

    const fromSections = sections.map((s) => ({
      id: slugId(chunk.id, s.id),
      label: s.title,
      description: firstSentence(s.body, 300),
      details: [{ id: s.id, label: s.title, value: s.body.trim() }],
      chunkId: chunk.id,
      chunkTitle,
    }));

    if (fromSections.length) links.push(...fromSections);
    else if (fromAnswers.length) links.push(...fromAnswers);
    else {
      const card = buildWikiEntityCard(chunk);
      links.push({
        id: slugId(chunk.id, "overview"),
        label: chunkTitle,
        description: card.summary,
        details: card.traits,
        chunkId: chunk.id,
        chunkTitle,
      });
    }
  }

  return links;
}

export function groupEnvironmentTraitsByTheme(
  traits: WikiEnvironmentTraitLink[]
): { theme: string; items: WikiEnvironmentTraitLink[] }[] {
  const buckets = new Map<string, WikiEnvironmentTraitLink[]>();

  for (const item of traits) {
    const theme =
      /climate|weather|atmosphere|gravity|biome|geo/i.test(item.label)
        ? "Climate & planet"
        : /culture|value|history|wound|law|treaty|tech/i.test(item.label)
          ? "Culture & systems"
          : /impact|force|pressure|exterior|war|storm/i.test(item.label)
            ? "Active forces"
            : item.chunkTitle;

    const list = buckets.get(theme) ?? [];
    list.push(item);
    buckets.set(theme, list);
  }

  const order = ["Climate & planet", "Active forces", "Culture & systems"];
  const themes = [...buckets.keys()].sort((a, b) => {
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return themes.map((theme) => ({ theme, items: buckets.get(theme) ?? [] }));
}

export function resolveAuthorDisplayName(email?: string | null): string {
  if (!email?.trim()) return "Author";
  const local = email.split("@")[0]?.trim();
  if (!local) return "Author";
  return local.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
