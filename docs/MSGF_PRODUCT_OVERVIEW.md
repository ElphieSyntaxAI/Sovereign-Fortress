# MSGF Core Product — Capabilities, Use Cases & Marketing

**Status:** Living product reference (complements [`MSGF_V1_ROADMAP.md`](./MSGF_V1_ROADMAP.md) engineering SSOT).  
**Production:** https://elphiesgatedai.elphiesyntax.com  
**Last updated:** 2026-05-28

---

## 1. What MSGF is

**MSGF (Modular State-Gate Framework)** is a **stateful AI governance engine** for software teams. It watches how code and logic change (Pulse), ingests project structure into six isolated pillars (SWEEP), defends against bad deltas before they spread (Shadow / CROSS-REF), escalates only when drift is high (Small Brain vs Big Brain CONVERGE), and remembers what worked (Vault) vs what failed (Hall).

MSGF ships as:

| Mode | Who | How |
| :--- | :--- | :--- |
| **Standalone SaaS** | Buyers & indie devs | Sign up at Gated AI, dashboard, IDE extension |
| **Embedded engine** | Author, Education, custom BFFs | HTTP APIs + tenant keys / licenses |
| **BYOK / Solo** | Integrators | `msgf_live_*` license, local Redis + Supabase optional |

---

## 2. Core platform capabilities

### 2.1 V3.2-ULTRA pipeline (cloud)

| Step | Product name | What the user gets |
| :--- | :--- | :--- |
| **SWEEP** | Structural ingest | Day-zero scan; files mapped to P1–P6; genealogical **1.1.1** bug index |
| **SHARD** | Hot + cold storage | Redis active slices + Postgres/pgvector archive |
| **DEFEND** | Shadow mode | Silent pre-flight; blocks P1/P6 violations before injection |
| **CROSS-REF** | Vault / Hall check | Proposed changes compared to positive fixes and negative patterns |
| **CONVERGE** | Dual-model consensus | Gemini + Claude on high drift (Big Brain path) |
| **ARBITRATE** | Human tie-breaker | Operator approval when models disagree or retries exhaust |
| **PERSIST** | Learning loop | Approved deltas → Vault; failures → Hall (30d LOW purge) |

### 2.2 Primary APIs

| API | Purpose |
| :--- | :--- |
| `POST /api/msgf/pulse` | Keystroke / logic deltas; routing to local gateway or global CONVERGE |
| `POST /api/msgf/ingest` | Multi-file SWEEP ingest into tenant silo |
| `GET/POST /api/msgf/heal-queue` | Post-ingest remediation — BULK, INDIVIDUAL, SCHEDULED |
| `POST /api/msgf/heal-queue/human-arbitration` | Operator APPROVE_BYPASS / DENY_PURGE |
| `POST /api/msgf/dev-event` | IDE build failure — **Heal Cheap** (vault-first, no biometric Pulse) |
| `POST /api/msgf/verify-result` | Safe Build / Run Scripts pass-fail audit → Vault/Hall ledger |
| `POST /api/msgf/prompt-optimizer` | **0-token** structured prompt (no LLM on server) |
| `POST /api/msgf/confirm-pack` | Confirm pack used → defensible context savings |
| `GET /api/msgf/agent-context` | Guided context pack download |
| `GET /api/msgf/dashboard/savings-features` | 24h token savings counters + catalog |
| `POST /api/msgf/report-issue` | Authenticated incident report (web Bug Reporter) |
| `POST /api/msgf/ops/v32-heartbeat` | Tier batches, scheduled heals, Hall purge |

### 2.3 Small Brain vs Big Brain

| Tier | Runs where | Typical triggers | User sees |
| :--- | :--- | :--- | :--- |
| **Small Brain** | Tenant silo | Low drift Pulse, dev-session, dev-event, cache replay, verify loop | Dashboard token savings, local heals |
| **Big Brain** | Platform | High drift CONVERGE, global DNA promotion | Admin queue `#big-brain-issues` |

IDE **dev-event** and **dev-session** never invoke the full biometric Pulse → CONVERGE chain.

---

## 3. IDE extension — MSGF Pulse Guard (`msgf-pulse-guard`)

**Current:** v0.1.8 · VS Code / Cursor compatible

### 3.1 Command Center (sidebar)

| Feature | User action | Cloud effect |
| :--- | :--- | :--- |
| **Connection** | Auto health probe | Validates API + `msgf_ide_*` token |
| **Prompt optimizer** | Describe task → Generate 0-Token Prompt | `POST prompt-optimizer`; registers verify scripts |
| **Run Scripts** | Run latest or per-script | Allowlisted `execFile` (no shell); syncs `verify-result` / `dev-event` |
| **Safe Build** | Run MSGF Safe Build | Local build/test → pass=`verify-result`, fail=`dev-event` |
| **Shadow scan** | Policy scan | Opens healing console when issues found |
| **Advanced** | Flush Pulse, heal queue, context pack | Existing P1–P4 IDE flows |

### 3.2 Local artifacts (`.msgf/`)

| File | Role |
| :--- | :--- |
| `run-scripts.json` | Optimizer-registered verify commands (max 12, allowlist-validated) |
| `verify-feature.sh` / `.ps1` | Shell/PowerShell runners for CI or manual |
| `keys/` | BYOK model keys (optional) |

### 3.3 Security (1.0 hardening)

- **IDE bearer** (`msgf_ide_*`) required on `dev-event`, `verify-result`, `report-issue`
- **Allowlisted verify commands** only (`npm test`, `npm run build`, `bundle exec rails test`, optional file path)
- **No shell** for Run Scripts / Safe Build (`execFile` with fixed argv)
- **Webview XSS** — escaped labels/commands in Run Scripts list
- **Terminal snippets redacted** before cloud upload (tokens, secrets)

### 3.4 Agent handoff

Optimizer output includes **MANDATORY AGENT EXECUTION RULES**: attach `@` files, extend existing tests, run verify command, output pass/fail table.

---

## 4. Web surfaces

| Surface | URL | Audience |
| :--- | :--- | :--- |
| Marketing | `/`, `/features`, `/pricing` | Prospects |
| Workspace | `/dashboard`, `#token-savings` | Tenants |
| IDE setup | `/workspace#ide-setup`, `/setup/projects` | Developers |
| Admin ops | `/admin/dashboard`, `#big-brain-issues` | GLOBAL/COMPANY admins |
| Extension download | `/extension` or docs link | IDE users |

---

## 5. Token savings dashboard

24h Redis counters on `/dashboard#token-savings`:

| Metric | Meaning |
| :--- | :--- |
| CONVERGE cache hits | Replay prior Big Brain verdict |
| IDE dev-events | Heal Cheap build failures |
| **Verify passes** | Safe Build / Run Scripts success |
| **Verify failures** | Failed verify (Hall after 3× same pattern) |
| **Run Scripts reruns** | Re-test without regenerating prompt |
| **0-Token prompts** | Prompt optimizer + agent-context |
| Pulse idempotency / ingest hash / credit reserve | Efficiency modules |

**Defensible ROI** block combines confirm-pack savings + verify→Vault + Run Scripts re-prompt avoidance.

---

## 6. Use case scenarios

### 6.1 Solo indie developer (Rails / Next monorepo)

**Scenario:** Shipping a feature branch with Cursor; wants guardrails without pasting the whole repo.

**Flow:** Map project at `/setup/projects` → generate 0-token prompt → agent implements → **Run Scripts** runs `bundle exec rails test` → pass syncs to savings dashboard → optional **Confirm Pack Used**.

**Value:** Small Brain stays local; no Big Brain spend unless drift spikes.

### 6.2 Agency / consultant on client code

**Scenario:** Short engagement on `deck_host`-style Rails app; must not leak secrets or run arbitrary shell.

**Flow:** Tenant key per client → Safe Build on CI-like command → failures trigger **dev-event** Heal Cheap (vault match) not full CONVERGE.

**Value:** Auditable verify loop; hardened command allowlist.

### 6.3 Startup eng team (5–20 devs)

**Scenario:** Shared tenant; mix of IDE and dashboard; occasional RED incidents.

**Flow:** Team workspace → ingest on release branch → heal-queue BULK → operator handles `#big-brain-issues` when circuit opens.

**Value:** Multi-tenant silo + admin arbitration; token savings visible per tenant.

### 6.4 Platform integrator (BYOK SaaS)

**Scenario:** Your product embeds MSGF via `msgf_live_*` license; your UX, MSGF brain.

**Flow:** `bootstrap:solo` → Pulse from your BFF → ingest on repo connect → your UI calls `verify-result` after CI.

**Value:** Engine without building consensus stack; documented in [`MSGF_SOLO_INTEGRATION.md`](./MSGF_SOLO_INTEGRATION.md).

### 6.5 Author Ecosystem author

**Scenario:** Manuscript + HAL rhythm; MSGF for typing governance not writing voice.

**Flow:** Author BFF `chunk-pulse` → MSGF Pulse → token savings on `author_ecosystem` tenant.

**Value:** HAL bridge + Author-specific sauce stays in Author app.

### 6.6 DevOps / release manager

**Scenario:** Wants proof verify ran before merge without re-prompting agents.

**Flow:** Optimizer registers scripts → developers use Run Scripts → `verify-result` narrative logs + Vault on green + pack.

**Value:** Flight recorder in P4 narrative logs; Hall only on repeated failures (noise control).

### 6.7 Security-conscious enterprise pilot

**Scenario:** Cannot send shell output with secrets to cloud.

**Flow:** Redacted snippets; auth on all IDE POSTs; no `report-issue` from extension for builds (uses dev-event / verify-result).

**Value:** Defense in depth vs tampered `.msgf/run-scripts.json`.

### 6.8 MSGF operator / founder

**Scenario:** Monitor whether Small Brain is winning vs Big Brain spend.

**Flow:** Admin `#token-savings` full catalog + `#big-brain-issues` queue.

**Value:** Unit economics before Stripe go-live.

---

## 7. Marketing by audience

| Audience | Headline angle | Proof points | CTA |
| :--- | :--- | :--- | :--- |
| **Indie dev** | "Stop paying to re-paste your repo into Cursor" | 0-token prompt, Run Scripts, BYOK tier | Download extension |
| **Tech lead** | "Governance without slowing the team" | Small Brain %, verify loop, heal queue | Team tier / demo |
| **CTO / security** | "Glass-box AI with allowlisted execution" | Shadow DEFEND, no shell exec, auth | Pilot / security brief |
| **Integrator** | "Drop in the consensus brain via API" | Pulse, ingest, solo license, HAL bridge | `MSGF_SOLO_INTEGRATION` |
| **Author / creator** | "Protect craft; MSGF handles logic drift" | HAL sync, gatedai dashboard link | Author + MSGF bundle |
| **Agency** | "Per-client tenant silos + savings proof" | Token savings ROI, monorepo presets | Startup tier |
| **AI-forward startup** | "Dual-model when it matters, cheap when it doesn't" | CONVERGE cache, dev-event Heal Cheap | Pro license $99 |
| **Education** | "Policy-isolated tenant for classroom" | Separate tenant smoke (roadmap) | Contact / waitlist |

### Channel ideas

| Channel | Message |
| :--- | :--- |
| **Dev Twitter / LinkedIn** | Short clip: Generate prompt → Run Scripts → savings counter ticks |
| **Cursor marketplace** | "MSGF Pulse Guard — 0-token prompts + safe verify" |
| **Conference talk** | "Vault vs Hall: differential learning for AI coding assistants" |
| **Case study (deck_host)** | Rails team: optimizer + `bundle exec rails test` loop |
| **Comparison SEO** | "Cursor rules vs stateful governance" — six pillars, not flat rules files |

---

## 8. Related docs

| Doc | Focus |
| :--- | :--- |
| [`MSGF_V1_ROADMAP.md`](./MSGF_V1_ROADMAP.md) | Engineering milestones & readiness |
| [`MSGF_BRAIN_ROUTING.md`](./MSGF_BRAIN_ROUTING.md) | Small/Big Brain routing |
| [`MSGF_IDE_INTEGRATION.md`](./MSGF_IDE_INTEGRATION.md) | IDE layer index |
| [`MSGF_SOLO_INTEGRATION.md`](./MSGF_SOLO_INTEGRATION.md) | BYOK integrators |
| [`MSGF_TESTING.md`](./MSGF_TESTING.md) | Test & deploy runbooks |
| [`MSGF_LEARNING_AND_BIG_BRAIN.md`](./MSGF_LEARNING_AND_BIG_BRAIN.md) | Why zero Big Brain is often success; how to smoke-test CONVERGE |
| [`packages/msgf/README.md`](../packages/msgf/README.md) | Env vars & npm scripts |
