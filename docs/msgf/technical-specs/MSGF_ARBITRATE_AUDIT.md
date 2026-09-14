# MSGF A6 — Signed ARBITRATE HITL audit

Every HITL resolve appends one row to `msgf_arbitrate_audit`:

- Canonical JSON snapshot (inputs, model opinions / strategies, operator, action, `project_origin`, timestamps)
- HMAC-SHA256 with `MSGF_ARBITRATE_AUDIT_KEY` (fallback: `MSGF_OPS_CRON_SECRET` / `MSGF_SKIP_AUDIT_SECRET`)
- Hash chain: `prev_hash` → `row_hash = sha256(prev|canonical|signature)`

## Wired call sites

- `resolveHumanArbitrationAction` (heal-queue APPROVE_BYPASS / DENY_PURGE)
- `resolveAdminIncident` when `status === "resolved"`

If the signing key is missing, HITL still completes and a warning is logged (audit skipped).

## Ops

- List: `GET /api/msgf/admin/arbitrate-audit`
- Verify: `POST /api/msgf/admin/arbitrate-audit/verify` with `{ "id": "…" }` or full payload fields
- UI: Ops console → **Signed HITL audit** (verify + download JSON)

Apply migration: `20260724030300_msgf_arbitrate_audit.sql` via `npm run db:push`.
