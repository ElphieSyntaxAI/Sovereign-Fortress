# MSGF — Modular State-Gate Framework

**Production:** https://elphiesgatedai.elphiesyntax.com

MSGF is the **brain and guardrail engine** for Elphie Syntax products and a **standalone gated-AI platform** for third-party software. It runs as its own Next.js app (`packages/msgf`); Author Ecosystem integrates later via HTTP contracts only.

## Documentation

| Doc | Purpose |
| :--- | :--- |
| [`docs/msgf/MSGF_V1_ROADMAP.md`](../../docs/msgf/MSGF_V1_ROADMAP.md) | **1.0 vision & release plan** (MSGF V3.2-ULTRA) |
| [`docs/msgf/marketing/MSGF_PRODUCT_OVERVIEW.md`](../../docs/msgf/marketing/MSGF_PRODUCT_OVERVIEW.md) | **Product map, full features & sales angles** |
| [`docs/msgf/technical-specs/MSGF_CONVERGE_TIER.md`](../../docs/msgf/technical-specs/MSGF_CONVERGE_TIER.md) | **Part B** — 3-tier CONVERGE + T3 quarantine |
| [`docs/msgf/technical-specs/MSGF_ADMIN_HUB.md`](../../docs/msgf/technical-specs/MSGF_ADMIN_HUB.md) | **Ops console** — bug inbox, provenance, ARBITRATE, quarantine, audits |
| [`docs/msgf/technical-specs/MSGF_LEARNING_AND_BIG_BRAIN.md`](../../docs/msgf/technical-specs/MSGF_LEARNING_AND_BIG_BRAIN.md) | **Learning loop** — Vault without Big Brain; `smoke:pulse-converge` |
| [`docs/msgf/technical-specs/MSGF_TESTING.md`](../../docs/msgf/technical-specs/MSGF_TESTING.md) | **Testing SSoT** — admin scripts vs end-user flows (Windows / macOS / Linux) |
| [`docs/integrations/technical-specs/MSGF_SOLO_INTEGRATION.md`](../../docs/integrations/technical-specs/MSGF_SOLO_INTEGRATION.md) | **Solo / BYOK** — bootstrap, license Pulse, probes for third-party projects |
| [`docs/msgf/technical-specs/MSGF_SHADOW_PROXY.md`](../../docs/msgf/technical-specs/MSGF_SHADOW_PROXY.md) | **Shadow Proxy + Active Governance** — `/api/v1` OpenAI/Anthropic gateway |
| [`docs/msgf/technical-specs/MSGF_GLOBAL_BRAIN_TELEMETRY.md`](../../docs/msgf/technical-specs/MSGF_GLOBAL_BRAIN_TELEMETRY.md) | **Zero-text Global Brain swarm telemetry** — never train on prompts; Session Replay is tenant forensics |
| [`docs/msgf/marketing/MSGF_BUYER_WALKTHROUGH.md`](../../docs/msgf/marketing/MSGF_BUYER_WALKTHROUGH.md) | **Buyer / SaaS** — waitlist/invite, `/sign-in`, pricing, session Pulse (not integrator license) |
| [`docs/MONOREPO_PRODUCTS.md`](../../docs/MONOREPO_PRODUCTS.md) | Three web apps & domains |
| [`docs/msgf/technical-specs/MSGF_BRAIN_ROUTING.md`](../../docs/msgf/technical-specs/MSGF_BRAIN_ROUTING.md) | **Small Brain / Big Brain** — audience routing, heal queue, monorepo workspaces |
| [`docs/msgf/MSGF_RC_CHECKLIST.md`](../../docs/msgf/MSGF_RC_CHECKLIST.md) | **MSGF 1.0 RC** — P0 automated + staging smoke; **P0-M3 Stripe** for paid claims |
| [`supabase/email-templates/README.md`](./supabase/email-templates/README.md) | **Branded auth emails** — logo + jewel aesthetic; `npm run email:templates:build -w msgf` |
| [`pre_ingestion_audit.md`](./pre_ingestion_audit.md) | Day-zero audit (SWEEP) & CONVERGE backlog |
| [`docs/PILLAR_PROGRESS.md`](../../docs/PILLAR_PROGRESS.md) | Pillar/AUTH implementation tracker |

**External spec:** [`docs/references/MSGF_v3_2_masterdoc.pdf`](../../docs/references/MSGF_v3_2_masterdoc.pdf)

---

## Phase 0 — Environment setup

### 1. Configure env

At the **monorepo root**, copy [`.env.example`](../../.env.example) → `.env.local` and fill the **MSGF** block (and shared Supabase keys).

| Variable | Purpose |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin client (pledge seed, LOM DB check) |
| `REDIS_URL` | V3.2 hot layer (e.g. `redis://127.0.0.1:6379`) |
| `STRIPE_SECRET_KEY` | Stripe API (test mode in dev) |
| `STRIPE_WEBHOOK_SECRET` | `POST /api/webhooks/stripe` signature |
| `MSGF_ENABLE_LOM_TEST` | `1` or `true` before LOM integration test |
| `MSGF_INGEST_API_KEY` | Ingest route tenant key (when key-gated) |
| `MSGF_PULSE_IDEMPOTENCY_ENABLED` | Redis dedupe for duplicate Pulse bodies (default on when `REDIS_URL` set) |
| `MSGF_USAGE_MONITOR_WRITE` | Write estimated tokens to `usage_monitor` (aligns with credit guard; default on) |
| `MSGF_ECO_PROVEN_ONLY` | Default **on** — public eco ignores estimated routing; proven avoidance / pack deltas only |
| `MSGF_ACTIVE_AGGRESSIVENESS` | Active gateway: `cache-only` · `shard-and-route` (default) · `full-consensus` |
| `MSGF_ACTIVE_PASSTHROUGH_FALLBACK` | Default on — Active orchestrator errors fall back to pass-through |
| `MSGF_P7_REPUTATION_HALFLIFE_DAYS` | P7 count half-life (default 30; `0` disables). Prompt hashes use `x-msgf-prompt-hash` |
| `ALLOW_DEMO_TENANT` / `MSGF_SHADOW_ALLOW_DEMO_TENANT` | Non-prod only — demo gateway tenant when key missing |
| `POST /api/v1/chat/completions` · `POST /api/v1/messages` | Shadow Proxy / Active Governance (see [`MSGF_SHADOW_PROXY.md`](../../docs/msgf/technical-specs/MSGF_SHADOW_PROXY.md)) |
| `MSGF_CREDIT_RESERVATION_ENABLED` / `MSGF_CREDIT_RESERVATION_PROD_DEFAULT` | Reserve credits before Pulse/ingest; prod defaults on unless disabled |
| `MSGF_PULSE_LOCAL_RESERVE_CHUNK` / `MSGF_INGEST_LIGHT_RESERVE_CHUNK` | Smaller reserves for Author HAL / hash-skipped ingest |
| `MSGF_INGEST_HASH_SKIP` / `MSGF_INGEST_SKIP_AUDIT_ON_HASH_HIT` | Skip SWEEP/audit when file content hash unchanged |
| `MSGF_NAIVE_DUAL_CONVERGE_TOKENS` / `MSGF_LOCAL_GATEWAY_BASE_TOKENS` | Ops-only routing estimates (not public eco when proven-only) |
| `MSGF_CONVERGE_MAX_CONTEXT_TOKENS` | Cap vault + beats + P2 + DEFEND blocks before global CONVERGE (default 2400) |
| `MSGF_DEV_SESSION_DEFAULT` / `MSGF_DEV_SESSION_DRIFT_RELAX` | IDE vibe-coding: relaxed logic drift, save-primary flush |
| `x-msgf-dev-session`, `x-msgf-build-active`, `x-msgf-active-file`, `x-msgf-flush-reason` | IDE Pulse headers (see `IdeConnector`) |
| `POST /api/msgf/dev-event` | IDE `build_failed` — vault-first Heal Cheap, no keystroke/biometric pipeline |
| `POST /api/msgf/verify-result` | Safe Build / Run Scripts pass-fail → narrative log + Vault/Hall ledger |
| `POST /api/msgf/prompt-optimizer` | 0-token structured prompt + verify script list (no server LLM) |
| `POST /api/msgf/confirm-pack` | Confirm pack used → guided session + context savings tokens |
| `MSGF_VERIFY_HALL_FAIL_THRESHOLD` | Repeated verify failures before Hall persist (default `3`) |
| `MSGF_DEV_EVENT_VAULT_MATCH_MIN` / `MSGF_DEV_EVENT_GEMINI_MODEL` | Vault-only resolve threshold; Flash model (default `gemini-2.0-flash`) |
| `MSGF_CONVERGE_CACHE_ENABLED` / `MSGF_CONVERGE_CACHE_TTL_SEC` | Redis replay of global dual-model CONVERGE (default 600s); eco rollup on cache hit |

### Small Brain vs Big Brain

| Tier | Meaning | Dashboard audience |
| :--- | :--- | :--- |
| **Small Brain** | Tenant-local — Vault, `state_beats`, Redis hot layer, Heal Cheap / bypass, dev-event, cache replay. No global DNA without admin. | **Users** — `/dashboard`, user-scoped heal queue, user savings API |
| **Big Brain** | Platform global CONVERGE + operator paths. Promotions to `msgf_rules` / `vault_core` need approval. | **Admins** — `/admin/dashboard#big-brain-issues`, human arbitration, admin savings API |

Full internal reference: [`docs/msgf/technical-specs/MSGF_BRAIN_ROUTING.md`](../../docs/msgf/technical-specs/MSGF_BRAIN_ROUTING.md). Swarm absorb into Global Brain is **structural only** ([`MSGF_GLOBAL_BRAIN_TELEMETRY.md`](../../docs/msgf/technical-specs/MSGF_GLOBAL_BRAIN_TELEMETRY.md)).

| Module | Role |
| :--- | :--- |
| `lib/services/brain-routing-policy.ts` | Feature catalog, `audienceForBrainTier`, pulse classification |
| `lib/services/global-approval-gate.ts` | Global write gate + `dev_event` logic delta source |
| `lib/services/heal-queue-audience.ts` | User vs admin heal-queue response scope |
| `lib/services/monorepo-workspace-presets.ts` | One workspace per monorepo app (`project_origin`) |
| `lib/services/resolve-dashboard-operator.ts` | GLOBAL / COMPANY operator session check |

**Verify:** `npm run test:brain-routing` · `npm run test:heal-queue-audience` · `npm run verify:brain-routing` (live smoke, needs env).

### Monorepo workspaces

Register **each app** as its own `msgf_user_projects` row (not only the git root):

- **UI:** `/setup/projects` — presets + one-click add (`ProjectSetupClient.tsx`)
- **API:** `GET /api/workspace/monorepo-presets`
- **Presets:** MSGF (`packages/msgf`), Author (`apps/author-ecosystem`), Syntax Educates, Vortex — see `monorepo-workspace-presets.ts`

### Dashboard — token savings & heal queue

| Audience | Page | API |
| :--- | :--- | :--- |
| Signed-in tenant | `/dashboard#token-savings` | `GET /api/msgf/dashboard/savings-features?tenant_id=` (Small Brain catalog) |
| GLOBAL / COMPANY admin | `/admin/dashboard#token-savings` · `#big-brain-issues` | `GET /api/msgf/admin/dashboard/savings-features?tenant_id=` (full catalog) |

The **Token savings layer** panel lists 24h Redis counters and a feature catalog with brain badges. Users see Small Brain features only; operators see Big Brain rows (global CONVERGE, arbitration, rule promotion).

**Reports** (`/dashboard/daily-reports`): weekly/monthly metered consumption vs proven savings + PDF; **Shadow Proxy** projected $ is labeled separately (not proven eco).

**Provider gateway:** Point OpenAI/Anthropic SDKs at `/api/v1` with `x-msgf-key` (`msgf_live_*` / `msgf_ide_*`). Default `x-msgf-mode: shadow` (zero-latency projected eval). `active` runs cache + state-gate + sharded upstream. Tenant is never taken from client `x-msgf-tenant-id`.

**IDE Command Center (extension v0.2.3):** Prompt optimizer → `.msgf/run-scripts.json` → **Run Scripts** / **Safe Build** → `verify-result` / `dev-event` → savings counters (`verify_result_*`, `run_script_rerun`). See [`docs/msgf/marketing/MSGF_PRODUCT_OVERVIEW.md`](../../docs/msgf/marketing/MSGF_PRODUCT_OVERVIEW.md) §3.

**Heal queue:** Session users get Small Brain tasks only; `big_brain_escalations_pending` counts items waiting on admin. **API key** callers receive the full queue. Human arbitration UI and `POST .../human-arbitration` require an operator session on the admin dashboard.

**Tests:** `npm run test:savings` (bundle) · `test:brain-routing` · `test:heal-queue-audience` · QA checkpoints 18–19 in `tests/savings-qa-checkpoints.test.ts`.

### 2. Vertex AI credentials

Place your GCP service account JSON at:

`packages/msgf/service-account.json`

(`predev` / `prebuild` run `msgf-init.cjs`, which requires this file.) Alternatively set `GOOGLE_APPLICATION_CREDENTIALS` to the key file path.

### 3. Verify Phase 0 env

From repo root:

```bash
npm run verify:msgf-env -w msgf
```

Exits non-zero if any required variable is missing or `service-account.json` is invalid.

### 4. Database schema (cold layer)

Apply Supabase migrations under `supabase/migrations/` (Supabase CLI — not Prisma/Drizzle):

```bash
# From repo root — set DATABASE_URL in packages/msgf/.env.local or root .env.local first
npm run db:push
```

Then verify:

```bash
npm run verify:db-schema -w msgf
```

Requires `DATABASE_URL` or `SUPABASE_DATABASE_URL` (Postgres connection string from Supabase Dashboard → Database).

---

## Phase 0 — Smoke test

**Goal:** Prove MSGF alone — no Author BFF — can authenticate, pledge, establish a Pulse baseline, and pass the LOM recursion harness.

**Prerequisites:** Steps 1–4 above; Redis running if hot-layer code paths expect it.

### Step A — Start MSGF

```bash
npm run dev -w msgf
```

Default: **http://127.0.0.1:3001** (`PORT=3001` in `packages/msgf/package.json`)

### Step B — Create test user

In [Supabase Dashboard](https://supabase.com/dashboard) → **Authentication** → **Users** → **Add user**, or use the Auth API:

- Email: e.g. `msgf-smoke@yourdomain.test`
- Password: strong test password
- Confirm email if required by project settings

Note the user **UUID** (`auth.users.id`).

### Step C — Pledge (`state_beats`)

Pulse requires a `state_beats` row for the current legal version (`2026.09.18-UTAH-SAFE` — see `lib/msgf-legal.ts`).

**SQL Editor** (service role) — replace `YOUR_USER_UUID`:

```sql
insert into public.state_beats (
  author_id,
  beat_text,
  legal_version,
  sequence_index,
  label,
  metadata
) values (
  'YOUR_USER_UUID',
  'No-AI-Training Pledge accepted (Phase 0 smoke test).',
  '2026.09.18-UTAH-SAFE',
  1,
  'pledge',
  '{"source":"phase0_smoke_test"}'::jsonb
);
```

Without this row, `POST /api/msgf/pulse` returns **403** (“Please sign the No-AI-Training Pledge…”).

### Step D — Sign in and capture session cookie

1. Open the MSGF app (or use Supabase Auth sign-in against your project).
2. Sign in as the test user.
3. Copy the browser **Cookie** header for requests to `localhost:3001` (must include Supabase `sb-*-auth-token`).

Store for later:

```bash
# In .env.local (repo root) — example name used by LOM test
MSGF_PULSE_COOKIE="sb-...-auth-token=..."
```

### Step E — Pulse baseline

Send keystrokes until baseline is satisfied. First call may return **202** with `baseline_required: true` and a training prompt.

```bash
curl -sS -X POST "http://127.0.0.1:3001/api/msgf/pulse" \
  -H "Content-Type: application/json" \
  -H "Cookie: $MSGF_PULSE_COOKIE" \
  -d '{
    "keystrokes": [
      {"ts": 1, "key": "I", "type": "keydown"},
      {"ts": 2, "key": " ", "type": "keydown"},
      {"ts": 3, "key": "l", "type": "keydown"},
      {"ts": 4, "key": "o", "type": "keydown"},
      {"ts": 5, "key": "v", "type": "keydown"},
      {"ts": 6, "key": "e", "type": "keydown"},
      {"ts": 7, "key": " ", "type": "keydown"},
      {"ts": 8, "key": "b", "type": "keydown"},
      {"ts": 9, "key": "o", "type": "keydown"},
      {"ts": 10, "key": "o", "type": "keydown"},
      {"ts": 11, "key": "k", "type": "keydown"},
      {"ts": 12, "key": "s", "type": "keydown"}
    ]
  }'
```

Repeat with additional natural typing until responses are **200** with `ok: true` (biometric profile + consensus path), not **202** baseline prompts.

### Step F — LOM disagreement test

Enable the harness in `.env.local`:

```env
MSGF_ENABLE_LOM_TEST=1
```

Restart `npm run dev -w msgf`, then:

```bash
npm run test:lom-disagreement -w msgf
```

**Pass criteria:**

- HTTP **403** with `err: "ERR_RECURSION_LIMIT"` and `lom_attempts: 3`
- Matching **rejected** row in `p4_state_ledger` for the test user

### Phase 0 exit checklist

| Check | Command / signal |
| :--- | :--- |
| Unit tests | `npm run test:unit -w msgf` |
| Env | `npm run verify:msgf-env -w msgf` |
| Schema | `npm run verify:db-schema -w msgf` (optional) |
| Dev server | `npm run dev -w msgf` |
| Pledge + Pulse | Steps B–E (no 403 pledge / baseline cleared) |
| LOM | `npm run test:lom-disagreement -w msgf` |

When all pass, Phase 0 is complete — proceed to Phase 1 (SHARD/DEFEND) in [`docs/msgf/MSGF_V1_ROADMAP.md`](../../docs/msgf/MSGF_V1_ROADMAP.md) before Author Ecosystem integration.

Add **`npm run test:unit -w msgf`** to the checklist for a fast offline regression pass (see [Testing](#testing-admin-vs-end-users)).

---

## Testing (admin vs end users)

Full reference: [`docs/msgf/technical-specs/MSGF_TESTING.md`](../../docs/msgf/technical-specs/MSGF_TESTING.md).

**Operators (you)** run npm scripts from the repo root on **Windows, macOS, or Linux**:

```bash
npm run test:unit -w msgf
```

**End users** (authors / tenants) do not run these commands — they use the dashboard, Pulse API, and the Pulse Guard IDE extension.

| Role | What to run |
| :--- | :--- |
| **Admin — fast offline** | `npm run test:unit -w msgf` · `npm run test:savings -w msgf` (token savings, brain routing, heal audience, QA 18–19) |
| **Admin — env / DB** | `npm run verify:msgf-env -w msgf` · `npm run verify:db-schema -w msgf` |
| **Admin — integration** | `npm run test:integration -w msgf` (needs `.env`; optional `test:lom-disagreement` with dev server) |
| **User** | Sign in → dashboard healing drawer; Pulse; IDE extension — no npm |

Use separate terminal commands (not PowerShell `&&` chains) when running multiple steps.

---

## Scripts

| Script | Purpose |
| :--- | :--- |
| `npm run test:unit -w msgf` | **All unit tests** (cross-platform; no Supabase) |
| `npm run test:integration -w msgf` | Bundled integration tests (needs env) |
| `npm run verify:msgf-env -w msgf` | **Phase 0** — env + `service-account.json` |
| `npm run verify:db-schema -w msgf` | Postgres schema vs migrations |
| `npm run dev -w msgf` | Next dev server |
| `npm run build -w msgf` | Production build |
| `npm run test:heal-queue -w msgf` | Heal-queue Zod + cron `6h`/`nightly` + LOM consensus picker |
| `npm run test:ops-cron -w msgf` | Ops cron secret + Redis purge helpers |
| `npm run test:remediation-circuit -w msgf` | Circuit breaker → `PENDING_HUMAN_ARBITRATION` |
| `npm run test:human-arbitration -w msgf` | Human arbitration strategy packages |
| `npm run test:crossref-db -w msgf` | CROSS-REF ENUM / Zod mirrors |
| `npm run test:lom-disagreement -w msgf` | LOM / recursion harness (dev server + `MSGF_ENABLE_LOM_TEST`) |
| `npm run probe:author-ecosystem -w msgf` | Cross-stack smoke (post–integration) |
| `npm run security:prancer-pillars -w msgf` | Static security scan |
| `npm run test:v32-ultra -w msgf` | V3.2-ULTRA integration harness (Vault/Hall, purge, directive) |
| `npm run test:savings -w msgf` | Token savings bundle (routing, idempotency, ingest hash, dev-event, CONVERGE cache, brain-routing, heal-queue-audience, QA 18–19) |
| `npm run test:brain-routing -w msgf` | Small/Big Brain catalog + pulse classification (offline) |
| `npm run test:heal-queue-audience -w msgf` | User vs admin heal-queue scope (offline) |
| `npm run verify:brain-routing -w msgf` | Live brain-routing smoke (needs Supabase env) |
| `GET /health` | Liveness + V3.2 SHARD (Redis) checklist |
| `POST /api/msgf/ops/v32-heartbeat` | Cron: tier batches + **`6h`/`nightly`** scheduled heals (LOM consensus + Vault) + Hall purge — **`MSGF_OPS_CRON_SECRET` only** |
| `GET/POST /api/msgf/heal-queue` | Remediation queue; session GET applies user/admin scope; `human_arbitration_packages` admin-only for users |
| `POST /api/msgf/heal-queue/human-arbitration` | APPROVE/DENY — operator session required (API key path unchanged) |
| `GET /api/workspace/monorepo-presets` | Monorepo app workspace presets (authenticated) |

**Production Redis (SHARD):** Upstash REST (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`), Memorystore (`REDIS_HOST`), or local `REDIS_URL`. Verify with `npm run upstash-redis-ping -w msgf`. Optional `MSGF_REQUIRE_REDIS=1` rejects Pulse when hot layer is down.

---

## Layout

- `app/` — Next.js routes (`/api/msgf/pulse`, ingest, Stripe webhook, …)
- `lib/services/PulseEngine.ts` — V3.2 pipeline: `gate` → `crossRef` → `defend`; Vault/Hall persist
- `lib/schemas/vault-hall-metadata.ts` — Zod `bug_index` (1.0 / 1.1 / 1.1.1) + Vault/Hall metadata
- `lib/services/constraint-ledger.ts` — differential persist → `pillar_vectors` + `p4_narrative_logs`
- `lib/redis-client.ts` — ioredis client from `REDIS_URL` (exported via `msgf/connector`)
- `lib/redis.ts` — Hot-layer key helpers + re-exports
- `lib/services/vault-lineage-p2-cache.ts` — `msgf:lineage:{authorId}:{documentId}` (300s TTL)
- `lib/msgf-hot-layer.ts` — P4 active slices (uses `lib/redis.ts`)
- `lib/` — Shadow, consensus, credit guard, ingest
- `scripts/verify-msgf-env.mjs` — Phase 0 env verifier
- `supabase/migrations/` — Shared database
- `service-account.json` — Vertex credentials (gitignored; not committed)
- `apps/web/` — Future public marketing/checkout (M2)
