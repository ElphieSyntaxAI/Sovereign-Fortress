# MSGF Admin Hub

**URLs (Gated AI):**

| Surface | Path | Purpose |
| :--- | :--- | :--- |
| Portal | `/admin/portal` | Launch Author / Education / MSGF; local stack checklist |
| Pillar health | `/admin/dashboard` | Six-pillar operator lens, token savings, Big Brain summary |
| **Ops console** | `/admin/ops` | **ARBITRATE incident queue** + **DocuSign compliance** |
| Governance (personal) | `/dashboard` | Tenant pillar health, daily reports, security view |

Sign in: `/admin/sign-in` (requires `GLOBAL_ADMIN` or `COMPANY_ADMIN` on `p4_profiles`, or `MSGF_GLOBAL_ADMIN_EMAILS`).

## Ops console (`/admin/ops`)

Replaces the need to run `apps/msgf-dashboard` for day-to-day operator work. Uses **Supabase session cookies** — not `SUPABASE_SERVICE_ROLE_KEY` in the browser.

- Pending incidents: `GET /api/msgf/admin/incidents?status=pending`
- Resolve / approve: `PATCH /api/msgf/admin/incidents/:id` + `POST /api/msgf/pulse` (tie-break headers)
- DocuSign roster: `GET /api/msgf/admin/docusign/envelopes`

Legacy Vite dashboard (`npm run dev -w msgf-dashboard`) still works with Bearer auth for cross-origin Cloud Run proxy.

## Author Ecosystem ↔ MSGF (operator pathway)

| Step | Where |
|------|--------|
| Sign in | `http://127.0.0.1:3001/admin/sign-in` → portal |
| Open Author (SSO) | Portal → **Author dashboard (localhost)** → `GET /api/msgf/admin/author-handoff` → Author BFF `GET /api/auth/msgf-handoff` → `/home` |
| Author operator hub | Same handoff with **Author admin hub** link → `/admin` and **MSGF ops** at `/admin/ops` |
| MSGF ops while coding | Author `/admin/ops` links to `/admin/ops`, token savings `?tenant_id=author_ecosystem` |

**One terminal (local):** `npm run dev:author-msgf` — MSGF + Author BFF + Vite.

Operator detection on Author uses the same rules as MSGF: `MSGF_GLOBAL_ADMIN_EMAILS` and/or `p4_profiles.msgf_access_role = GLOBAL_ADMIN`.

## Project tracking rails

Telemetry (pulse, ingest, daily reports) is scoped to **mapped** `project_origin` values in Workspace → Projects. IDE clients must set `msgf.tenantKey` to that slug (`org/repo`). Unmapped paths are rejected when the user has project mappings. See [`AUTHOR_MSGF_WIRING.md`](./AUTHOR_MSGF_WIRING.md#project-tracking-rails-privacy).

## Deploying admin without DocuSign keys

You can ship **`/admin/portal`**, **`/admin/dashboard`**, and **`/admin/ops`** (ARBITRATE + envelope roster) with **no** `DOCUSIGN_*` or `MSGF_DOCUSIGN_MOCK` env vars. The ops console shows DocuSign mode **`unconfigured`** until you add credentials.

- Leave **Enforce DocuSign** off on team invites until live or mock signing is configured.
- If an invite has enforce on but DocuSign is not configured, bootstrap **activates the member** anyway and logs `docusign_skipped_unconfigured` in the tenant vault (no hard failure).

## DocuSign (team invites, optional)

1. Company admin invites a member with **Enforce DocuSign** in Workspace → Architecture & Projects → Team.
2. Invitee accepts Supabase invite → bootstrap creates an envelope when DocuSign is available.
3. **Mock (local only):** `MSGF_DOCUSIGN_MOCK=1` in `.env.local` — invitee uses workspace banner **Complete mock signature**.
4. **Live:** Set `DOCUSIGN_*` env vars (see root `.env.example`). Point DocuSign Connect to `POST /api/msgf/ops/docusign-webhook`.

Migration: `20260629120000_company_team_vault_docusign.sql` (`msgf_docusign_envelopes`, `msgf_team_invites`, …).

## Related

- [`MSGF_V1_ROADMAP.md`](./MSGF_V1_ROADMAP.md) · [`MSGF_BRAIN_ROUTING.md`](./MSGF_BRAIN_ROUTING.md)
