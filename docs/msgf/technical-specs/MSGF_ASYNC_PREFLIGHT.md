# MSGF A5 — Async preflight + skip audit

## Async Safe Build (`msgf.asyncPreflight`, default `true`)

Safe Build / Run Scripts return the **local** exit to the developer immediately. `verify-result` / `dev-event` POST in the background with `async: true` and a `correlation_id`. The status bar shows **MSGF shadow: pending | green | red**.

Set `msgf.asyncPreflight: false` to wait for network sync before the command completes (legacy).

## Emergency skip (`msgf.skipMsgf` / `MSGF_SKIP=1`)

Never silent. Before skipping sync, Pulse Guard POSTs:

`POST /api/msgf/ops/skip-audit`

with HMAC signature using `msgf.skipAuditSecret` (must match server `MSGF_SKIP_AUDIT_SECRET` or `MSGF_OPS_CRON_SECRET`). Rows land in `msgf_skip_audit` and on **Ops console → Skip-MSGF audit**.

If the secret is missing or the POST fails, the skip is **blocked**.

## Env

| Var | Role |
|-----|------|
| `MSGF_SKIP_AUDIT_SECRET` | Preferred HMAC / Bearer secret |
| `MSGF_OPS_CRON_SECRET` | Fallback secret |
| `MSGF_SKIP=1` | Same as `msgf.skipMsgf` for Run Scripts process env |

Apply migration: `20260724030200_msgf_skip_audit.sql` via `npm run db:push`.

Skip-audit is tenant ops telemetry. It is **not** Global Brain swarm absorb — see [`MSGF_GLOBAL_BRAIN_TELEMETRY.md`](./MSGF_GLOBAL_BRAIN_TELEMETRY.md).
