# MSGF Boss Demo Runbook (≈10 minutes)

**Audience:** Jessica + boss  
**Hub:** `elphiesgatedai.elphiesyntax.com` (or local `http://127.0.0.1:3001`)  
**Scope:** MSGF-only (no Author / Education / Stripe)

---

## Story arc

```text
Map projects → Monitor (Sentry) → Verify (Safe Build)
       → Quarantine HITL if poisoned → Sign (mock OK) → IDE mint
       → Deploy gate (green) before Starport
```

---

## Prep (once)

1. Migrations applied (`npm run db:push` — I1/A1 green).
2. Boss user is `GLOBAL_ADMIN` (or company admin with domains seeded).
3. Env on host: `SENTRY_*` (optional live), `MSGF_SIGNING_MOCK=1` for signing demo, GitHub OAuth if showing repo picker.
4. Map projects under Setup Projects: Starmap / Starport / Devlish (GitHub multi-select or local subfolders).
5. Optional: `POST /api/msgf/workspace/company-domains` with `{ "domain": "yourco.com" }` for Workspace SSO story.

---

## Live walkthrough

### 1. Map (2 min)
- `/setup/projects` → Connect GitHub **or** add local paths.
- Show `project_origin` rows (one silo per product).

### 2. Ops console (3 min)
- `/admin/sign-in` → `/admin/ops`
- **ARBITRATE** — live heal queue (not mock).
- **Quarantine review** — if empty, note “Sentry webhook can quarantine Vault wins; HITL only demotes to Hall.”
- **Sentry** — Load issues (if configured) · filter story by project.
- **Signing** — mock complete if invite pending.

### 3. Verify → deploy gate (3 min)
- From IDE / Pulse Guard: Safe Build → `POST /api/msgf/verify-result` with `passed: true` for a mapped `tenant_id` / `project_origin`.
- Probe gate (ops secret or session):

```bash
curl -s -H "Authorization: Bearer $MSGF_OPS_CRON_SECRET" \
  "https://<HOST>/api/msgf/deploy-gate?project_origin=starmap"
```

Expect `"status":"green"`, `"deploy_allowed":true`.

- Show red path: post `passed: false` → gate `"status":"red"` → “Starport waits.”

### 4. Close (2 min)
- Mint IDE token from workspace after signing unlocked.
- One sentence: **MSGF is the governance brain; Starport deploys only when verify is green; Devlish stays deterministic rules; Starmap is product.**

---

## Failures & fallbacks

| Issue | Fallback |
| :--- | :--- |
| Sentry unconfigured | Skip Load issues; show panel “unconfigured” is intentional |
| No Google Workspace | Email/password + invite; `/invite-only` for personal Gmail |
| No DocuSign | `MSGF_SIGNING_MOCK=1` + mock-complete |
| Empty quarantine | Describe A2 webhook → A3 HITL without live crash |

---

## Related

- [`MSGF_DEV_TODO.md`](./MSGF_DEV_TODO.md) · [`MSGF_SIGNING.md`](./MSGF_SIGNING.md) · [`MSGF_SENTRY.md`](./MSGF_SENTRY.md) · [`MSGF_GOOGLE_WORKSPACE_SSO.md`](./MSGF_GOOGLE_WORKSPACE_SSO.md)
