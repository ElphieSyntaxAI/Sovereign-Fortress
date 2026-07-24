# MSGF V3.2 — Production deploy checklist

Use after merging the P0–P4 roadmap work. **Code is built; production needs deploy + migrations.**

---

## 1. Supabase migrations (apply in order)

| Migration | Purpose |
|-----------|---------|
| `20260506203000_p4_active_incidents.sql` | Incident dedupe (report-issue) |
| `20260627120000_p4_active_incidents_legacy_users_rls.sql` | Incidents RLS |
| `20260531100000_msgf_credit_reservation.sql` | Credit ledger RPCs |
| `20260628130000_msgf_ide_tokens_workspaces.sql` | Long-lived `msgf_ide_*` tokens |
| `20260724010000_msgf_user_github_connections.sql` | GitHub project picker |
| `20260724020000_company_domains_signing_provider.sql` | Domains + signing provider |
| `20260724020100_*` (quarantine) | Vault quarantine columns |
| `20260724030000_pillar_vectors_compound_scope.sql` | A4 compound tenant scope |
| `20260724030100_webhook_inbox_archive_status.sql` | I5 webhook inbox + archive |
| `20260724030200_msgf_skip_audit.sql` | A5 skip-MSGF audit |
| `20260724030300_msgf_arbitrate_audit.sql` | A6 signed ARBITRATE audit |

```bash
npm run db:push -w msgf
npm run verify:db-schema -w msgf
```

---

## 2. Cloud Run env (add to `.env.cloudrun`)

```bash
MSGF_CREDIT_RESERVATION_ENABLED=1
MSGF_CREDIT_RESERVATION_PROD_DEFAULT=1
MSGF_OPS_CRON_SECRET=...          # required: heartbeat, workers, audit fallback
# Prefer dedicated keys in prod (fallback to ops cron is OK for soft launch):
# MSGF_SKIP_AUDIT_SECRET=...
# MSGF_ARBITRATE_AUDIT_KEY=...
# Optional:
# MSGF_IDE_TOKEN_TTL_DAYS=90
# MSGF_HEAL_RESERVE_CHUNK=400
```

Redeploy **msgf** service after env update.

---

## 3. Local smoke (pre-deploy)

```bash
npm run smoke:all -w msgf
```

---

## 4. Deckhost / Jessica verification

| Step | Action |
|------|--------|
| 1 | [Setup projects](https://elphiesgatedai.elphiesyntax.com/setup/projects) → `deckhostwmsgf/deck_host` |
| 2 | [Workspace IDE setup](https://elphiesgatedai.elphiesyntax.com/workspace#ide-setup) → **Test connection** |
| 3 | **Mint long-lived IDE token** (optional) → Open in VS Code / Cursor |
| 4 | Cursor → **Developer: Reload Window** |
| 5 | **MSGF: Test connection** → all green |
| 6 | Shadow scan → **Heal All…** → choose self-fix or cloud |
| 7 | Workspace FAB (bug) → submit test issue → check `occurrence_count` |

---

## 5. Post-deploy API smoke (curl)

Replace `TOKEN` and `TENANT`:

```bash
curl -sS "https://elphiesgatedai.elphiesyntax.com/api/msgf/ide/connectivity-check" \
  -H "Authorization: Bearer TOKEN" \
  -H "X-MSGF-Tenant-Key: deckhostwmsgf/deck_host" \
  -H "x-msgf-ide-pulse: 1" \
  -H "x-msgf-entity-id: test-entity"
```

---

## 6. Deferred (do not promise in v1)

- Disk-level auto-patch (P4 optional)
- Stripe billing entitlements
- Full Cursor MCP install (see [MSGF_IDE_MCP.md](./MSGF_IDE_MCP.md))

---

## Canonical docs

- [MSGF_IDE_SETUP_RUNBOOK.md](./MSGF_IDE_SETUP_RUNBOOK.md)
- [MSGF_IDE_INTEGRATION.md](./MSGF_IDE_INTEGRATION.md)
- [MSGF_AGENT_EXECUTION_MATRIX.md](./MSGF_AGENT_EXECUTION_MATRIX.md)
