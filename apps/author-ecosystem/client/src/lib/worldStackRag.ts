import {
  buildPanelRagLineFromSchema,
  type RagOutlinePanelSchema,
} from "./plotEngineRagOutlineSchema";
import type { LocationNode, StackEntry } from "./worldBuildTypes";

export function slugTag(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function buildStampedPathTitles(path: LocationNode[]): string {
  return path.map((n) => n.title.trim()).filter(Boolean).join(" › ");
}

export function buildHierarchyContextTags(path: LocationNode[]): string[] {
  return path
    .map((n) => {
      const title = n.title.trim();
      if (!title) return "";
      return `hierarchy:${n.kind}:${slugTag(title)}`;
    })
    .filter(Boolean);
}

export function parseHierarchyTagsFromWikiTags(tags: string[]): string[] {
  return tags.filter((t) => t.startsWith("hierarchy:"));
}

export function buildStackEntryRagLine(
  entry: StackEntry,
  layerSchema: RagOutlinePanelSchema,
  parentTitle: string
): string {
  const base = buildPanelRagLineFromSchema(layerSchema, entry.outlineFields);
  if (!base) return "";
  const parent =
    entry.stampedPathTitles?.trim() ||
    parentTitle.trim() ||
    entry.stampedParentTitle?.trim() ||
    "";
  if (!parent) return base;
  const segments = base.replace(/^(RAG TAG|SENSES TAG|STYLE TAG|POV TAG):\s*/, "");
  return `${layerSchema.tagGroup}: ${segments.replace(/\]$/, ` | [Parent: ${parent}]`)}`;
}

export function stackEntryWikiTags(
  entry: StackEntry,
  parentTitle: string,
  locationPath: string,
  storyScope: string
): string[] {
  const tags = [
    `stack_layer:${entry.layer}`,
    `location:${entry.locationId}`,
    `parent:${slugTag(parentTitle)}`,
    `story_scope:${storyScope}`,
  ];
  if (locationPath) tags.push(`location_path:${locationPath}`);
  if (entry.stampedPathTitles) {
    tags.push(`path_titles:${slugTag(entry.stampedPathTitles.replace(/ › /g, "_"))}`);
  }
  for (const t of entry.contextPathTags ?? []) {
    if (!tags.includes(t)) tags.push(t);
  }
  for (const t of entry.authorTags ?? []) {
    if (t.startsWith("hierarchy:") && !tags.includes(t)) tags.push(t);
    else if (!t.startsWith("hierarchy:")) tags.push(`author:${t}`);
  }
  return tags;
}
