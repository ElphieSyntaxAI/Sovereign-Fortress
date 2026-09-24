# Author RAG, Sidekick & Librarian / Critic

**SSoT for continuity retrieval and bicameral review surfaces.**  
**Document ingest pipeline (do not duplicate):** [`AUTHOR_DOCUMENT_INGEST_MSGF.md`](../../integrations/technical-specs/AUTHOR_DOCUMENT_INGEST_MSGF.md)  
**Template grammar:** [`apps/author-ecosystem/docs/rag/README.md`](../../../apps/author-ecosystem/docs/rag/README.md)  
**MSGF Shadow/Active:** [`AUTHOR_MSGF_WIRING.md`](../../integrations/technical-specs/AUTHOR_MSGF_WIRING.md) · [`MSGF_SHADOW_PROXY.md`](../../msgf/technical-specs/MSGF_SHADOW_PROXY.md)

---

## Roles

| Agent | Typical upstream | Job |
| :--- | :--- | :--- |
| **Librarian** | OpenAI via MSGF gateway (when mode ≠ off) | Logic / continuity / outline adherence |
| **Critic** | Anthropic via gateway | Sensitivity / market-facing critique |
| **Sidekick / RAG** | Narrative chunks + embeddings | In-editor continuity answers |
| **Ingest CONVERGE** | Gemini | Planning-doc → wiki + outline proposals |

Bicameral audit = Librarian + Critic pair for revision reports after cool-down.

---

## Retrieval

- Narrative library chunks / lore vectors (`p4_narrative_library_chunks`, related pillar vectors).
- Retrieval helpers / controllers: `p4LoreRag.controller.ts`, `ragRoutes.js`, `LibrarianChat.ts`, `librarian.controller.ts`.
- Series scope: share only within `seriesId` — [`AUTHOR_MANUSCRIPT_HUB.md`](./AUTHOR_MANUSCRIPT_HUB.md).
- Semantic chunking knobs: `MSGF_SEMANTIC_CHUNKING*` (when enabled on BFF/MSGF path).

---

## Governance

| Flag / mode | Effect |
| :--- | :--- |
| `MSGF_AUTHOR_GATEWAY_MODE` | Shadow vs Active for Librarian/Critic |
| `MSGF_AUTHOR_ACTIVE_AGGRESSIVENESS` | Active aggressiveness policy |
| `MSGF_AUTHOR_REQUIRE_DEPLOY_GATE` | Editor hub deploy-gate advisory |
| Dual-disagree on ingest | T3 HITL + verify fail (ingest DEFEND) |

Prefer calling models **through** the MSGF gateway so Pulse / Shadow / token savings stay visible under tenant `author_ecosystem`.

---

## Templates (authoring contract)

RAG TAG / Link / Domains grammar in `docs/rag/` must match the live parser (`documentIngestRagParser.ts`). Changing templates without updating the parser breaks ingest accuracy grounding.
