# MSGF V3.2 — Production deploy checklist

Use after merging the P0–P4 roadmap work. **Code is built; production needs deploy + migrations.**

**Last updated:** 2026-08-11

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
| `20260724030400_msgf_company_tier_rules.sql` | Part B company CONVERGE tier overrides |
| `20260805010000_tri_consensus_config.sql` | TRI tenant consensus + xAI provider CHECK |
| `20260806010000_provider_usage_proven_savings.sql` | Metered usage + proven avoidance events |
| `20260806020000_period_savings_reports.sql` | Weekly/monthly period reports |
| `20260806030000_shadow_evaluation_logs.sql` | Shadow Proxy eval ledger |
| `20260806030100_period_reports_shadow_usd.sql` | Shadow projected USD on period reports |
| `20260806200000_launch_governance_writers.sql` | Proven/usage gateway audit columns |
| `20260810010000_msgf_p7_source_reputation.sql` | P7 source audit + reputation + reverse impact |
| `20260811010000_p4_active_incidents_bug_inbox.sql` | Bug inbox columns on `p4_active_incidents` |
| `20260811020000_p4_upsert_reopen_bug_inbox.sql` | Reopen dismissed inbox rows on re-report |

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
# Stripe (M3 — paid go-live; see MSGF_DEV_TODO.md §2b):
# STRIPE_SECRET_KEY=...
# STRIPE_WEBHOOK_SECRET=...
# STRIPE_PRICE_PRO_INDIVIDUAL=price_...
# STRIPE_PRICE_STARTUP_TEAM=price_...
# MSGF_STRIPE_WEBHOOK_LIVE=1
# MSGF_ENTITLEMENT_MOCK_STRIPE_ACTIVE=0
# Gateway / Active Governance (optional):
# MSGF_ACTIVE_AGGRESSIVENESS=shard-and-route
# MSGF_ACTIVE_PASSTHROUGH_FALLBACK=1
# Never set ALLOW_DEMO_TENANT=true in production
# Optional:
# MSGF_IDE_TOKEN_TTL_DAYS=90
# MSGF_HEAL_RESERVE_CHUNK=400
```

Redeploy **msgf** service after env update.

---

## 3. Local smoke (pre-deploy)

```bash
npm run test:unit -w msgf
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
| 6 | Passive IDE Scan → **Heal All…** → choose self-fix or cloud |
| 7 | Workspace FAB (bug) → submit test issue → check `occurrence_count` |
| 8 | Reports → Shadow Proxy / period PDF (after pointing an SDK at `/api/v1`) |

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

Shadow Proxy (replace `MSGF_KEY` + OpenAI key):

```bash
curl -sS "https://elphiesgatedai.elphiesyntax.com/api/v1/chat/completions" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "x-msgf-key: $MSGF_KEY" \
  -H "x-msgf-mode: shadow" \
  -H "content-type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"ping"}]}'
```

---

## 6. Deferred (do not promise in v1 soft-RC)

- Disk-level auto-patch (P4 optional)
- Stripe Customer Portal / invoice history UI (Checkout itself is **in plan** — M3 / DEV_TODO §2b)
- Full Cursor MCP install (see [MSGF_IDE_MCP.md](../integrations/technical-specs/MSGF_IDE_MCP.md))
- Embedding semantic similarity cache / dual-TRI chat wire on Active gateway (hash cache + state-gate shipped)

---

## Canonical docs

- [MSGF_SHADOW_PROXY.md](./technical-specs/MSGF_SHADOW_PROXY.md)
- [MSGF_PRODUCT_OVERVIEW.md](./marketing/MSGF_PRODUCT_OVERVIEW.md)
- [MSGF_IDE_SETUP_RUNBOOK.md](../integrations/technical-specs/MSGF_IDE_SETUP_RUNBOOK.md)
- [MSGF_IDE_INTEGRATION.md](../integrations/technical-specs/MSGF_IDE_INTEGRATION.md)
- [MSGF_AGENT_EXECUTION_MATRIX.md](./build-plans/MSGF_AGENT_EXECUTION_MATRIX.md)
