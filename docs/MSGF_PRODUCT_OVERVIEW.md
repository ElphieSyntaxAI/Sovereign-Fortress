# MSGF Core Product — Capabilities, Use Cases & Marketing

**Status:** Living product reference (complements [`MSGF_V1_ROADMAP.md`](./MSGF_V1_ROADMAP.md) engineering SSOT).  
**Production:** https://elphiesgatedai.elphiesyntax.com  
**Last updated:** 2026-08-06 (Shadow Proxy + Active Governance + launch hardening)

**Product map (UI):** `/features` + `packages/msgf/app/_components/marketing/shipped-capabilities.ts`  
**RC / deploy:** [`MSGF_RC_CHECKLIST.md`](./MSGF_RC_CHECKLIST.md) · [`MSGF_DEPLOY_CHECKLIST.md`](./MSGF_DEPLOY_CHECKLIST.md) · [`MSGF_DEV_TODO.md`](./MSGF_DEV_TODO.md)  
**Provider gateway:** [`MSGF_SHADOW_PROXY.md`](./MSGF_SHADOW_PROXY.md)

### Launch readiness (2026-08-06)

| Gate | ~% | What “100%” means |
| :--- | :---: | :--- |
| **Technical soft-RC** (`msgf-v1.0.0` with mock entitlements OK) | **~84%** | Green `validate:deployment` + staging smoke + Cloud Run secrets + `db:push` for usage/shadow/governance migrations |
| **Paid self-serve launch** | **~68%** | Soft-RC + Stripe Checkout smoke + identity + live keys + mock off |

Largest remaining gap: **verification and secrets**, not feature code. Gateway auth, Active Orchestrator, and dashboard IDOR guards are **code-complete** (2026-08-06). Full bucket table: [`MSGF_V1_ROADMAP.md`](./MSGF_V1_ROADMAP.md) §10.

---

## 1. What MSGF is

**MSGF (Modular State-Gate Framework)** is a **stateful AI governance engine** for software teams. It watches how code and logic change (Pulse), ingests project structure into six isolated pillars (SWEEP), defends against bad deltas before they spread (DEFEND preflight / CROSS-REF), escalates only when drift is high (Small Brain vs Big Brain CONVERGE), can sit in front of OpenAI/Anthropic SDKs as a Shadow Proxy or Active Governance gateway, quarantines poisoned wins when Apex models still disagree, and remembers what worked (Vault) vs what failed (Hall).

MSGF ships as:

| Mode | Who | How |
| :--- | :--- | :--- |
| **Standalone SaaS** | Buyers & indie / team leads | Sign up at Gated AI, dashboard, IDE extension |
| **Embedded engine** | Author, Education, custom BFFs | HTTP APIs + tenant keys / licenses |
| **BYOK / Solo** | Integrators | `msgf_live_*` license, Redis + Supabase |

**One-line sales pitch:** *Point your OpenAI/Anthropic SDK at MSGF to prove projected bill savings in Shadow mode — then flip Active Governance so Small Brain, cache, and state-gating cut spend before TRI consensus is ever needed.*

### Naming note — three different “shadow” words

| Term | Meaning | Do not confuse with |
| :--- | :--- | :--- |
| **DEFEND preflight** | Vault/Hall safety gate before Pulse / ingest | Gateway Shadow Proxy |
| **Passive IDE Scan** | Background IDE policy/shard scan (`.msgf/shadow-scan/`) | Gateway Shadow Proxy |
| **Shadow Proxy** | `/api/v1` pass-through + **projected** savings (`x-msgf-mode: shadow`) | DEFEND / Passive IDE Scan |

---

## 2. Product map (shipped surfaces)

```text
Marketing (/ · /features · /pricing)
        ↓
Workspace (/workspace · /setup/projects · team · IDE tokens)
        ↓
Dashboard (#token-savings · Reports · heal · security · Shadow Proxy panel)
        ↓
Provider gateway (/api/v1 — Shadow Proxy · Active Governance)
        ↓
Pulse Guard IDE (Command Center · Safe Build · Passive IDE Scan)
        ↓
Ops (/admin/ops — ARBITRATE · quarantine · audits · Sentry · signing)
        ↓
Deploy gate (GET /api/msgf/deploy-gate · project_origin green)
```

| Layer | Customer-facing | Operator-facing |
| :--- | :--- | :--- |
| **Connect** | Map projects, IDE token, GitHub picker | Portal launch matrix |
| **Prove** | Shadow Proxy: SDK `baseURL` → projected $ without latency | Shadow Eval ledger + Reports PDF |
| **Optimize** | Active Governance: cache + state-gate + sharded upstream | Proven avoidance + period history |
| **Govern** | Pulse, ingest, DEFEND RED short-circuit | Compound tenant isolation (`project_origin` + `subpath_hash`) |
| **Verify** | Safe Build / Run Scripts → Vault/Hall | Skip-MSGF signed audit (A5) |
| **Escalate** | Small Brain → CONVERGE tiers T1–T3 | ARBITRATE HITL + signed audit chain (A6) |
| **Contain** | Quarantined wins excluded from retrieval | Vault quarantine panel (Sentry + T3) |
| **Secure** | Hybrid PQ envelopes for vault secrets; gateway key never trusts spoofed tenant | CryptoService `0x03` + HAL v2 ML-DSA when enabled |
| **Ship** | Deploy-gate green for `project_origin` | Heartbeat / archive / webhook workers |

---

## 3. Core platform capabilities

### 3.1 V3.2-ULTRA pipeline (cloud)

| Step | Product name | What the user gets |
| :--- | :--- | :--- |
| **SWEEP** | Structural ingest | Day-zero scan; files → P1–P6; genealogical **1.1.1** bug index |
| **SHARD** | Hot + cold storage | Redis active slices (hot-primary reads + ns gate stamp) + Postgres/pgvector |
| **DEFEND** | Preflight guard | Silent Vault/Hall pre-flight (`runDefendPreflight`); blocks P1/P6 violations before injection |
| **CROSS-REF** | Vault / Hall check | Proposed changes vs positive fixes and negative patterns (quarantine-aware) |
| **CONVERGE** | Dual / TRI consensus | Tenant dual presets; Big Brain **TRI majority** (Claude+Gemini+Grok) when enabled; optional **3-tier** cost ladder (T1→T3) |
| **ARBITRATE** | Human tie-breaker | Operator approval; **HMAC-signed hash-chained** audit snapshots |
| **PERSIST** | Learning loop | Approved → Vault; failures / T3 quarantine → Hall path + HITL |

### 3.2 Primary APIs

| API | Purpose |
| :--- | :--- |
| `POST /api/msgf/pulse` | Keystroke / logic deltas; local gateway or global CONVERGE; optional `x-msgf-converge-tier` |
| `POST /api/msgf/ingest` | Multi-file SWEEP ingest into tenant silo |
| `GET/POST /api/msgf/heal-queue` | Post-ingest remediation — BULK, INDIVIDUAL, SCHEDULED |
| `POST /api/msgf/heal-queue/human-arbitration` | Operator APPROVE_BYPASS / DENY_PURGE (+ A6 audit) |
| `POST /api/msgf/dev-event` | IDE build failure — **Heal Cheap** (vault-first, no biometric Pulse) |
| `POST /api/msgf/verify-result` | Safe Build / Run Scripts pass-fail → Vault/Hall |
| `GET /api/msgf/deploy-gate` | CI/CD gate: verify green for `project_origin` |
| `POST /api/msgf/prompt-optimizer` | **0-token** structured prompt (no LLM on server) |
| `POST /api/msgf/confirm-pack` | Confirm pack used → defensible context savings |
| `GET /api/msgf/agent-context` | Guided context pack download |
| `GET /api/msgf/dashboard/savings-features` | 24h token savings counters + catalog |
| `GET /api/msgf/dashboard/period-reports` | Weekly / monthly metered consumption vs proven savings (+ PDF) |
| `GET /api/msgf/dashboard/shadow-eval` | 24h Shadow Proxy projected savings summary |
| `POST /api/v1/chat/completions` | OpenAI-compatible **Shadow Proxy / Active Governance** gateway |
| `POST /api/v1/messages` | Anthropic-compatible gateway (SDK `baseURL` → `/api`) |
| `POST /api/msgf/report-issue` | Authenticated incident report (web Bug Reporter) |
| `POST /api/msgf/p4/state-ledger` | Education / P4 telemetry + hot-layer latency fields |
| `POST /api/msgf/ops/v32-heartbeat` | Tier batches, scheduled heals, Hall purge |
| `GET/POST /api/msgf/workspace/tier-rules` | Company path → CONVERGE tier overrides (COMPANY_ADMIN) |
| `GET /api/msgf/admin/vault-quarantine` | Ops quarantine queue (Sentry + T3) |
| Signing / SSO / Sentry / archive webhooks | See [`MSGF_SIGNING.md`](./MSGF_SIGNING.md), [`MSGF_SENTRY.md`](./MSGF_SENTRY.md), [`MSGF_GOOGLE_WORKSPACE_SSO.md`](./MSGF_GOOGLE_WORKSPACE_SSO.md) |

### 3.3 Small Brain vs Big Brain

| Tier | Runs where | Typical triggers | User sees |
| :--- | :--- | :--- | :--- |
| **Small Brain** | Tenant silo | Low drift Pulse, dual presets (default Claude+Gemini UNANIMOUS), SOLO_FAST prompt optimize, cache replay, verify loop | Dashboard `#token-savings` preset picker |
| **Big Brain** | Platform | High drift CONVERGE — **TRI majority** (Claude+Gemini+Grok) when `MSGF_TRI_CONSENSUS_ENABLED=1`; human notify if drift ≥ **0.45** or no majority / NON_HUMAN / T3 quarantine | Admin `#big-brain-issues`, `/admin/ops` |

IDE **dev-event** and **dev-session** never invoke the full biometric Pulse → CONVERGE chain.

Tenant presets: `balanced_dual` · `bias_mitigated_dual` (Claude+Grok) · `gemini_grok_dual` · `tri_tribunal` (premium) · `custom_byok`. API: `GET/PUT /api/msgf/tenant/consensus-config`.

### 3.4 Part B — 3-tier dual CONVERGE (flagged)

| Tier | Default pair | When |
| :--- | :--- | :--- |
| **T1** | GPT-4o-mini + Claude Haiku | Docs, CSS, small low-risk diffs |
| **T2** | Sonnet + GPT-4o | Feature / mid-size paths |
| **T3** | Apex pair | Auth, security, payment, schema — or escalated disagreement |

Enable: `MSGF_CONVERGE_TIER_ENABLED=1`. Docs: [`MSGF_CONVERGE_TIER.md`](./MSGF_CONVERGE_TIER.md).

**T3 disagree:** matching Vault wins → `QUARANTINED` (ops HITL restore/demote); Pulse Hall + circuit — **never auto-Hall demote**.

### 3.5 Hot layer (shipped)

- `readActiveSliceFast` — Redis read with `readLatencyNs`
- `validateP4GateFast` — gate validation stamp
- `MSGF_HOT_LAYER_PRIMARY=1` (default) — skip cold Postgres beat fetch on hot hit
- P4 responses expose `hot_layer_read_latency_ns` / `gate_validation_latency_ns`

Full nanosecond SLO claim remains a **1.1** marketing bar; infra is wired for RC.

### 3.6 Provider gateway — Shadow Proxy & Active Governance (shipped)

Point OpenAI or Anthropic SDKs at MSGF without rewriting app code. Full integrator guide: [`MSGF_SHADOW_PROXY.md`](./MSGF_SHADOW_PROXY.md).

| Mode | Header | What happens | Buyer value |
| :--- | :--- | :--- | :--- |
| **Shadow** (default) | `x-msgf-mode: shadow` or omitted | Zero-latency pass-through to the vendor; async **Shadow Eval** projects what Active would have saved | Prove ROI before changing behavior |
| **Active** | `x-msgf-mode: active` | **PromptIR** → hash completion cache → state-gate prune → drift label → sharded single-model upstream | Live token cuts; **proven** avoidance when optimizations fire |

**Auth (hardened):** `x-msgf-key` must be `msgf_live_*` / `msgf_test_*` / `msgf_ide_*`. Tenant is forced from the license / IDE token DB record — **never** from client `x-msgf-tenant-id`. Upstream headers are allowlisted (Cookie never forwarded).

**Active aggressiveness** (`MSGF_ACTIVE_AGGRESSIVENESS` or `x-msgf-active-aggressiveness`): `cache-only` · `shard-and-route` (default) · `full-consensus`. Kill-switch: `passthrough_fallback` (default on).

**Response audit headers:** `x-msgf-routing`, `x-msgf-tokens-saved`, `x-msgf-cache-hit`.

**Honesty rule:** Shadow projected $ ≠ proven eco. Public eco / Sustainable Compute only moves on proven avoidance and audited pack deltas (`MSGF_ECO_PROVEN_ONLY` default on).

---

## 4. Integrations & enterprise glue (shipped code)

| ID | Capability | Buyer value |
| :--- | :--- | :--- |
| **I1** | Company domains + signing provider | Corporate email gates; DocuSign / Dropbox Sign |
| **I2–I3** | Sentry → Vault quarantine + ops HITL | Crash-linked wins pulled from positive context |
| **I4** | Dropbox archive worker | Signed artifacts archived off-platform |
| **I5** | Webhook inbox + queue | Idempotent signing / Sentry / archive webhooks |
| **I6** | Team readiness + deploy gate | “Ready to ship?” checklist per `project_origin` |
| **A4** | Compound tenant isolation | Vector scope = origin + subpath — no cross-project bleed |
| **A5** | Async Safe Build + skip-MSGF audit | IDE stays fast; signed skip trail |
| **A6** | Signed ARBITRATE audit chain | Defensible HITL for compliance conversations |
| **SSO** | Google Workspace circuit | Enterprise login without consumer Gmail sprawl |

---

## 5. IDE extension — MSGF Pulse Guard (`msgf-pulse-guard`)

**Current:** v0.2.3 · VS Code / Cursor compatible

**Opt-in by default:** `msgf.enabled` is `false` until the developer turns it on for that workspace — MSGF does not scaffold `.msgf/`, buffer Pulses, or call the API in a client repo you haven't approved. This is the answer to "what does it do to my code before I trust it?"

### 5.1 Command Center (sidebar)

| Feature | User action | Cloud effect |
| :--- | :--- | :--- |
| **Connection** | Auto health probe | Validates API + `msgf_ide_*` token |
| **Prompt optimizer** | Describe task → Generate 0-Token Prompt | `POST prompt-optimizer`; registers verify scripts |
| **Run Scripts** | Run latest or per-script | Allowlisted `execFile` (no shell); syncs `verify-result` / `dev-event` |
| **Safe Build** | Run MSGF Safe Build | Local build/test → pass=`verify-result`, fail=`dev-event`; async preflight default |
| **Shadow scan** | Passive IDE Scan (policy / shards) | Opens healing console when issues found |
| **Advanced** | Flush Pulse, heal queue, context pack | Existing P1–P4 IDE flows |
| **Setup wizard** | MSGF: Run setup wizard | Guided token + tenant key + connectivity check |
| **Monorepo product** | MSGF: Configure monorepo product | `msgf.productPath` scopes Passive IDE Scan and `.msgf/` to one app in the repo |
| **Developer kit** | MSGF: Open / Sync developer kit | Scaffolds `.msgf/dev/` — API cookbook, sample requests, connection scripts, VS Code tasks |

### 5.1a Integrator developer kit (`.msgf/dev/`) — new in 0.2.x

Every activated workspace gets a **self-serve integration folder**: `api-cookbook.md`, `env.example.json`, sample request bodies, `test-connection.ps1` / `.sh`, and `smoke-integrator.mjs`. Sales value: an integrator can prove the API works from their own terminal in minutes without a support call. Docs: [`MSGF_INTEGRATOR_DEV_KIT.md`](./MSGF_INTEGRATOR_DEV_KIT.md).

### 5.1b BYOK Small Brain (IDE-side)

`msgf.smallBrainProvider` supports **OpenAI, Anthropic, Ollama, DeepSeek, Gemini** with the customer's own key (`msgf.smallBrainApiKey`, application-scoped, sent as `x-msgf-small-brain-api-key`). Pitch: *your key and your model for the cheap routine path; our brain only when consensus is needed.*

**Accuracy note for sales:** BYOK means the customer's model account does the work — it does **not** mean the Pulse skips the MSGF API. The air-gapped story is the self-hosted Indie tier (customer's own Redis + Supabase), not BYOK.

### 5.2 Local artifacts (`.msgf/`)

| File | Role |
| :--- | :--- |
| `run-scripts.json` | Optimizer-registered verify commands (max 12, allowlist-validated) |
| `verify-feature.sh` / `.ps1` | Shell/PowerShell runners for CI or manual |
| `keys/` | BYOK model keys (optional) |

### 5.3 Security (1.0 hardening)

- **IDE bearer** (`msgf_ide_*`) required on `dev-event`, `verify-result`, `report-issue`
- **Allowlisted verify commands** only
- **No shell** for Run Scripts / Safe Build (`execFile`)
- **Webview XSS** — escaped labels/commands
- **Terminal snippets redacted** before cloud upload
- **Skip-MSGF** actions leave a signed audit (A5)
- **Quantum-ready (app layer):** hybrid KEM envelopes `0x03` (X25519 + ML-KEM-768) and optional HAL v2 ML-DSA-65 when `MSGF_HYBRID_KEM_ENABLED=1` — see [`MSGF_PQC_CRYPTO_AUDIT.md`](./MSGF_PQC_CRYPTO_AUDIT.md). Do **not** claim platform HTTPS is post-quantum until LB PQ-TLS is enabled.

### 5.4 Agent handoff

Optimizer output includes **MANDATORY AGENT EXECUTION RULES**: attach `@` files, extend existing tests, run verify command, output pass/fail table.

**Optional Cursor MCP** ([`MSGF_IDE_MCP.md`](./MSGF_IDE_MCP.md)) exposes `testConnection`, `getContextPack`, `startDevHealCycle`, and `submitVerifyResult` as agent tools. Treat as a **power-user extra, not a 1.0 promise** — it needs manual `.cursor/mcp.json` wiring.

---

## 6. Web surfaces

| Surface | URL | Audience |
| :--- | :--- | :--- |
| Marketing | `/`, `/features`, `/pricing` | Prospects |
| Workspace | `/dashboard`, `#token-savings`, Reports, `/workspace` | Tenants |
| IDE setup | `/workspace#ide-setup`, `/setup/projects` | Developers |
| Team | Workspace team + readiness | COMPANY_ADMIN |
| Admin ops | `/admin/ops`, `/admin/dashboard` | GLOBAL/COMPANY admins |
| Extension download | `/extension` | IDE users |
| Status | `/status` | Ops / prospects |

---

## 7. Token savings dashboard

Surfaces on `/dashboard#token-savings` and **Reports** (`/dashboard/daily-reports`):

| Metric | Meaning |
| :--- | :--- |
| **Metered provider tokens** | Real `response.usage` from MSGF-owned Claude / Gemini / xAI / gateway calls |
| **Proven tokens saved** | Avoided spend vs rolling metered CONVERGE baseline, pack deltas, or **Active** gateway optimizations — **only** these feed public eco |
| **Shadow projected $** | Simulated savings from Shadow Proxy pass-through traffic — **not** proven eco |
| Weekly / monthly history + PDF | Consumed vs saved (and Shadow projected column) for finance conversations |
| CONVERGE cache hits | Replay prior Big Brain verdict |
| IDE dev-events | Heal Cheap build failures |
| **Verify passes** | Safe Build / Run Scripts success |
| **Verify failures** | Failed verify (Hall after 3× same pattern) |
| **Run Scripts reruns** | Re-test without regenerating prompt |
| **0-Token prompts** | Prompt optimizer + agent-context |
| Pulse idempotency / ingest hash / credit reserve | Efficiency modules |
| Tier / quarantine telemetry | When Part B / T3 path fires |

**Defensible ROI** prefers metered spend when available. **Public eco** (`MSGF_ECO_PROVEN_ONLY`, default on) refuses estimated routing models — zeros beat fake “billions.”

Dashboard APIs that accept `tenant_id` enforce membership (or `GLOBAL_ADMIN`) — no cross-tenant IDOR via query params.

---

## 8. Use case scenarios

### 8.1 Solo indie developer (Rails / Next monorepo)

**Scenario:** Shipping a feature branch with Cursor; wants guardrails without pasting the whole repo.

**Flow:** Map project at `/setup/projects` → generate 0-token prompt → agent implements → **Run Scripts** → pass syncs to savings → optional **Confirm Pack Used**.

**Value:** Small Brain stays local; no Big Brain spend unless drift spikes.

### 8.2 Agency / consultant on client code

**Scenario:** Short engagement; must not leak secrets or run arbitrary shell.

**Flow:** Tenant key per client → Safe Build → failures trigger **dev-event** Heal Cheap.

**Value:** Auditable verify loop; allowlisted commands; per-client `project_origin` silos.

### 8.3 Startup eng team (5–20 devs)

**Scenario:** Shared company; mix of IDE and dashboard; occasional RED / T3 incidents.

**Flow:** Team workspace + domains → ingest → heal-queue → `/admin/ops` ARBITRATE + quarantine when Apex models disagree.

**Value:** Compound isolation + signed HITL audits for “who approved what.”

### 8.4 Platform integrator (BYOK SaaS)

**Scenario:** Embed MSGF via `msgf_live_*`; your UX, MSGF brain.

**Flow:** `bootstrap:solo` → Pulse from BFF → `verify-result` after CI → deploy-gate in ship pipeline. Optionally point OpenAI/Anthropic SDKs at `/api/v1` in **shadow** first, then **active**.

**Value:** Consensus stack without building it — [`MSGF_SOLO_INTEGRATION.md`](./MSGF_SOLO_INTEGRATION.md) · [`MSGF_SHADOW_PROXY.md`](./MSGF_SHADOW_PROXY.md).

### 8.4a SDK traffic without rewriting the agent

**Scenario:** App already calls OpenAI or Anthropic; finance wants proof of savings before cutting over.

**Flow:** Set `baseURL` + `x-msgf-key` → run in **shadow** → review Reports / Shadow Proxy panel → flip `x-msgf-mode: active` when projected ROI is credible.

**Value:** Zero-latency proof mode, then live state-gating / cache without changing prompts.

### 8.5 Security / compliance pilot

**Scenario:** Cannot send shell secrets; need quarantine + human trail.

**Flow:** Redacted snippets; Sentry→quarantine; T3 disagree quarantines Vault wins; A6 signed ARBITRATE chain.

**Value:** Glass-box governance story for security review.

### 8.6 DevOps / release manager

**Scenario:** Proof verify ran before merge.

**Flow:** Optimizer registers scripts → Run Scripts → `verify-result` → **deploy-gate** in CI.

**Value:** Flight recorder + ship gate on the same `project_origin`.

### 8.7 Author Ecosystem / Education

**Scenario:** HAL / classroom tenants call MSGF; product UX stays in those apps.

**Value:** Shared brain; product sauce stays out of MSGF marketing claims.

---

## 9. Sales angle by audience

| Audience | Headline | Proof points | CTA |
| :--- | :--- | :--- | :--- |
| **Indie / Cursor power user** | “Stop paying to re-paste your repo” | 0-token prompt, Run Scripts, Small Brain % | Download Pulse Guard |
| **Tech lead** | “Governance that doesn’t slow the sprint” | Verify loop, heal queue, deploy gate, Shadow→Active gateway | Team workspace / demo |
| **CTO / security** | “Glass-box AI with quarantine + signed HITL” | DEFEND preflight, allowlisted exec, A5/A6 audits, T3 quarantine, license-bound gateway auth | Pilot / security brief |
| **Agency** | “Per-client silos + savings you can invoice” | `project_origin` isolation, ROI rollup, period PDF | Startup / agency tier |
| **Integrator** | “Drop in the consensus brain — or just the SDK baseURL” | Pulse, ingest, solo license, `/api/v1` Shadow Proxy | `MSGF_SOLO_INTEGRATION` · `MSGF_SHADOW_PROXY` |
| **Ops / founder** | “See whether Small Brain is winning” | Admin savings catalog, Big Brain queue, Shadow projected vs proven | `/admin/ops` walkthrough |
| **Enterprise IT** | “Workspace SSO + signing + domains” | Google Workspace SSO, DocuSign/Dropbox Sign, company domains | Contact / enterprise path |

### 9.1 Packaging (live on `/pricing`)

Source of truth for the numbers below is `packages/msgf/app/_components/pricing/pricing-tiers.ts` — **quote from that file, not from memory.**

| Tier | Price | What it actually includes | Sales note |
| :--- | :--- | :--- | :--- |
| **Individual Indie (BYOK)** | **$0** forever | Full local six-pillar tracking + project isolation; customer supplies Redis + Supabase env and model keys in `.msgf/keys/` | Land-and-expand. No credit card, no cloud consensus. Say “free, you run the infra” — not “free trial.” |
| **Individual Pro (perpetual)** | **$99** one-time | Own it forever; Year 1 managed cloud consensus (**1,200 verification slices / month**); zero config on our infra; graceful fallback to 100% BYOK after Year 1 | The differentiator vs subscriptions. Be precise: the fallback is BYOK, not a shutoff. |
| **Startup Team** | **$49** / user / mo | Multi-tenant corporate workspace scopes, global ARBITRATE consoles, company-wide P1 rulebooks, shared incident logs | Where signing, domains, SSO, and ops consoles earn their keep. |

**Checkout status:** Stripe is **in plan (M3)**. Skeleton Checkout + Pro perpetual webhook exist; Startup Team entitlement + subscription lifecycle + mock-off flip are still open ([`MSGF_DEV_TODO.md`](./MSGF_DEV_TODO.md) §2b). Until that checklist is green, route paid interest carefully — do not promise self-serve card success on a call.

### Objection handling (sales)

| Objection | Answer |
| :--- | :--- |
| “Another AI wrapper” | Six-pillar cold archive + Vault/Hall learning + dual-model only on drift — not a chat UI. |
| “Too expensive” | Small Brain + cache + Heal Cheap are the default; CONVERGE is the exception. Show token-savings + Shadow projected vs proven Reports. |
| “Will it block my team?” | DEFEND can short-circuit unsafe deltas; Safe Build is local; skip path is audited (A5); HITL is ops, not every commit. Shadow Proxy adds zero latency until you flip Active. |
| “Trust / compliance?” | Signed skip + ARBITRATE audits; quarantine without auto-demote; tenant compound scope; gateway never trusts spoofed tenant headers. Author Chain of Origin exports can use **ML-DSA-65** signatures (algorithm per FIPS 204) — not a claim that HTTPS itself is post-quantum; see [`MSGF_PQC_CRYPTO_AUDIT.md`](./MSGF_PQC_CRYPTO_AUDIT.md). |
| “We already have Sentry” | MSGF links crashes to **governance memory** (Vault wins) — Sentry owns runtime; MSGF owns what the AI should remember. |
| “We can’t send code to your models” | Two separate answers — don’t blur them. **BYOK:** the Small Brain runs on the customer’s provider and key (OpenAI / Anthropic / Ollama / DeepSeek / Gemini); we never bill or read their model account. **Self-hosted:** the Indie tier runs against the customer’s own Redis + Supabase. Note that BYOK alone still routes the Pulse through the MSGF API — only the self-hosted path keeps data off our infrastructure. |
| “How hard is integration?” | Two paths: (1) Pulse Guard scaffolds `.msgf/dev/` with an API cookbook; (2) change OpenAI/Anthropic `baseURL` to MSGF Shadow Proxy — prove savings before Active. |
| “What if we stop paying?” | Pro is a perpetual license: after Year 1 it degrades to BYOK, it does not brick. |
| “Are projected savings real bills?” | Shadow $ is a **projection**. Active mode + Pulse proven avoidance move the **proven** ledger and public eco. Never merge them in a customer slide. |

### Channel ideas

| Channel | Message |
| :--- | :--- |
| **Dev Twitter / LinkedIn** | Clip: Generate prompt → Safe Build → savings counter + deploy-gate green · or Shadow Proxy baseURL swap |
| **Cursor marketplace** | “Pulse Guard — 0-token prompts + safe verify + async preflight” |
| **Conference / podcast** | “Vault vs Hall + T3 quarantine: differential learning for AI coding” |
| **Case study** | Rails / Next team: optimizer + allowlisted test loop + ROI panel · or SDK gateway projected→proven |
| **Comparison SEO** | “Cursor rules vs stateful governance” — pillars, not flat rules files |
| **Integrator SEO** | “OpenAI baseURL proxy that saves tokens” — Shadow vs Active honesty |

---

## 10. What is *not* required for MSGF 1.0 RC sales claims

| Do not promise yet | Track |
| :--- | :--- |
| Self-serve Stripe Checkout as production-ready | **In plan (M3 / P0-M3)** — finish DEV_TODO §2b before claiming it |
| Nanosecond hot-layer SLO as a hard SLA | 1.1 polish (infra wired) |
| Cursor MCP as a supported install | Optional power-user path — needs manual `.cursor/mcp.json` ([`MSGF_IDE_MCP.md`](./MSGF_IDE_MCP.md)) |
| Embedding semantic similarity cache on `/api/v1` | Launch Active uses **prompt-hash** cache; true semantic similarity is post-1.0 |
| Dual/TRI chat wire synthesis on every Active escalate | Launch labels high drift; Pulse dual remains pulse-shaped |
| Boss-demo layered theater silos | Parked — [`MSGF_BOSS_DEMO_RUNBOOK.md`](./MSGF_BOSS_DEMO_RUNBOOK.md) |
| Author / Education product completion | Separate roadmaps |
| Shadow projected $ as public eco / utility bills | Projected ≠ proven — keep separate in every deck |

**Configured vs shipped.** Several capabilities in §4 are code-complete but only work once **that tenant's credentials are set** — Sentry (`SENTRY_AUTH_TOKEN` + org slug), DocuSign / Dropbox Sign, Dropbox archive, GitHub picker (OAuth app + key encryption), Google Workspace SSO, and Part B tiers (`MSGF_CONVERGE_TIER_ENABLED=1`). Unconfigured panels degrade to *unconfigured* rather than breaking, which is a good demo story — but demo the surface you have actually configured. Engineering status per surface: [`MSGF_V1_ROADMAP.md`](./MSGF_V1_ROADMAP.md) §5 (M7) and [`MSGF_DEV_TODO.md`](./MSGF_DEV_TODO.md).

---

## 11. Related docs

| Doc | Focus |
| :--- | :--- |
| [`MSGF_V1_ROADMAP.md`](./MSGF_V1_ROADMAP.md) | Engineering milestones & readiness |
| [`MSGF_CONVERGE_TIER.md`](./MSGF_CONVERGE_TIER.md) | Part B tiers + T3 quarantine |
| [`MSGF_TENANT_ISOLATION.md`](./MSGF_TENANT_ISOLATION.md) | A4 compound scope |
| [`MSGF_ASYNC_PREFLIGHT.md`](./MSGF_ASYNC_PREFLIGHT.md) | A5 async Safe Build |
| [`MSGF_ARBITRATE_AUDIT.md`](./MSGF_ARBITRATE_AUDIT.md) | A6 signed HITL |
| [`MSGF_ADMIN_HUB.md`](./MSGF_ADMIN_HUB.md) | Ops console map |
| [`MSGF_BRAIN_ROUTING.md`](./MSGF_BRAIN_ROUTING.md) | Small/Big Brain routing |
| [`MSGF_IDE_INTEGRATION.md`](./MSGF_IDE_INTEGRATION.md) | IDE layer index |
| [`MSGF_INTEGRATOR_DEV_KIT.md`](./MSGF_INTEGRATOR_DEV_KIT.md) | `.msgf/dev/` kit shipped with the extension |
| [`MSGF_IDE_MCP.md`](./MSGF_IDE_MCP.md) | Optional Cursor MCP tools |
| [`MSGF_GITHUB_PROJECTS.md`](./MSGF_GITHUB_PROJECTS.md) | GitHub multi-repo picker setup |
| [`MSGF_SENTRY.md`](./MSGF_SENTRY.md) | Sentry ops panel + quarantine |
| [`MSGF_SIGNING.md`](./MSGF_SIGNING.md) | DocuSign / Dropbox Sign + archive |
| [`MSGF_SOLO_INTEGRATION.md`](./MSGF_SOLO_INTEGRATION.md) | BYOK integrators |
| [`MSGF_SHADOW_PROXY.md`](./MSGF_SHADOW_PROXY.md) | Shadow Proxy + Active Governance gateway |
| [`MSGF_BUYER_WALKTHROUGH.md`](./MSGF_BUYER_WALKTHROUGH.md) | SaaS buyer journey |
| [`MSGF_TESTING.md`](./MSGF_TESTING.md) | Test & deploy runbooks |
| [`MONOREPO_PRODUCTS.md`](./MONOREPO_PRODUCTS.md) | Three products & domains |
| [`packages/msgf/README.md`](../packages/msgf/README.md) | Env vars & npm scripts |

---

## Changelog

| Date | Note |
| :--- | :--- |
| 2026-08-06 | **Launch hardening:** §3.6 Shadow Proxy / Active Governance; naming glossary (DEFEND vs Passive IDE Scan vs Shadow Proxy); period reports + proven honesty; sales/SDK use case; marketing sync. |
| 2026-08-02 | Stripe M3 moved **into plan** (not deferred): §9.1 checkout status + §10 claim-safety updated; pointer to DEV_TODO §2b. |
| 2026-08-01 | Pulse Guard **0.1.8 → 0.2.3**: opt-in default, setup wizard, monorepo product scoping, `.msgf/dev/` integrator kit (§5.1a), BYOK Small Brain providers (§5.1b), optional MCP (§5.4). Added §9.1 packaging table sourced from `pricing-tiers.ts`, three BYOK/integration objections, and a **configured vs shipped** rule in §10. |
| 2026-07-24 | Full refresh: product map, Part B / hot layer / quarantine / integrations, sales objections, RC exclusions. |
| 2026-05-28 | IDE Command Center, verify loop, savings dashboard. |
