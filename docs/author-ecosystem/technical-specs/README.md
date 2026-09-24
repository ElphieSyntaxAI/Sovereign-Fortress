# Technical specs

How Author Ecosystem works under the hood. MSGF bridge and ingest stay under integrations (link, don’t fork).

## Index

| Spec | Topic |
| :--- | :--- |
| [`AUTHOR_ARCHITECTURE.md`](./AUTHOR_ARCHITECTURE.md) | BFF / client / extension, ports, hosts, env |
| [`AUTHOR_HAL_LEDGER.md`](./AUTHOR_HAL_LEDGER.md) | HAL telemetry, offline seal, Pulse sync |
| [`AUTHOR_VAULT_PACT.md`](./AUTHOR_VAULT_PACT.md) | Bilateral NDA attestation + atomic register |
| [`AUTHOR_COOLDOWN_LOCKS.md`](./AUTHOR_COOLDOWN_LOCKS.md) | Lock tiers 4w/6w/8w, revision status, gates |
| [`AUTHOR_MANUSCRIPT_HUB.md`](./AUTHOR_MANUSCRIPT_HUB.md) | Active Project, `MS:` switcher, series RAG share |
| [`AUTHOR_RAG_LIBRARIAN.md`](./AUTHOR_RAG_LIBRARIAN.md) | Sidekick RAG, Librarian/Critic, gateway modes |
| [`AUTHOR_TIERS_GUILD.md`](./AUTHOR_TIERS_GUILD.md) | Product tiers, guild counters, Publisher Hub |
| [`AUTHOR_STAGING.md`](./AUTHOR_STAGING.md) | Cloud Run staging services + domains |

## Integrations (Author ↔ MSGF)

| Spec | Topic |
| :--- | :--- |
| [`AUTHOR_MSGF_WIRING.md`](../../integrations/technical-specs/AUTHOR_MSGF_WIRING.md) | Two tenant IDs, Pulse license, handoff, local stack |
| [`AUTHOR_DOCUMENT_INGEST_MSGF.md`](../../integrations/technical-specs/AUTHOR_DOCUMENT_INGEST_MSGF.md) | SWEEP → CONVERGE → RAG → DEFEND → PERSIST |

## Related

- Roadmap: [`AUTHOR_ECOSYSTEM_ROADMAP.md`](../AUTHOR_ECOSYSTEM_ROADMAP.md)
- RAG templates: [`apps/author-ecosystem/docs/rag/`](../../../apps/author-ecosystem/docs/rag/)
- Staging stack: [`STAGING_AND_RELEASE.md`](../../STAGING_AND_RELEASE.md)
