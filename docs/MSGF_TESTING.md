# MSGF — Testing & verification (SSoT)

**Audience:** Operators / engineers (admin). End users validate MSGF through the web app, Pulse API, and IDE extension — not these npm scripts.

**Last updated:** 2026-05-23

**Companion:** [`packages/msgf/README.md`](../packages/msgf/README.md) (Phase 0 smoke) · [`MSGF_SOLO_INTEGRATION.md`](./MSGF_SOLO_INTEGRATION.md) (third-party / solo API) · [`MSGF_V1_ROADMAP.md`](./MSGF_V1_ROADMAP.md)

---

## 1. How to run commands (all platforms)

Use **npm workspaces** from the monorepo root (works on Windows, macOS, and Linux):

```bash
cd /path/to/ElphieSyntaxLLC
npm run <script> -w msgf
```

Or from `packages/msgf`:

```bash
cd packages/msgf
npm run <script>
```

Do **not** rely on `&&` in PowerShell for multi-step flows; use separate lines or the bundled runners below.

| Runner | Command | Needs `.env` |
| :--- | :--- | :---: |
| **All unit tests** | `npm run test:unit -w msgf` | No |
| **Integration (optional)** | `npm run test:integration -w msgf` | Yes |

---

## 2. Admin / operator — unit tests (offline-safe)

No live Supabase or Vertex required. Safe for CI and local dev on any OS.

| Script | What it verifies |
| :--- | :--- |
| `npm run test:unit -w msgf` | **Runs all rows below** (cross-platform `scripts/run-unit-tests.mjs`) |
| `npm run test:heal-queue -w msgf` | Heal-queue Zod, cron `6h`/`nightly` windows, LOM consensus strategy picker |
| `npm run test:ops-cron -w msgf` | `MSGF_OPS_CRON_SECRET` timing-safe compare, Hall Redis purge helpers |
| `npm run test:crossref-db -w msgf` | Postgres ENUM / DOMAIN mirrors in Zod |
| `npm run test:remediation-circuit -w msgf` | `PENDING_HUMAN_ARBITRATION` circuit breaker (max 3 failures) |
| `npm run test:human-arbitration -w msgf` | Human arbitration packages from strategy matrix |
| `npm run test:ingest-metadata -w msgf` | Ingest metadata / lineage Zod |

**Recommended admin smoke (fast):**

```bash
npm run test:unit -w msgf
```

---

## 3. Admin / operator — integration & env (needs credentials)

Loads env from repo root and `packages/msgf` (via `tsx --env-file-if-exists=...`).

| Script | Purpose |
| :--- | :--- |
| `npm run verify:msgf-env -w msgf` | Phase 0 — required vars + `service-account.json` |
| `npm run verify:db-schema -w msgf` | Postgres schema vs migrations (`DATABASE_URL`) |
| `npm run db:push:verify -w msgf` | Apply migrations + schema verify |
| `npm run upstash-redis-ping -w msgf` | Redis / Upstash connectivity |
| `npm run verify:brain-routing -w msgf` | Brain routing smoke |
| `npm run test:integration -w msgf` | Bundled integration scripts (see `run-integration-tests.mjs`) |
| `npm run test:v32-ultra -w msgf` | V3.2 architecture harness (Vault/Hall, purge, heartbeat wiring) |
| `npm run test:ingest-workflow -w msgf` | Ingest workflow against Supabase |
| `npm run test:author-validation -w msgf` | Author logic validation |
| `npm run test:lom-disagreement -w msgf` | LOM recursion — **requires dev server + `MSGF_ENABLE_LOM_TEST=1`** |

### LOM harness (admin)

1. Set in `.env.local` (root or `packages/msgf`):

   ```env
   MSGF_ENABLE_LOM_TEST=1
   ```

2. Terminal A:

   ```bash
   npm run dev -w msgf
   ```

3. Terminal B:

   ```bash
   npm run test:lom-disagreement -w msgf
   ```

   **Pass:** HTTP 403, `ERR_RECURSION_LIMIT`, `lom_attempts: 3`.

---

## 4. Admin — ops cron (`v32-heartbeat`)

**Endpoint:** `POST /api/msgf/ops/v32-heartbeat`

**Auth (strict):** `MSGF_OPS_CRON_SECRET` only — `Authorization: Bearer <secret>` or `X-MSGF-Ops-Cron-Secret: <secret>`. Admin API key is **not** accepted on this route.

**Scheduled heal behavior:**

- Loads `pillar_vectors` rows with `preset_interval` **`6h`** (every 6h tick) or **`nightly`** (first UTC window after midnight).
- Row must be `heal_queue_pending` or `remediation_state = SCHEDULED`.
- Skips `PENDING_HUMAN_ARBITRATION` (human operator required).
- Auto-settles via `RemediationEngine.resolveAutoCronLomConsensusStrategy()` (lowest structural-risk global strategy) + Vault persist — no mock templates.

**Manual dry-run (same secret):**

```bash
curl -sS -X POST "https://YOUR_MSGF_HOST/api/msgf/ops/v32-heartbeat" \
  -H "Authorization: Bearer YOUR_MSGF_OPS_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"dry_run\": true}"
```

**GitHub Actions:** `packages/msgf/.github/workflows/msgf-tier-heartbeat.yml` (needs repo secrets `MSGF_OPS_CRON_SECRET`, var `MSGF_APP_URL`).

**Other ops scripts:**

| Script | Purpose |
| :--- | :--- |
| `npm run ops:purge-hall -w msgf` | Hall purge CLI |
| `npm run security:prancer-pillars -w msgf` | Static security scan |
| `npm run probe:author-ecosystem -w msgf` | Cross-stack probe |

---

## 5. Admin — heal queue & human arbitration (API / UI)

| API | Purpose |
| :--- | :--- |
| `GET /api/msgf/heal-queue?tenant_id=<uuid>` | Tasks + `human_arbitration_packages` for circuit-open rows |
| `POST /api/msgf/heal-queue` | `BULK` · `INDIVIDUAL` · `SCHEDULED` (+ `preset_interval`) |
| `POST /api/msgf/heal-queue/human-arbitration` | `APPROVE_BYPASS` · `DENY_PURGE` for `PENDING_HUMAN_ARBITRATION` |

**Web UI:** `/dashboard` → pillar cards → **Post-Ingest Healing Console** (side-by-side strategy compare + operator buttons).

**IDE:** `msgf-pulse-guard` extension — same heal-queue client after shadow scan / stoplight anomaly.

**Verify (admin session or tenant API key):**

```bash
curl -sS "http://127.0.0.1:3000/api/msgf/heal-queue?tenant_id=YOUR_TENANT_UUID" \
  -H "Cookie: YOUR_SESSION_COOKIE"
```

---

## 6. End users (authors / tenants)

Users **do not** run npm test scripts. They exercise MSGF through:

| Surface | Validation |
| :--- | :--- |
| **MSGF web** | Sign in → dashboard → ingest / pillar health → healing drawer |
| **Pulse** | `POST /api/msgf/pulse` after pledge + baseline |
| **VS Code** | Pulse Guard stoplight + healing sidebar |

Operator-owned checks that user flows work:

1. `npm run dev -w msgf`
2. User completes pledge + baseline (see [`packages/msgf/README.md`](../packages/msgf/README.md) Phase 0 Steps B–E)
3. User triggers ingest or shadow scan; confirm heal-queue badges and actions in UI

---

## 6b. Solo service (third-party / deep test without Author)

Use when MSGF runs as a **standalone API** for Education, custom BFFs, or staging probes — not the Author monorepo.

| Step | Command |
| :--- | :--- |
| DB + schema | `npm run db:push:verify -w msgf` |
| Bootstrap tenant + license | `npm run bootstrap:solo -w msgf` (prints env block) |
| Offline gate | `npm run deep-test:solo` (unit + production build) |
| Live gate | Start `npm run dev -w msgf`, then `npm run deep-test:solo:live` |
| HTTP probe only | `npm run probe:solo -w msgf` |

Full contract, env vars, and BFF examples: [`MSGF_SOLO_INTEGRATION.md`](./MSGF_SOLO_INTEGRATION.md).

---

## 7. IDE extension (build only)

```bash
npm run compile -w msgf-pulse-guard
```

---

## 8. Phase 0 exit checklist (admin)

| Check | Command / signal |
| :--- | :--- |
| Env | `npm run verify:msgf-env -w msgf` |
| Unit suite | `npm run test:unit -w msgf` |
| Schema (optional) | `npm run verify:db-schema -w msgf` |
| Dev server | `npm run dev -w msgf` |
| Pledge + Pulse | Manual Steps B–E in package README |
| LOM | `npm run test:lom-disagreement -w msgf` (with harness flag + dev server) |

---

## Changelog

| Date | Change |
| :--- | :--- |
| 2026-05-23 | Solo deep-test: `bootstrap:solo`, `probe:solo`, `deep-test:solo`, [`MSGF_SOLO_INTEGRATION.md`](./MSGF_SOLO_INTEGRATION.md). Heal-queue accepts license + silo `tenant_id`. |
| 2026-05-23 | Initial SSoT: admin vs user, `test:unit` / `test:integration`, strict `v32-heartbeat`, heal-queue human arbitration, cross-platform runners. |
