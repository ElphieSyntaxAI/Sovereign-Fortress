# Author Manuscript Hub & Project Switcher

**SSoT for Active Project selection and per-book isolation.**  
**Roadmap evidence:** Phase 1 project switcher (100%) in [`AUTHOR_ECOSYSTEM_ROADMAP.md`](../AUTHOR_ECOSYSTEM_ROADMAP.md)

---

## Selection identity

An **Active Project** is always:

| Field | Required | Role |
| :--- | :---: | :--- |
| `manuscriptId` | yes | Book row in `p4_manuscripts` |
| `tenantId` | yes | Author DB tenant (UUID) |
| `seriesId` | optional | `p4_series` membership |

Client storage / types: `activeManuscriptStorage.ts`, `manuscriptTypes.ts` (`hubRowToSelection`), `NarrativeContext.tsx`.

---

## Hub + nav

| Surface | Behavior |
| :--- | :--- |
| **Manuscript Hub** | Kanban / activate; rename/delete series-safe |
| **Nav `MS:` dropdown** | Series groups + standalones; confirm on switch |
| **Per-book remount** | Outline, wiki, drafting keys include `manuscriptId` — no cross-book client bleed |

Components: `ManuscriptHub.tsx`, `ManuscriptSelector.tsx` / ActiveManuscript chip, `PlanningCommandCenter.tsx`.

---

## Series RAG share

Sibling manuscripts in the **same** `p4_series` may share wiki/lore retrieval (`seriesRagScope.ts`). Never share across different series or unrelated standalones.

---

## Invariants

1. Hub activate must set all three identity fields the UI needs (`manuscriptId` + `tenantId` + `seriesId` when in-series).
2. Switching books remounts scoped trees; do not reuse in-memory wiki/outline from the previous book.
3. BFF manuscript list/select routes must assert tenant session (`assertBffManuscriptTenantSession`).
