# Author document ingest — MSGF pipeline

Author Ecosystem document import (file upload + Google Docs) follows **MSGF V3.2** phases for mapping planning docs into wiki + outline data.

## Flow

| Phase | Where | What |
|-------|--------|------|
| **SWEEP** | `documentIngestSignals.ts` | Tab/table/chapter/scene signals; optional keyword hits (hints only) |
| **CROSS-REF** | `documentIngestMsgfPipeline.ts` | `getLogicLineage` (1.1.1 Vault) for ingest mapping reinforcement |
| **CONVERGE** | `documentIngestMsgfPipeline.ts` | Gemini JSON extract → `proposed_wiki` + `outline_beats` |
| **Accuracy** | `groundProposedWikiToSource` | Drops excerpts not found in source text |
| **Compile** | `documentIngestCompile.ts` | Dedupe beats/wiki, prune duplicate macro sections |
| **DEFEND** | `documentIngestMsgfGuard.ts` | Shadow preflight, structure-merge risk, dual review on commit |
| **PERSIST** | `commitDocumentIngest.ts` | `p4_narrative_library_chunks`, plot/lore vectors, MSGF SWEEP shards |

## Environment (BFF / `packages/msgf/.env.local`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `MSGF_DOCUMENT_INGEST_MODE` | `converge` | `converge` \| `hybrid` \| `heuristic` |
| `MSGF_DOCUMENT_INGEST_KEYWORDS` | built-in list | Comma-separated hints or JSON `{"hints":[],"planning_layers":[]}` |
| `MSGF_DOCUMENT_INGEST_SHADOW` | on | Set `off` to skip shadow preflight on commit |
| `GEMINI_API_KEY` / `GOOGLE_API_KEY` | — | Required for CONVERGE (heuristic-only if unset) |
| `MSGF_APP_URL` | `http://127.0.0.1:3001` | SWEEP ingest on commit |
| `MSGF_INGEST_API_KEY` | — | Optional tenant ingest auth |

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

## Related

- [`MSGF_V1_ROADMAP.md`](MSGF_V1_ROADMAP.md) — engine phases
- [`packages/msgf/pre_ingestion_audit.md`](../packages/msgf/pre_ingestion_audit.md) — SWEEP audit SSOT
