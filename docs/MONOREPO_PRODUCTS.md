# Elphie Syntax Monorepo — Product Surfaces (SSoT)

**Status:** Single source of truth for the three customer-facing web applications in this repository and how they relate to **MSGF** (the shared brain/engine).

**Companion docs:**

- MSGF 1.0 vision & release plan: [`MSGF_V1_ROADMAP.md`](./MSGF_V1_ROADMAP.md)
- MSGF testing (admin vs users): [`MSGF_TESTING.md`](./MSGF_TESTING.md)
- Small Brain / Big Brain + workspaces: [`MSGF_BRAIN_ROUTING.md`](./MSGF_BRAIN_ROUTING.md)
- Author product roadmap: [`AUTHOR_ECOSYSTEM_ROADMAP.md`](./AUTHOR_ECOSYSTEM_ROADMAP.md)
- Syntax Education: [`syntax-education/ROADMAP.md`](./syntax-education/ROADMAP.md) · [`syntax_education_masterdoc.md`](./syntax-education/syntax_education_masterdoc.md) · [`syntax_education_pillars.md`](./syntax-education/syntax_education_pillars.md)
- Implementation tracker (pillars + AUTH): [`PILLAR_PROGRESS.md`](./PILLAR_PROGRESS.md)

**Last updated:** 2026-08-06

---

## 1. Positioning

**MSGF** (Modular State-Gate Framework) is:

1. **The brain and engine** for narrative-sovereignty products in this monorepo (HAL gates, Vault/Hall lineage, Pulse consensus, tiered reporting, credit guard).
2. **A standalone platform** deployable at **https://elphiesgatedai.elphiesyntax.com** and consumable by **other software** via APIs, OpenAI/Anthropic-compatible `/api/v1` gateway, webhooks, tenant configuration, and shared packages (`packages/msgf`, `packages/core`, `packages/ui`).

Author and education apps **embed or call MSGF**; they do not reimplement guardrail logic in silos.

**MSGF product map (capabilities + sales):** [`MSGF_PRODUCT_OVERVIEW.md`](./MSGF_PRODUCT_OVERVIEW.md) · gateway: [`MSGF_SHADOW_PROXY.md`](./MSGF_SHADOW_PROXY.md) · live `/features` on gatedai.

---

## 2. Three web applications (1.0 target)

| Product | Production URL | Repo home (today) | Role |
| :--- | :--- | :--- | :--- |
| **Author Ecosystem** | **https://elphiesyntax.com** | `apps/author-ecosystem/` (BFF, Vite client, Chrome extension) | Sovereign author workflow: HAL, Vault Pact, manuscripts, revision gates, RAG librarian, publisher-facing proofs. |
| **MSGF (Gated AI)** | **https://elphiesgatedai.elphiesyntax.com** | `packages/msgf/` (Next.js), `apps/msgf-dashboard/`, future `packages/msgf/apps/web/` | Guardrail engine + SaaS: Pulse, ingest, DEFEND preflight, Shadow Proxy / Active Governance (`/api/v1`), consensus, billing/credits, ops dashboard, public marketing/checkout shell. |
| **Syntax Education** | **https://syntaxeducates.elphiesyntax.com** | `apps/syntax-educates/` | Education platform; tenant-scoped paths in `packages/msgf/config/tenant-manifest.json` (`tenant_education`). Spec: [`docs/syntax-education/`](./syntax-education/). |

**Local dev defaults (typical):**

| App | Dev entry | Port (typical) |
| :--- | :--- | :--- |
| Author BFF + client | `apps/author-ecosystem/server`, `apps/author-ecosystem/client` | 3002 / 5173 |
| MSGF Next | `npm run dev -w msgf` | 3000 |
| MSGF admin dashboard | `npm run dev -w msgf-dashboard` | Vite default |
| Syntax Educates | `apps/syntax-educates/` | per package |

---

## 2b. Platform hub — `elphiesyntax.com` (target vs today)

**Target (1.x):** The **apex domain** is the monorepo front door — overview of all products, shared branding, and **one login** that asks *which platform + persona* you need, then routes you to the right app.

| Host | Role |
| :--- | :--- |
| **elphiesyntax.com** (apex) | Product family overview + **unified sign-in** (`PlatformLoginMatrix` in `@elphie-syntax/ui`) |
| **authorecosystem.elphiesyntax.com** | Author Ecosystem app (HAL, manuscripts, Vault Pact) |
| **elphiesgatedai.elphiesyntax.com** | MSGF / Gated AI (Pulse, billing, governance dashboard, **operator admin** `/admin/*`) |
| **syntaxeducates.elphiesyntax.com** | Syntax Education (sandbox, teacher, LTI) |

**Login flow (target):**

1. User opens **elphiesyntax.com** → hub explains the three surfaces.
2. User signs in once (shared Supabase project).
3. User picks **Author · Education · Gated AI** + persona → redirect to that product’s subdomain with session cookies on `.elphiesyntax.com` when configured.
4. **MSGF operator admin** is canonical on **elphiesgatedai** (`/admin/sign-in`). Author and Syntax Educates expose the same path and **redirect to MSGF** (shared helpers in `@elphie-syntax/core/platform-admin-auth`).

**Today (interim):**

- Hub UI lives in `apps/author-ecosystem/client/src/pages/PlatformHubPage.jsx` and is intended to be served when the apex host is `elphiesyntax.com` / `www.elphiesyntax.com` (see `App.jsx` routing). Picker copy SSOT: `packages/core/src/lib/platform-hub-content.ts` (twin: `packages/msgf/app/_components/landing/PlatformHubLanding.tsx`).
- **Deploy gap:** apex DNS must map to **author-client** via `AUTHOR_APEX_DOMAIN` in `map-product-domains.sh` — until then, `elphiesyntax.com` may still show Squarespace parking instead of the picker. See [`DEPLOY_PRODUCT_DOMAINS.md`](./DEPLOY_PRODUCT_DOMAINS.md#apex-hub-elphiesyntaxcom-picker).
- **authorecosystem** host skips the hub and goes straight to `/sign-in`.
- Product CTAs already point at the correct production subdomains via `VITE_MSGF_APP_URL`, `VITE_AUTHOR_APP_URL`, `VITE_EDUCATION_APP_URL`.
- Email confirm / PKCE should complete on **Gated AI** for MSGF admin, or use Author `/auth/callback` → forward to MSGF (see [`AUTHOR_MSGF_WIRING.md`](./AUTHOR_MSGF_WIRING.md)).

**Later refactor (no new product logic):** extract the hub into a small deployable under `apps/` or `packages/ui` so apex DNS does not depend on the Author Vite bundle; keep `platform-persona-auth.ts` and cookie domain rules as the single routing SSOT.

---

## 3. Shared platform layer

| Layer | Location | Consumers |
| :--- | :--- | :--- |
| MSGF runtime (API + middleware) | `packages/msgf/` | All three apps + external integrators |
| Core guardrail libraries | `packages/core/`, `packages/msgf/lib/` | Pulse, DEFEND preflight, Shadow Proxy gateway, consensus, P4 |
| UI primitives | `packages/ui/` | Author client, msgf-dashboard, future MSGF web |
| Supabase schema | `packages/msgf/supabase/migrations/` | Shared Postgres for P4/MSGF tables |
| Tenant silo policy | `packages/msgf/config/tenant-manifest.json` | CI / `enforce-silo` tooling |

**Integration pattern (Author ↔ MSGF):** Author BFF proxies or calls MSGF routes (e.g. `/api/msgf/pulse`, `/api/msgf/ingest`); shared Supabase auth/cookies when `MSGF_AUTH_COOKIE_DOMAIN` is aligned. Ops guide: [`AUTHOR_MSGF_WIRING.md`](./AUTHOR_MSGF_WIRING.md). Probe: `packages/msgf/scripts/probe-author-ecosystem.mjs`.

**Workspace mapping (Small Brain per app):** On MSGF, users register **one `msgf_user_projects` row per monorepo app** (not only the git root) via `/setup/projects` or presets from `GET /api/workspace/monorepo-presets`. Each row’s `project_origin` scopes personal dashboard health, daily reports, Pulse telemetry, and ingest metadata for that silo. **Big Brain** (global CONVERGE, human arbitration, rule promotion) is **admin-only** on `/admin/dashboard` — see [`MSGF_BRAIN_ROUTING.md`](./MSGF_BRAIN_ROUTING.md).

| App | `project_origin` (use as `msgf.tenantKey` in IDE) | Local folder to register |
| :--- | :--- | :--- |
| MSGF Gated AI | `elphiesyntax/msgf` | `packages/msgf` |
| Author Ecosystem | `elphiesyntax/author-ecosystem` | `apps/author-ecosystem` (or client/server subfolder you actively edit) |
| Syntax Educates | `elphiesyntax/syntax-educates` | `apps/syntax-educates` |

When you switch which app you are coding:

1. **Easiest:** open `workspaces/author-ecosystem.code-workspace` (or `msgf-gated-ai.code-workspace`) in Cursor — workspace root = the app folder.
2. **Monorepo root open:** set both in root `.vscode/settings.json`:
   - `msgf.tenantKey` = mapped `project_origin` (e.g. `elphiesyntax/author-ecosystem`)
   - `msgf.productPath` = app folder (e.g. `apps/author-ecosystem`)
   Keep `msgf.authToken` in `apps/<app>/.vscode/settings.json` or User settings; the extension merges nested settings automatically.
3. **Command Palette:** **MSGF: Configure monorepo product** picks the app and writes both keys.

Do **not** use folder paths (`apps/author-ecosystem`) as `msgf.tenantKey`. Operator token savings for Author still filter `?tenant_id=author_ecosystem` on MSGF admin dashboards (license tenant ≠ `project_origin`).

| Preset id | App | `project_origin` | Typical local path |
| :--- | :--- | :--- | :--- |
| `msgf-gated-ai` | MSGF Gated AI | `elphiesyntax/msgf` | `packages/msgf` |
| `author-ecosystem` | Author Ecosystem | `elphiesyntax/author-ecosystem` | `apps/author-ecosystem` |
| `syntax-educates` | Syntax Educates | `elphiesyntax/syntax-educates` | `apps/syntax-educates` |
| `client-vortex` | Vortex Client | `elphiesyntax/client-vortex` | `apps/client-vortex` |

SSoT for preset bodies: `packages/msgf/lib/services/monorepo-workspace-presets.ts`.

---

## 4. What “1.0” means per product

| Product | 1.0 intent (summary) | Detailed plan |
| :--- | :--- | :--- |
| **MSGF** | Standalone gated-AI product: V3 architecture operational, multi-tenant API, Stripe entitlements, public site on gatedai subdomain | [`MSGF_V1_ROADMAP.md`](./MSGF_V1_ROADMAP.md) |
| **Author Ecosystem** | Creative Integrity Flywheel for authors (Phase 1–2 SSOT) | [`AUTHOR_ECOSYSTEM_ROADMAP.md`](./AUTHOR_ECOSYSTEM_ROADMAP.md) |
| **Syntax Education** | Education UX on top of shared auth/MSGF policies | TBD — track under `tenant_education` |

---

## 5. External specification

| Spec | Location |
| :--- | :--- |
| **MSGF V3.2-ULTRA** (primary for 1.0) | [`docs/references/MSGF_v3_2_masterdoc.pdf`](./references/MSGF_v3_2_masterdoc.pdf) |
| MSGF V3.0 (historical) | Maintainer copy: `MSGF_v3_masterdoc.pdf` |

Engineering SSOT: [`MSGF_V1_ROADMAP.md`](./MSGF_V1_ROADMAP.md). When the PDF and repo docs diverge, update the repo SSOT and note the change in both changelogs.

---

## Changelog

| Date | Change |
| :--- | :--- |
| 2026-08-11 | MSGF ops bug inbox closed loop (FAB → `/admin/ops#bug-inbox`); see [`MSGF_ADMIN_HUB.md`](./MSGF_ADMIN_HUB.md). |
| 2026-05-15 | Linked V3.2-ULTRA PDF in `docs/references/`; MSGF 1.0 plan uses V3.2 as primary spec. |
| 2026-05-15 | Initial SSoT: three production domains, MSGF dual role (engine + standalone), monorepo mapping. |
| 2026-05-20 | Workspace preset table; link to `MSGF_BRAIN_ROUTING.md` (per-app workspaces vs admin Big Brain). |
| 2026-05-22 | §2b apex hub target map (`elphiesyntax.com` overview + unified login → product subdomains). |
