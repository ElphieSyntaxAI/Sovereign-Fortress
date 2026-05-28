# MSGF V3.2-ULTRA — Global Agent Execution Matrix (Remediation & Token Budgeting)

**Status:** Canonical product spec (implementation partial — see [MSGF_V1_ROADMAP.md](./MSGF_V1_ROADMAP.md) §7).

---

## I. System role

MSGF is the **governance layer in front of AI agents**: scoped context, severity-based heal, verified outcomes, margin protection via Pulse local gateway and heal-token estimates.

**Not shipped as automatic enforcement:** agents can still bypass the IDE without Cursor rules/MCP.

---

## II. Two-tier remediation

### Option A — Fix Myself (0-token guided)

- **API (planned):** `GET /api/msgf/agent-context?mode=guided`
- **IDE:** Copy agent heal prompt / **0-Token Context Pack**
- Developer or Cursor applies file edits; MSGF does not patch disk in v1

### Option B — Auto-Apply (cloud governance)

- **API:** `GET/POST /api/msgf/heal-queue` with `tokens_with_msgf` / `tokens_saved`
- Cloud governance heal via `persistSelfHealReport` — **not** guaranteed IDE file repair
- Confirm token estimate before BULK

**Do not cite `msgf-consensus.ts` for code-fix** — that module is HAL scoring. Dual-model governance: CONVERGE + `emergency-lom-session.ts`.

---

## III. Dev heal cycle (planned P2)

1. Bug button / incidents → `occurrence_count`
2. Threshold → `dev_heal_request`
3. Heal button → `DEV_CYCLE_START` → **Self heal** or **Manual heal** (BULK)
4. `POST verify-result` after fix (P3)

---

## IV. Verify

Per-tenant `verify_commands` (e.g. Deckhost npm scripts) — not hardcoded in core.

---

## Product appendices

| Surface | `product_surface` | Verify profile |
|---------|-------------------|----------------|
| Gated AI | `gatedai` | `npm run validate:deployment -w msgf` |
| Author | `author` | Author BFF / manuscript workspaces |
| Integrator | `integrator` | External repo metadata |
| Education | `education` | Educates package scripts |
