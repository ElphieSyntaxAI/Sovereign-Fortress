# MSGF — Small Brain vs Big Brain (internal SSoT)

**Audience:** Engineering / operators. Describes how tenant-local work stays on **Small Brain** while global platform work routes to **Big Brain** and **admin-only** surfaces.

**Last updated:** 2026-05-28

**Product overview (use cases & marketing):** [`MSGF_PRODUCT_OVERVIEW.md`](./MSGF_PRODUCT_OVERVIEW.md)

**Companion:** [`MSGF_V1_ROADMAP.md`](./MSGF_V1_ROADMAP.md) §7.6 · [`MONOREPO_PRODUCTS.md`](./MONOREPO_PRODUCTS.md) · [`MSGF_TESTING.md`](./MSGF_TESTING.md) · [`packages/msgf/README.md`](../packages/msgf/README.md)

---

## 1. Definitions

| Tier | Control | Typical paths | Global DNA (`msgf_rules`, `vault_core`) |
| :--- | :--- | :--- | :--- |
| **Small Brain** | Tenant / signed-in user | `local_gateway`, `converge_bypass`, degraded CONVERGE, dev-session, dev-event Heal Cheap, ingest hash skip, CONVERGE cache replay, tenant `pillar_vectors` Vault | Stays in **tenant silo** unless explicitly globalized |
| **Big Brain** | MSGF platform + **GLOBAL / COMPANY** operators | `global_converge` (dual-model Gemini + Claude), corporate cloud CONVERGE | **`assertGlobalWriteAllowed`** in `global-approval-gate.ts` — non-admin globalize → `LOCAL_SUCCESS_GLOBAL_PENDING` until operator promotes |

**Audience** (dashboard / API visibility) is derived from tier:

- `audienceForBrainTier(small_brain)` → **`user`**
- `audienceForBrainTier(big_brain)` → **`admin`**

Policy catalog (every feature has `tier` + `audience`): [`packages/msgf/lib/services/brain-routing-policy.ts`](../packages/msgf/lib/services/brain-routing-policy.ts).

---

## 2. Pulse escalation (when Big Brain runs)

`assessLogicDrift` ([`logic-drift.ts`](../packages/msgf/lib/services/logic-drift.ts)) may escalate to Big Brain when:

- Logic drift exceeds `x-msgf-brain-sensitivity` (default **0.3**), or
- P2 roadmap contradiction is detected.

**Never** on these IDE paths (Small Brain only):

- **`POST /api/msgf/dev-event`** — vault-first Heal Cheap; no biometric Pulse → CONVERGE chain (`dev_event` logic delta, `globalize: false` by default).
- **`POST /api/msgf/verify-result`** — Safe Build / Run Scripts audit; pass + pack → tenant Vault; repeated fail → Hall (deduped). Small Brain only.
- **Dev-session headers** (`x-msgf-dev-session`, build-active discount) — relaxed drift, longer local gateway.

`classifyPulseRoutingBrain()` maps Pulse routing kinds to catalog feature ids (`pulse_local_gateway`, `pulse_global_converge`, etc.).

---

## 3. Audience routing (who sees what)

### 3.1 APIs

| Surface | User (tenant session) | Admin (GLOBAL / COMPANY operator) |
| :--- | :--- | :--- |
| Token savings catalog | `GET /api/msgf/dashboard/savings-features` — **Small Brain rows only** (`filterCatalogEntriesForAudience`) | `GET /api/msgf/admin/dashboard/savings-features` — **full catalog** |
| Heal queue GET | **User scope:** strips `human_arbitration_packages`; removes tasks in `PENDING_HUMAN_ARBITRATION` or with `circuit_breaker_open`; sets `big_brain_escalations_pending` | **Admin scope:** full queue + arbitration packages |
| Human arbitration POST | **403** for non-operator session | Operators via `sessionIsDashboardOperator()` |
| Pulse routing mix | `GET /api/msgf/dashboard/pulse-routing` | Same route; operator dashboard may show Big Brain context in adjacent panels |

**Heal queue auth note:** Audience filtering applies when the request is authenticated with a **browser session** (`resolveSessionDashboardOperator`). Callers using a **tenant API key** still receive the **full** queue (integrators / automation).

Implementation:

- [`heal-queue-audience.ts`](../packages/msgf/lib/services/heal-queue-audience.ts) — `applyHealQueueAudienceScope()`
- [`app/api/msgf/heal-queue/route.ts`](../packages/msgf/app/api/msgf/heal-queue/route.ts)
- [`resolve-dashboard-operator.ts`](../packages/msgf/lib/services/resolve-dashboard-operator.ts)

### 3.2 Web UI

| Audience | URL / anchor | Components |
| :--- | :--- | :--- |
| Tenant user | `/dashboard`, `/dashboard#token-savings` | `TokenSavingsFeaturesPanel` (`operatorView={false}`), `PostIngestHealingConsole` (no human arbitration; banner when `big_brain_escalations_pending > 0`) |
| Operator | `/admin/dashboard`, `#token-savings`, `#big-brain-issues` | `DashboardShell` with `embeddedInAdminPortal` — `BigBrainIssuesPanel`, arbitration enabled, admin savings API |

Admin nav: **Big Brain queue** → `/admin/dashboard#big-brain-issues` (`AdminPortalNav.tsx`).

Operator-only links (catalog): `BIG_BRAIN_ADMIN_SURFACES` — ops dashboard, admin portal incidents, rule submissions, global rules API.

### 3.3 Global promotion gate

Sources registered in `global-approval-gate.ts` include **`dev_event`**. Tenant heals persist locally; promotion to global DNA requires operator approval (`rule_submission_promotion`, `human_arbitration_global` in brain catalog).

---

## 4. Monorepo — one workspace per app

The git monorepo hosts multiple customer apps; MSGF treats **each app as its own project/workspace**, not a single row for the repo root only.

| Preset id | Display name | `project_origin` | Suggested path |
| :--- | :--- | :--- | :--- |
| `msgf-gated-ai` | MSGF Gated AI (platform) | `elphiesyntax/msgf` | `packages/msgf` |
| `author-ecosystem` | Author Ecosystem | `elphiesyntax/author-ecosystem` | `apps/author-ecosystem` |
| `syntax-educates` | Syntax Educates | `elphiesyntax/syntax-educates` | `apps/syntax-educates` |
| `client-vortex` | Vortex Client | `elphiesyntax/client-vortex` | `apps/client-vortex` |

**Registration:**

- UI: `/setup/projects` — copy + one-click **Add workspace** from presets (`ProjectSetupClient.tsx`).
- API: `GET /api/workspace/monorepo-presets` (authenticated preset list).
- SSoT: [`monorepo-workspace-presets.ts`](../packages/msgf/lib/services/monorepo-workspace-presets.ts) · `buildCreateProjectBodyFromPreset()`.

Each `msgf_user_projects` row’s **`project_origin`** scopes personal dashboard health filters and ingest metadata for that silo. **Big Brain** actions remain on `/admin/dashboard`, not per-workspace.

See also [`MONOREPO_PRODUCTS.md`](./MONOREPO_PRODUCTS.md).

---

## 5. Token savings layer (1.0)

Redis counters + model estimates (not Stripe billing truth). Summary builder: [`savings-features-stats.ts`](../packages/msgf/lib/services/savings-features-stats.ts) — attaches `brain_tier` and `audience` per catalog row.

| Feature | Brain | User catalog | Admin catalog |
| :--- | :---: | :---: | :---: |
| Pulse routing mix | Small (per route) | ✅ | ✅ |
| CONVERGE result cache | Small | ✅ | ✅ |
| IDE dev-event | Small | ✅ | ✅ |
| IDE dev-session | Small | ✅ | ✅ |
| Pulse idempotency | Small | ✅ | ✅ |
| Ingest hash skip | Small | ✅ | ✅ |
| usage_monitor | Small | ✅ | ✅ |
| Credit reservation | Small | ✅ | ✅ |
| CONVERGE context budget | Small | ✅ | ✅ |
| 0-Token prompt + context pack | Small | ✅ | ✅ |
| IDE verify-result loop | Small | ✅ | ✅ |
| Run Scripts (zero re-prompt) | Small | ✅ | ✅ |
| Human arbitration (global) | Big | — | ✅ |
| Rule submission promotion | Big | — | ✅ |
| Pulse global CONVERGE | Big | — | ✅ (via admin savings + Big Brain panel) |

**QA checkpoints 18–19:** `tests/savings-qa-checkpoints.test.ts` (dev-event CHEAP routing; CONVERGE cache replay savings).

**24h counter keys (verify loop):** `verify_result_pass`, `verify_result_fail`, `verify_result_vault`, `verify_result_hall`, `run_script_rerun` — wired from `verify-result-savings.ts` on each `POST /api/msgf/verify-result`.

---

## 6. Verification (admin)

| Command | Purpose |
| :--- | :--- |
| `npm run test:brain-routing -w msgf` | Offline — catalog tiers, pulse classification, dev-event Small Brain |
| `npm run test:heal-queue-audience -w msgf` | Offline — user vs admin heal-queue scope |
| `npm run test:savings -w msgf` | Bundle — includes brain-routing + heal-queue-audience + QA 18–19 |
| `npm run verify:brain-routing -w msgf` | Live smoke — drift, RemediationEngine, optional Supabase (needs env) |

---

## 7. Key file index

| Concern | Path |
| :--- | :--- |
| Brain policy SSoT | `packages/msgf/lib/services/brain-routing-policy.ts` |
| Global write gate | `packages/msgf/lib/services/global-approval-gate.ts` |
| Heal queue audience | `packages/msgf/lib/services/heal-queue-audience.ts` |
| Operator session | `packages/msgf/lib/services/resolve-dashboard-operator.ts` |
| Monorepo presets | `packages/msgf/lib/services/monorepo-workspace-presets.ts` |
| User savings API | `packages/msgf/app/api/msgf/dashboard/savings-features/route.ts` |
| Admin savings API | `packages/msgf/app/api/msgf/admin/dashboard/savings-features/route.ts` |
| Verify-result savings | `packages/msgf/lib/services/verify-result-savings.ts` |
| Big Brain UI | `packages/msgf/app/_components/dashboard/BigBrainIssuesPanel.tsx` |

---

## Changelog

| Date | Change |
| :--- | :--- |
| 2026-05-28 | Verify-result loop + Run Scripts in savings catalog; counter keys; [`MSGF_PRODUCT_OVERVIEW.md`](./MSGF_PRODUCT_OVERVIEW.md). |
| 2026-05-20 | Initial SSoT: audience mapping, heal-queue scope, monorepo workspaces, APIs/UI/tests. |
