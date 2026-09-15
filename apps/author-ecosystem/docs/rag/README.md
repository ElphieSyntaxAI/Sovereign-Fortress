# Author RAG — canon templates and code map

This folder holds the **RAG-ready authoring templates** (static ledgers, state ledgers, tags, and cross-links). Use them as the contract for what “author-only” lore documents should contain before ingest or librarian flows run.

**Machine contract (SSOT):** tag / Link / Domains grammar below must match `server/src/lib/documentIngestRagParser.ts`. Prefer structured headings + tags over freeform prose for 10/10 entity extract (history, species, galaxies, entwined gov↔religion, etc.).

## Templates in this folder

| File | Role |
|------|------|
| [Rag Ready Outline.md](./Rag%20Ready%20Outline.md) | Plot structure, era tags, POV, senses, breadcrumbs |
| [Rag Ready Character Sheet.md](./Rag%20Ready%20Character%20Sheet.md) | Character static ledger + per–plot-point state ledger |
| [RAG READY WORLD BIBLE.md](./RAG%20READY%20WORLD%20BIBLE.md) | Immutable world laws + spatial/planetary detail + world state ledger |
| [World as a Character Sheet.md](./World%20as%20a%20Character%20Sheet.md) | World persona, mood, push-back vs. characters |
| [Rag Ready Themes Sheet.md](./Rag%20Ready%20Themes%20Sheet.md) | Central thematic question, proofs, live thematic audit |
| [RAG READY Side Story & Parallel Arc.md](./RAG%20READY%20Side%20Story%20%26%20Parallel%20Arc.md) | Parallel arcs, collision forecast, relevance pruning |
| [Rag Ready Trope_Sensitivity Sheet.md](./Rag%20Ready%20Trope_Sensitivity%20Sheet.md) | Cultural rules, trope subversion, sensitivity state |

## Tag + Link grammar (ingest)

**Canonical RAG tags** (all accepted by ingest):

```text
[RAG TAG: History: The Collapse | Spoiler Level: Medium]
RAG TAG: [Spatial_Bio: Glowmoth]
[TAG: Religion: Twin Choir | Domains: religion]   ← alias; same as RAG TAG
```

**Cross-links** (become `wiki_metadata.related_to[]`):

```text
[Link: Character_Sheet | Field: Era_Beginning_Hook]
[Link: Outline | Field: Era_Beginning_Hook]
```

**Secondary domains** (entwined lore — become `wiki_metadata.secondary_domains[]`):

```text
Domains: government, religion
```

## Provenance Ref (every wiki fact)

| `provenance.source` | Meaning |
|---------------------|---------|
| `planning_upload` | Document ingest (file / Google Doc) |
| `planning_manual` | Entered in Planning / wiki UI |
| `live_manuscript` | Chapter facts extract or author tag from the extension |

Shown in UI as e.g. `Ref: Live manuscript · Ch. 12` or `Ref: Planning upload · world_bible`.

## Lore Merges (conflict review)

When new lore **conflicts** with similar/same existing wiki facts, the write opens a **Lore Merge** (MR-style) instead of overwriting. Author is notified; resolve on **Lore Wiki → Lore Merges**: keep existing, accept incoming, edit merge, or dismiss.

APIs: `GET /api/wiki/merges`, `POST /api/wiki/merges/:id/resolve`, `GET /api/wiki/merges/notifications`.

## Chapter facts (extension / BFF)

- `POST /api/chapter-facts/propose` — major events from chapter text
- `POST /api/chapter-facts/commit` — backfill draft wiki or open Lore Merges
- `POST /api/chapter-facts/tag` — selection → breadcrumb / major_event / character_beat / continuity_note

HAL biometrics + linguistic rolling-5 path is unchanged (`POST /api/hal/session`).

### Worked examples

**Galaxy + creature (spatial hierarchy):**

```text
## GALAXIES
Veil Arm is a barred spiral rimward of the Core.
RAG TAG: [Galaxy: Veil Arm]
[Link: World_Bible | Field: Spatial_Root]

## SPECIES
Glowmoth: bioluminescent pollinator native to Kestrel Reach ice caves.
RAG TAG: [Spatial_Bio: Glowmoth]
Domains: species, fauna
[Link: World_Bible | Field: Planet:Kestrel_Reach]
```

**Entwined government ↔ religion:**

```text
## GOVERNMENT
The Twin Choir Concordat seats clergy on the planetary council.
RAG TAG: [System_Law: Government]
Domains: government, religion
[Link: World_Bible | Field: Religion:Twin_Choir]
```

Ingest emits **one fact card per named entity / RAG TAG**, not one blob per section. Librarian Q&A for authors includes **draft** wiki by default so freshly committed planning docs are queryable.

## Where the server implements RAG

- **Document ingest (primary for Manuscripts uploads):** `server/src/lib/documentIngestRagParser.ts` + MSGF CONVERGE → `p4_narrative_library_chunks` / wiki snapshots. Spec: `docs/integrations/technical-specs/AUTHOR_DOCUMENT_INGEST_MSGF.md`.
- **`server/src/routes/ragRoutes.js`** — Legacy HTTP ingest (`/api/rag/ingest`) + HUD chat (`/api/rag/chat`).
- **`server/src/lib/narrative/LibrarianChat.ts`** — Lore librarian over `p4_narrative_library_chunks` (author audience includes draft wiki by default).
- **`server/src/database/schema.sql`** — `rag_sources`, `rag_chunks` (legacy), plus P4 narrative library tables.

## Chunk metadata (`rag_chunks.metadata` / wiki_metadata)

- **JSON Schema:** [rag-chunk-metadata.schema.json](./rag-chunk-metadata.schema.json) — required fields per chunk: `source_type`, `spoiler_level`, `plot_point`, `ledger`, `tags`.
- **Ingest body (API):** [rag-ingest-body.schema.json](./rag-ingest-body.schema.json) — `text` *or* `sections[]` with `section_path` + optional `heading_*`; optional `metadata_defaults` merged into every chunk.
- **Tag grammar (prose):** prefer `[RAG TAG: Name | …]` or `RAG TAG: [Name | …]`. Alias `[TAG: …]` is accepted. **In JSON:** each tag is `{ "name": "Name", "value": "X" }` inside `tags[]`.
- **Cross-domain:** optional `secondary_domains: string[]` and `related_to: { sheet, field? }[]` on wiki metadata.
- **Narrative master logic:** `theme_sheet` and `trope_sensitivity_sheet` chunks must set `narrative_master_logic: true`. At retrieval time, if they conflict with a generic API rule or another source, **these win**.
- **Postgres `rag_source_type`:** greenfield `schema.sql` defines all seven values. **Existing databases:** run `server/src/database/migrations/20260513120000_rag_source_type_and_metadata_gin.sql`.

## Author HUD (`POST /api/rag/chat`)

- **Flow:** Two retrieval passes on `rag_chunks`: (1) **`narrative_master_logic: true`** chunks, ordered by embedding similarity (cap **8**); (2) **lore** chunks with the same filters but **`NOT narrative_master_logic`**, cap **`top_k`** (1–20). Prompt places **NARRATIVE MASTER CONTEXT** above **LORE CONTEXT** so themes/sensitivity **audit** vector hits before answer composition.
- **Prefixes:** Each bullet uses **`[CANON]`** (uploaded lore only) and, when scientific cross-check is active, **`[REAL-WORLD]`** / optional **`[WARNING]`**.
- **`hud_state` (optional):** `{ "max_spoiler_level": "none"|"low"|"medium"|"high", "max_plot_point_order": <int> }`.
- **`include_wiki_drafts`:** default **false** for automated lore bots; set **true** (or use Librarian with `audience: "author"`) so draft planning wiki is visible while writing.
- **`scientific_cross_check` (optional):** `"auto"` | `"force"` | `"off"`.

### Template → `source_type`

| Template file | `source_type` | Upload slot hint |
|---------------|----------------|------------------|
| RAG READY WORLD BIBLE | `world_bible` | `world_bible` |
| World as a Character Sheet | `world_as_character` | `world_bible` |
| Rag Ready Character Sheet | `character_sheet` | `character_sheet` |
| Rag Ready Outline | `story_outline` | `world_bible` (section pairing) |
| Rag Ready Themes Sheet | `theme_sheet` | `world_bible` (section pairing) |
| Rag Ready Trope_Sensitivity Sheet | `trope_sensitivity_sheet` | `world_bible` (section pairing) |
| RAG READY Side Story & Parallel Arc | `parallel_arc_sheet` | `world_bible` (section pairing) |
| Full manuscript / draft | (narrative library lore/plot) | `current_draft` |

Point new prompts, validators, or ingest pipelines at this README so implementers keep template semantics and API behavior aligned.

## Lore-Git (`/api/lore-git` on the Node server)

- **`POST /api/lore-git/post-chapter`** — After a chapter save, returns **`interview_questions`** (3) and **`chapter_fingerprint`**.
- **`POST /api/lore-git/commit`** — Body: `chapter_text`, **`interview_answers`**, **`stylistic_metadata`**, optional HUD bullets.
- **`POST /api/lore-git/publish-wiki`** — Sets **`wiki_hard_locked`**, **`wiki_visibility: "canon"`**, **`audience: "fan"`**.
- **RAG chat:** Pass **`include_wiki_drafts: true`** so author HUD retrieval includes draft wiki snapshots; default **false** hides drafts from lore-bot callers.
