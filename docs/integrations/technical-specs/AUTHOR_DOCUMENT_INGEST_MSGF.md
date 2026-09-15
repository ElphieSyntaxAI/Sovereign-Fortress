# Author document ingest — MSGF pipeline

Author Ecosystem document import (file upload + Google Docs) follows **MSGF V3.2** phases for mapping planning docs into wiki + outline data.

**Authoring contract:** [`apps/author-ecosystem/docs/rag/README.md`](../../../apps/author-ecosystem/docs/rag/README.md) — RAG TAG / Link / Domains grammar must match the live parser.

## Flow

| Phase | Where | What |
|-------|--------|------|
| **SWEEP** | `documentIngestSignals.ts` | Tab/table/chapter/scene signals; optional keyword hits (hints only) |
| **CROSS-REF** | `documentIngestMsgfPipeline.ts` | `getLogicLineage` (1.1.1 Vault) for ingest mapping reinforcement |
| **CONVERGE** | `documentIngestMsgfPipeline.ts` | Gemini JSON extract → `proposed_wiki` + `outline_beats` |
| **RAG parse** | `documentIngestRagParser.ts` | Section/RAG TAG/table → entity fact cards; Links → `related_to`; Domains → `secondary_domains` |
| **Accuracy** | `groundProposedWikiToSource` | Drops excerpts not found in source text |
| **Compile** | `documentIngestCompile.ts` | Dedupe beats/wiki, prune duplicate macro sections |
| **DEFEND** | `documentIngestMsgfGuard.ts` | Shadow preflight, structure-merge risk, dual review on commit |
| **PERSIST** | `commitDocumentIngest.ts` | `p4_narrative_library_chunks`, plot/lore vectors, wiki upsert (fails loud if lore/wiki empty), MSGF SWEEP shards |

## Environment (BFF / `packages/msgf/.env.local`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `MSGF_DOCUMENT_INGEST_MODE` | `converge` | `converge` \| `hybrid` \| `heuristic` |
| `MSGF_DOCUMENT_INGEST_KEYWORDS` | built-in list | Comma-separated hints or JSON `{"hints":[],"planning_layers":[]}` |
| `MSGF_DOCUMENT_INGEST_SHADOW` | on | Set `off` to skip shadow preflight on commit |
| `GEMINI_API_KEY` / `GOOGLE_API_KEY` | — | Required for CONVERGE (heuristic-only if unset) |
| `MSGF_APP_URL` | `http://127.0.0.1:3001` | SWEEP ingest on commit |
| `MSGF_INGEST_API_KEY` | — | Optional tenant ingest auth |

## Source size ceilings

| Slot | Cap | Notes |
|------|-----|--------|
| `world_bible` / `character_sheet` | 400k chars | Planning sheets |
| `current_draft` | 1.2M chars | ~80k+ word manuscripts; narrative library is primary success; wiki is chapter-scoped |

## Tag / Link grammar (must match templates)

```text
[RAG TAG: History: The Collapse | Spoiler Level: Medium]
RAG TAG: [Spatial_Bio: Glowmoth]
[TAG: Religion: Twin Choir]                    ← alias
[Link: World_Bible | Field: Religion:Twin_Choir]
Domains: government, religion                  ← secondary_domains
```

## 1.1.1 lineage (commit SWEEP)

Structured shards posted to `POST /api/msgf/ingest` use `PULSE_BUG_INDEX` under **1.0_AUTHOR / 1.1_INGEST**:

| Instance | Shard |
|----------|--------|
| `1.1.1_WIKI_SOURCE` | Compiled source excerpt |
| `1.1.1_WIKI_CHARACTER` | Character wiki JSON |
| `1.1.1_WIKI_SETTING` | Setting / location wiki JSON |
| `1.1.1_WIKI_PLOT_BEAT` | Plot / scene wiki JSON |
| `1.1.1_WIKI_OUTLINE` | Outline beats aggregate |

Hall learning on reject: `1.1.1_DOCUMENT_BAD_MAPPING`, `1.1.1_INGEST_SHADOW_BLOCK`.

## API

Scan responses include `msgf_meta`:

```json
{
  "mode": "converge",
  "signals_summary": "Structural signals: 12 tabs; chapter headings",
  "keyword_hits": ["chapter breakdown", "split pov"],
  "grounding": { "kept": 24, "dropped": 2 },
  "lineage_reinforcement": "Positive Reinforcement: ..."
}
```

## Design rules

1. **Keywords are hints**, not matchers — the model must not invent content to satisfy a keyword.
2. **Heuristics are fallback** — table/chapter parsers fill gaps when LLM is off or in `hybrid` mode.
3. **Works for any doc layout** — no author-specific regex lists in the CONVERGE path; structure comes from content + signals.
4. **Entwined domains stay linked** — do not force a theocratic empire into only `government` or only `religion`; keep `secondary_domains` + `related_to`.
5. **Commit honesty** — lore embed / wiki upsert failures fail the commit (not silent warn) when those rows were expected.
6. **Provenance Ref** — every wiki fact stamps `provenance.source`: `planning_upload` | `planning_manual` | `live_manuscript`.
7. **Lore Merges** — conflicting same/similar lore opens an MR (`p4` chunk ledger `lore_merge`) instead of overwrite; author resolves on Lore Wiki.

## Chapter facts (live manuscript)

- `POST /api/chapter-facts/propose` / `commit` / `tag` — extension-driven major-event extract + wiki backfill
- Conflicts → Lore Merges notifications (`GET /api/wiki/merges/notifications`)

## POV detection (heuristic layer)

Recognizes viewpoint names from many phrasings, not only recurring cast names:

- `Summer Pov`, `Summer's POV`, `Summers POV`
- `told in X's POV`, `POV: Summer`, `POV shift to …`
- Chapter table **POV** column with a bare name (`Summer` without the word Pov)

Dedicated chapter tabs are **scoped to one chapter** so Chapter 29 does not absorb Chapter 30 text. When deduping, beats that contain multiple chapter headings in one synopsis are deprioritized.

## Macro outline titles

Numbered bullets (`1. Acina on Earth…`) become titles from the bullet text (e.g. `Acina on Earth discovers the gate`), not generic `Item 1`. Section headings (`Beginning`, `Middle`) are preserved for embedded outline tabs.

## Related

- [`MSGF_V1_ROADMAP.md`](../../msgf/MSGF_V1_ROADMAP.md) — engine phases
- [`packages/msgf/pre_ingestion_audit.md`](../../../packages/msgf/pre_ingestion_audit.md) — SWEEP audit SSOT
- [`apps/author-ecosystem/docs/rag/README.md`](../../../apps/author-ecosystem/docs/rag/README.md) — template SSOT
