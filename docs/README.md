# Documentation

Docs are grouped **by product**. Each product folder keeps its **roadmap and checklists at the root**; everything else lives in three subfolders.

```
docs/
  msgf/                  MSGF / Gated AI
  author-ecosystem/      Author Ecosystem
  syntax-education/      Syntax Education
  integrations/          Cross-product connectors (IDE, SSO, Sentry, signing, …)
  references/            Canonical PDFs (V3.2 master spec)
  templates/             Reusable directives
```

Inside each product (and integrations):

| Location | What goes here |
| :--- | :--- |
| **Folder root** | Roadmap + checklists |
| `marketing/` | Buyer, demo, and public-facing copy |
| `technical-specs/` | How the product works |
| `build-plans/` | Sequencing, DX, soak, and delivery plans |

Cross-product ops stay at this root: [`MONOREPO_PRODUCTS.md`](./MONOREPO_PRODUCTS.md), [`PILLAR_PROGRESS.md`](./PILLAR_PROGRESS.md), [`DOCKER_LOCAL_DEV.md`](./DOCKER_LOCAL_DEV.md), [`STAGING_AND_RELEASE.md`](./STAGING_AND_RELEASE.md), [`STAGING_SUPABASE_SETUP.md`](./STAGING_SUPABASE_SETUP.md), [`DEPLOY_PRODUCT_DOMAINS.md`](./DEPLOY_PRODUCT_DOMAINS.md).

## Product entry points

| Product | Roadmap | Checklists |
| :--- | :--- | :--- |
| **MSGF** | [`msgf/MSGF_V1_ROADMAP.md`](./msgf/MSGF_V1_ROADMAP.md) | [`RC`](./msgf/MSGF_RC_CHECKLIST.md) · [`Deploy`](./msgf/MSGF_DEPLOY_CHECKLIST.md) · [`Dev TODO`](./msgf/MSGF_DEV_TODO.md) |
| **Author Ecosystem** | [`author-ecosystem/AUTHOR_ECOSYSTEM_ROADMAP.md`](./author-ecosystem/AUTHOR_ECOSYSTEM_ROADMAP.md) | — |
| **Syntax Education** | [`syntax-education/ROADMAP.md`](./syntax-education/ROADMAP.md) | [`DOCS_E2E_CHECKLIST.md`](./syntax-education/DOCS_E2E_CHECKLIST.md) |
| **Integrations** | — | See [`integrations/`](./integrations/) |
