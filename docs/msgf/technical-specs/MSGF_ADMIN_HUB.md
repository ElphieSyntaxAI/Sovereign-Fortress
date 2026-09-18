# MSGF Admin Hub

**URLs (Gated AI):**

| Surface | Path | Purpose |
| :--- | :--- | :--- |
| Portal | `/admin/portal` | Launch Author / Education / MSGF; local stack checklist |
| Pillar health | `/admin/dashboard` | Six-pillar operator lens, token savings, Big Brain summary |
| **Ops console** | `/admin/ops` | Audit hub · Session Replay · most-used · fitness · budgets · SIEM · ARBITRATE · quarantine · Sentry · DocuSign |
| Account | `/account` | Plan / seats summary · Stripe Customer Portal |
| Governance (personal) | `/dashboard` | Tenant pillar health, daily reports / period PDF, Shadow Proxy panel, security view |

Sign in: `/admin/sign-in` (requires `GLOBAL_ADMIN` or `COMPANY_ADMIN` on `p4_profiles`, or `MSGF_GLOBAL_ADMIN_EMAILS`).

## Ops console (`/admin/ops`)

Replaces the need to run `apps/msgf-dashboard` for day-to-day operator work. Uses **Supabase session cookies** — not `SUPABASE_SERVICE_ROLE_KEY` in the browser.

Shared **`project_origin`** filter strip syncs provenance, HITL audit, and skip-audit panels via `?project_origin=`.

| Panel | Anchor / API / notes |
| :--- | :--- |
| **Audit hub** | `#audit-hub` · `GET /api/msgf/admin/audit-hub` — unified `platform_audit_events` timeline (COMPANY_ADMIN tenant-scoped). Search `q=` matches summary/kind/trace/**metadata JSON** including `promoted_keys` / `blocked_keys` / `prompt:`. Filter `p7=promoted\|blocked`. Expanded row shows chip lists that deep-link to `/dashboard#source-audit?resource_key=` |
| **Session Replay** | `#session-replay` · `GET /api/msgf/admin/prompt-sessions/search` (+ harm-ledger alias) — full-text prompt/completion forensics; harm opens HITL. **Not** the Global Brain feed. |
| **Prompt templates** | Versioned bodies + `prompt_hash` lineage · `GET/POST /api/msgf/admin/prompt-templates` |
| **Model fitness** | `#model-fitness` · `GET /api/msgf/admin/model-fitness` — under/over/fit rollups + cheapest-fit suggestion |
| **Most-used resources** | Ranked `msgf_resource_usage_events` (hashed queries only) · `GET /api/msgf/dashboard/source-audit?mode=rank` |
| **Diff impact** | `#diff-impact` · `POST /api/msgf/diff-impact` — path blast-radius vs P7/Vault/Hall; optional `MSGF_REQUIRE_DIFF_IMPACT=1` on deploy-gate |
| **Tenant budgets** | `#…` · `GET/PUT /api/msgf/tenant-budgets` — monthly $ cap, circuit breaker; pre-dispatch on gateway |
| **SIEM & Integrations** | `#siem-integrations` · `PUT /api/msgf/admin/siem-integrations` — OTel JSON webhook; heartbeat batch drain |
| **Bug inbox** (`#bug-inbox`) | See § Bug inbox below |
| **Provenance search** | `GET /api/msgf/admin/provenance-search` — Vault / Hall / HAL / P7 sources + reputation |
| **ARBITRATE incidents** | `#arbitrate` · `GET /api/msgf/admin/incidents` · resolve `PATCH .../incidents/:id` · **trusted-OSS bulk** approve (allowlist only, still A6) |
| Signed HITL audit (A6) | List + verify — [`MSGF_ARBITRATE_AUDIT.md`](./MSGF_ARBITRATE_AUDIT.md) |
| Skip-MSGF audit (A5) | Extension / IDE skip trail — [`MSGF_ASYNC_PREFLIGHT.md`](./MSGF_ASYNC_PREFLIGHT.md) |
| Vault quarantine (A2/A3 + T3) | `GET/POST /api/msgf/admin/vault-quarantine` — restore / demote (no auto-Hall) |
| Sentry issues | `GET /api/msgf/admin/sentry?issues=1` · [`MSGF_SENTRY.md`](../../integrations/technical-specs/MSGF_SENTRY.md) |
| DocuSign / signing roster | Envelopes + webhook inbox — [`MSGF_SIGNING.md`](../../integrations/technical-specs/MSGF_SIGNING.md) |

**Human-proof defaults:** DEFEND RED and harm-flagged prompt sessions always open ARBITRATE HITL. Budget `fallback_small_brain` never bypasses RED/harm. Mitigation overrides that demote Hall RED require an A6-linked `incident_id` on the mitigation entry. Swarm detections (`bot_swarm_detected`) also open HITL; Audit hub search `q=swarm`. Global Brain JSON is hashed/`silo_ref` only — see [`MSGF_GLOBAL_BRAIN_TELEMETRY.md`](./MSGF_GLOBAL_BRAIN_TELEMETRY.md). Session Replay (`msgf_prompt_sessions`) is the full-text forensic store — it is not removed when P7 records `prompt:{hash}`.

**Migrations:** `20260915120000_governance_audit_platform.sql`, `20260915130000_trusted_license_allowlist.sql`.

**Cron:** `POST /api/msgf/ops/v32-heartbeat` also drains Redis usage/audit buffers and batches SIEM exports.

Legacy Vite dashboard (`npm run dev -w msgf-dashboard`) still works with Bearer auth for cross-origin Cloud Run proxy.

### Bug inbox

Closed loop for user-reported bugs before (or beside) ARBITRATE HITL.

| | |
| :--- | :--- |
| **UI** | `/admin/ops#bug-inbox` · nav “Bug inbox” |
| **API** | `GET /api/msgf/admin/bug-inbox?status=open\|promoted\|dismissed\|all` · `PATCH` `{ id, action: "promote"\|"dismiss", note? }` |
| **Table** | `p4_active_incidents` (`inbox_status`, `promoted_msgf_incident_id`, `inbox_note`, `inbox_updated_at`) |
| **Ingest** | Onscreen **MsgfSentinel** FAB (`/workspace`, `/dashboard`, admin dashboard) → `POST /api/msgf/report-issue`; also web BugReporter, IDE/extension report-issue, and `persistSelfHealReport` when the caller did not already upsert |
| **Promote** | Inserts `msgf_incidents` source `USER_SENTINEL` → appears in ARBITRATE **pending** |
| **Scope** | `GLOBAL_ADMIN` sees all tenants; `COMPANY_ADMIN` limited to company allowlist |
| **Migrations** | `20260811010000_p4_active_incidents_bug_inbox.sql` · `20260811020000_p4_upsert_reopen_bug_inbox.sql` (reopen dismissed on re-report) |

## Author Ecosystem ↔ MSGF (operator pathway)

| Step | Where |
|------|--------|
| Sign in | `http://127.0.0.1:3001/admin/sign-in` → portal |
| Open Author (SSO) | Portal → **Author dashboard (localhost)** → `GET /api/msgf/admin/author-handoff` → Author BFF `GET /api/auth/msgf-handoff` → `/home` |
| Author operator hub | Same handoff with **Author admin hub** link → `/admin` and **MSGF ops** at `/admin/ops` |
| MSGF ops while coding | Author `/admin/ops` deep-links audit hub, Session Replay, fitness, SIEM, diff impact (`tenant_id=author_ecosystem`) |

**One terminal (local):** `npm run dev:author-msgf` — MSGF + Author BFF + Vite.

Operator detection on Author uses the same rules as MSGF: `MSGF_GLOBAL_ADMIN_EMAILS` and/or `p4_profiles.msgf_access_role = GLOBAL_ADMIN`.

## Syntax Educates ↔ MSGF

Educates Admin → Legal governance includes MSGF deep-links (audit hub, Session Replay, fitness, SIEM) for tenant `syntax_education` via `@elphie-syntax/core/educates-admin-msgf-links`.

## Project tracking rails

Telemetry (pulse, ingest, daily reports) is scoped to **mapped** `project_origin` values in Workspace → Projects. IDE clients must set `msgf.tenantKey` to that slug (`org/repo`). Unmapped paths are rejected when the user has project mappings. Compound vector scope also uses `subpath_hash` — see [`MSGF_TENANT_ISOLATION.md`](./MSGF_TENANT_ISOLATION.md).

## Deploying admin without DocuSign keys

You can ship **`/admin/portal`**, **`/admin/dashboard`**, and **`/admin/ops`** with **no** `DOCUSIGN_*` or `MSGF_DOCUSIGN_MOCK` env vars. The ops console shows DocuSign mode **`unconfigured`** until you add credentials.

- Leave **Enforce DocuSign** off on team invites until live or mock signing is configured.
- If an invite has enforce on but DocuSign is not configured, bootstrap **activates the member** anyway and logs `docusign_skipped_unconfigured` in the tenant vault (no hard failure).

## DocuSign (team invites, optional)

1. Company admin invites a member with **Enforce DocuSign** in Workspace → Architecture & Projects → Team.
2. Invitee accepts Supabase invite → bootstrap creates an envelope when DocuSign is available.
3. **Mock (local only):** `MSGF_DOCUSIGN_MOCK=1` in `.env.local` — invitee uses workspace banner **Complete mock signature**.
4. **Live:** Set `DOCUSIGN_*` env vars (see root `.env.example`). Point DocuSign Connect to `POST /api/msgf/ops/docusign-webhook`.

Migration: `20260629120000_company_team_vault_docusign.sql` (`msgf_docusign_envelopes`, `msgf_team_invites`, …).

## Related

- [`MSGF_PRODUCT_OVERVIEW.md`](../marketing/MSGF_PRODUCT_OVERVIEW.md) · [`MSGF_V1_ROADMAP.md`](../MSGF_V1_ROADMAP.md) · [`MSGF_BRAIN_ROUTING.md`](./MSGF_BRAIN_ROUTING.md) · [`MSGF_CONVERGE_TIER.md`](./MSGF_CONVERGE_TIER.md) · [`MSGF_GLOBAL_BRAIN_TELEMETRY.md`](./MSGF_GLOBAL_BRAIN_TELEMETRY.md) (zero-text swarm vs Session Replay) · [`MSGF_PILLAR_MAPPING_SSOT.md`](./MSGF_PILLAR_MAPPING_SSOT.md) (P7 is provenance, not a seventh SWEEP pillar)
