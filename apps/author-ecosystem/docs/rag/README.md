# Author RAG — canon templates and code map

This folder holds the **RAG-ready authoring templates** (static ledgers, state ledgers, tags, and cross-links). Use them as the contract for what “author-only” lore documents should contain before ingest or librarian flows run.

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

## Where the server implements RAG

- **`server/src/routes/ragRoutes.js`** — HTTP ingest (`/api/rag/ingest`), vector chat (`/api/rag/chat`), audience and `source_type` rules (for example outline/theme author-only).
- **`server/src/services/ragChunker.js`** — Character-chunk splitting used by ingest.
- **`server/src/lib/narrative/LibrarianChat.ts`** — Lore librarian retrieval and grounded answer shaping over narrative chunks.
- **`server/src/database/schema.sql`** — `rag_sources`, `rag_chunks`, and related indexes (when using the Postgres-backed RAG tables).

## Chunk metadata (`rag_chunks.metadata`)

- **JSON Schema:** [rag-chunk-metadata.schema.json](./rag-chunk-metadata.schema.json) — required fields per chunk: `source_type`, `spoiler_level`, `plot_point`, `ledger`, `tags`.
- **Ingest body (API):** [rag-ingest-body.schema.json](./rag-ingest-body.schema.json) — `text` *or* `sections[]` with `section_path` + optional `heading_*`; optional `metadata_defaults` merged into every chunk.
- **Tag grammar (prose):** `[TAG: Name | Value: X]`. **In JSON:** each tag is `{ "name": "Name", "value": "X" }` inside `tags[]`.
- **Narrative master logic:** `theme_sheet` and `trope_sensitivity_sheet` chunks must set `narrative_master_logic: true`. At retrieval time, if they conflict with a generic API rule or another source, **these win**.
- **Postgres `rag_source_type`:** greenfield `schema.sql` defines all seven values. **Existing databases:** run `server/src/database/migrations/20260513120000_rag_source_type_and_metadata_gin.sql` (renames `character_bible` → `character_sheet`, adds new enum labels, creates GIN index).

## Author HUD (`POST /api/rag/chat`)

- **Flow:** Two retrieval passes on `rag_chunks`: (1) **`narrative_master_logic: true`** chunks, ordered by embedding similarity (cap **8**); (2) **lore** chunks with the same filters but **`NOT narrative_master_logic`**, cap **`top_k`** (1–20). Prompt places **NARRATIVE MASTER CONTEXT** above **LORE CONTEXT** so themes/sensitivity **audit** vector hits before answer composition.
- **Prefixes:** Each bullet uses **`[CANON]`** (uploaded lore only) and, when scientific cross-check is active, **`[REAL-WORLD]`** (established science + cross-check anchor) and optional **`[WARNING]`** when real-world rules contradict explicit canon structures without an in-world explanation. If cross-check is **off** or **not triggered**, only **`[CANON]`** is allowed.
- **`hud_state` (optional):** `{ "max_spoiler_level": "none"|"low"|"medium"|"high", "max_plot_point_order": <int> }`. If **either** field is present, HUD filtering is **on** for that dimension; omitted dimension stays permissive (all spoiler levels, or unrestricted plot order). If **`hud_state`** is absent entirely, no spoiler/plot SQL predicates are applied.
- **`scientific_cross_check` (optional):** `"auto"` (default) runs the **Scientific Logic** Gemini pass when the question matches distance/physics/chemistry/biology heuristics; `"force"` always runs it; `"off"` / `false` disables it. Response includes **`scientific_cross_check`** with `mode`, `triggered`, and optional **`anchor`** (tool output).
- **GIN:** Master pass uses `metadata @> '{"narrative_master_logic":true}'::jsonb`. Spoiler ceiling uses **OR** of `metadata @> '{"spoiler_level":"<allowed>"}'` for each allowed level (uses **`idx_rag_chunks_metadata_gin`**). Plot progression uses `metadata->>'plot_point_order'` compared to `max_plot_point_order`, with `not_applicable` / `parallel_arc` / null order treated as always allowed.
- **Bullets:** System prompt targets **25–40** words for `[CANON]` / `[REAL-WORLD]`; **`enforceAuthorHudBullets`** hard-caps those at **40** words. **`[WARNING]`** may run up to **80** words. Minimum length for canon/real-world is model-guided, not mechanically padded.

### Template → `source_type`

| Template file | `source_type` |
|---------------|----------------|
| RAG READY WORLD BIBLE | `world_bible` |
| World as a Character Sheet | `world_as_character` |
| Rag Ready Character Sheet | `character_sheet` |
| Rag Ready Outline | `story_outline` |
| Rag Ready Themes Sheet | `theme_sheet` |
| Rag Ready Trope_Sensitivity Sheet | `trope_sensitivity_sheet` |
| RAG READY Side Story & Parallel Arc | `parallel_arc_sheet` |

Point new prompts, validators, or ingest pipelines at this README so implementers keep template semantics and API behavior aligned.

## Lore-Git (`/api/lore-git` on the Node server)

- **`POST /api/lore-git/post-chapter`** — After a chapter save, returns **`interview_questions`** (3) and **`chapter_fingerprint`** (hash of author + chapter id + full text). Client re-sends the same `chapter_text` on commit or the fingerprint fails.
- **`POST /api/lore-git/commit`** — Body: `chapter_text`, **`interview_answers`** (exactly 3 strings), required **`stylistic_metadata`**, optional **`hud_answer`** or **`hud_answer_bullets`** (paste the Author HUD `/api/rag/chat` bullet block — `[CANON]` / `[REAL-WORLD]` lines). The **HAL Stylistic Analyzer** (`halStylisticAnalyzer.js`) compares the chapter to those bullets plus HAL hints, computes **`authorship_delta_score`** and full **`stylistic_analysis`** (lexical diversity, syntactic spread, pet-phrase hits), and stores them on every **`rag_chunks.metadata`** for this wiki snapshot together with **`stylistic_analysis_version`** (integer for Git-style bumps).
- **`POST /api/lore-git/publish-wiki`** — Sets **`wiki_hard_locked`**, **`wiki_visibility: "canon"`**, and **`audience: "fan"`** for matching wiki rows so fan / public lore bots can retrieve them. Optional **`chapter_id`** scopes the update.
- **RAG chat:** Pass **`include_wiki_drafts: true`** on **`POST /api/rag/chat`** so author HUD retrieval includes draft wiki snapshots; default **false** hides draft wiki from vector context (even with `audience: "author"`) so automated “lore bot” callers do not leak drafts. **`hud_state.max_plot_point_order`** still filters eligible chunks when set.
