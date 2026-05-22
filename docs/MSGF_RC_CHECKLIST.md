# MSGF 1.0 RC — Completion checklist (MSGF only)

**Scope:** `packages/msgf` + `msgf-pulse-guard` + ops deploy. **Out of scope:** Stripe (M3), Author 1.0 product, Education MVP.

**Gate for tag `msgf-v1.0.0`:** All **P0** and **P1** checked; **P2** documented or deferred with owner.

**SSoT context:** [`MSGF_V1_ROADMAP.md`](./MSGF_V1_ROADMAP.md) · [`MSGF_TESTING.md`](./MSGF_TESTING.md) · [`MSGF_BRAIN_ROUTING.md`](./MSGF_BRAIN_ROUTING.md)

**Last updated:** 2026-05-20

---

## P0 — Automated gate (blocks RC)

Run from monorepo root. All must pass on a clean machine with env filled.

- [ ] `npm run test:unit -w msgf`
- [ ] `npm run test:savings -w msgf`
- [ ] `npm run deep-test:solo -w msgf`
- [ ] `npm run verify:msgf-env -w msgf`
- [ ] `npm run db:push:verify -w msgf` (when touching schema)
- [ ] `npm run validate:deployment` (unit + production `next build`)

**Integration (needs Supabase / Redis env):**

- [ ] `npm run test:integration -w msgf`
- [ ] `npm run test:ingest-workflow -w msgf`
- [ ] `npm run test:v32-ultra -w msgf`
- [ ] `npm run bootstrap:solo -w msgf` → `npm run probe:solo -w msgf` (staging URL)

**Heal / brain / HAL:**

- [ ] `npm run test:heal-queue -w msgf`
- [ ] `npm run test:human-arbitration -w msgf`
- [ ] `npm run test:remediation-circuit -w msgf`
- [ ] `npm run test:brain-routing -w msgf`
- [ ] `npm run test:heal-queue-audience -w msgf`
- [ ] `npm run test:hal-word-chunk -w msgf`

---

## P0 — Staging smoke (manual, one tenant)

Document date + operator + tenant id in changelog when done.

- [ ] Sign pledge → Pulse baseline (cookie or license)
- [ ] `POST /api/msgf/ingest` — confirm `lineage_map`, `brain_readiness`
- [ ] `GET /api/msgf/heal-queue` — user session: `audience_scope: user`, no arbitration packages
- [ ] Admin session: full queue + `POST .../human-arbitration` on circuit-open row (if present)
- [ ] `/admin/dashboard#token-savings` + `#big-brain-issues` load live data
- [ ] `POST /api/msgf/ops/v32-heartbeat` with `{"dry_run":true}` — 200 + expected summary
- [ ] `/setup/projects` — monorepo preset creates row with correct `project_origin`

---

## P1 — V3.2 engine (§2.6 three partials → Done)

### CROSS-REF

- [ ] Pulse route uses thin-handler / pipeline path with Vault/Hall `preFlightCheck` on live requests
- [ ] Invalid `bug_index` / pillar metadata rejected before consensus (Zod + DB trigger aligned)
- [ ] Staging RED path: shadow block or CROSS-REF short-circuit observable in response metadata

### CONVERGE

- [ ] Staging: logic drift above threshold invokes dual-model (`global_converge` or documented bypass with reason)
- [ ] IDE dev-event / dev-session paths confirmed **never** hit biometric → CONVERGE chain
- [ ] `npm run test:savings-qa-checkpoints -w msgf` (checkpoints 18–19) green

### ARBITRATE

- [ ] LOM harness: `MSGF_ENABLE_LOM_TEST=1` + `test:lom-disagreement` on staging dev server
- [ ] Live Cloud Run: heal-queue E2E — circuit breaker → human arbitration approve/deny
- [ ] Cron skips `PENDING_HUMAN_ARBITRATION` (verify in heartbeat logs)

---

## P1 — Production ops (no mock authority)

- [ ] `MSGF_OPS_CRON_SECRET` on Cloud Run + GitHub Actions `msgf-tier-heartbeat.yml`
- [ ] `REDIS_URL` or Upstash — `/health` SHARD green; savings counters increment
- [ ] Supabase service role on deploy — dashboard pillar health not `mockDashboardHealthReport`
- [ ] Eco rollups / public eco metrics: UI gated on `source === "live"` or errors surfaced
- [ ] Demo streams (`v32_mock_stream`, fake ticker events) disabled or ops-only in production
- [ ] `npm run verify:brain-routing -w msgf` on staging (live smoke)

---

## P1 — MSGF product surface (gatedai)

- [ ] Landing, pricing, workspace, `/status`, extension download routes work on staging
- [ ] Token savings panel (user) + admin catalog + pulse routing mix — live Redis counters
- [ ] Credit guard / reservation: 402 path tested with reservation enabled
- [ ] Solo integrator: license mint + `probe:solo` against production/staging gatedai URL

---

## P2 — MSGF RC sign-off (M6)

- [ ] **Runbook:** deploy (`validate:deployment` → `./deploy.sh` / `setup-cloud.sh`), cron, rollback, on-call for arbitration queue
- [ ] **Load smoke:** concurrent Pulse + ingest on staging (modest RPS)
- [ ] **Prancer:** `npm run security:prancer-pillars` green on PR
- [ ] **§7.1 audit:** each mock/dead-end route either fixed, gated, or listed as ops-only in runbook
- [ ] Tag `msgf-v1.0.0` with release notes pointing to this checklist

---

## Explicitly not required for MSGF RC

| Item | Track |
| :--- | :--- |
| Stripe Checkout / webhook | Post-test (M3) |
| `packages/msgf/apps/web` split | Optional M2 polish |
| Author BFF healing popout | Author 1.x |
| Education LTI / sandbox MVP | [`syntax-education/ROADMAP.md`](./syntax-education/ROADMAP.md) |
| Nanosecond hot-layer SLO | 1.1 |
| Full Pulse monolith → modular route refactor | 1.1 minimum if RED path green |

---

## Ecosystem minimum (optional for RC tag — only if M5 in gate)

MSGF can RC without these; include if your gate requires M5:

- [ ] `npm run probe:author-ecosystem -w msgf` on staging
- [ ] One `tenant_education` Pulse smoke

---

## Changelog

| Date | Note |
| :--- | :--- |
| 2026-05-20 | Initial MSGF-only RC checklist (P0–P2). |
| 2026-05-20 | Build fixes: `ide-connector` devSession default, `PostIngestHealingConsole` null queue, `PulseRoutingKind` alias, `heal-queue-audience` RemediationTask types. |
