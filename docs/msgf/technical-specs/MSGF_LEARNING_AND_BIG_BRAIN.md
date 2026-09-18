# MSGF learning loop — Big Brain vs “getting smarter”

**Audience:** You, operators, and anyone worried that “nothing hits Big Brain” means MSGF is broken.

**Companion:** [`MSGF_BRAIN_ROUTING.md`](./MSGF_BRAIN_ROUTING.md) · [`MSGF_PRODUCT_OVERVIEW.md`](../marketing/MSGF_PRODUCT_OVERVIEW.md) · [`MSGF_GLOBAL_BRAIN_TELEMETRY.md`](./MSGF_GLOBAL_BRAIN_TELEMETRY.md) (zero-text swarm absorb; not a training corpus)

---

## 1. The worry (and why it’s understandable)

- CONVERGE / ARBITRATE are **implemented** in code (`PulseEngine.converge()` → dual-model → `runArbitratePhase()`).
- The roadmap still lists them **Partial** in §7 because of **refactor** debt (thin pulse route), not missing behavior.
- Day-to-day work (IDE dev-session, Run Scripts, Safe Build, dev-event) **never calls** full Pulse → CONVERGE — by design.
- So counters stay at **0 global CONVERGE** and it *feels* like a dead feature.

**Zero Big Brain in 24h is often the success case:** routine work stayed on Small Brain and you still learned.

---

## 2. How MSGF gets smarter without Big Brain

| Path | What gets written | When |
| :--- | :--- | :--- |
| **Ingest (SWEEP)** | Vault lineage, pillar gaps | Project scan / file upload |
| **dev-event Heal Cheap** | Vault match or Flash heal narrative | IDE build failure |
| **verify-result + pack** | Vault on pass; Hall after 3× same fail | Run Scripts / Safe Build |
| **Heal queue** | Vault via remediation / scheduled cron | Post-ingest, operator actions. APPROVE writes P7 **good**; DENY writes **bad**. |
| **P7 reputation** | Per-tenant hashed resource scores | Every write path above plus swarm/Active/Shadow-CTA. Next Pulse/Active/swarm **reads** before spending tokens. Not training data. |
| **Pulse local_gateway** | `state_beats`, tenant Vault on approved low-drift deltas | Normal typing |
| **CONVERGE cache** | Replays a **prior** Big Brain verdict (no re-spend) | Same content hash again |

**Big Brain (global CONVERGE)** is for **novel, high-drift** moments: biometric + logic surprise, P2 contradiction, or operator-forced escalation. It is not the only memory.

**Global DNA** (`msgf_rules`, `vault_core`) is a separate, **admin-gated** promotion — tenant heals can stay local with `LOCAL_SUCCESS_GLOBAL_PENDING`.

---

## 3. When Big Brain actually runs

All must be true for **global dual-model CONVERGE**:

1. `POST /api/msgf/pulse` (not dev-event / verify-result)
2. Logic drift **above** threshold (default **0.3**, or header `x-msgf-brain-sensitivity`)
3. Not bypassed: dev-session discount, soft cap, BYOK bypass, or IDE **12s timeout** degrade
4. Tenant routing allows converge (credits / BYOK / perpetual segment)

Forced escalation for **staging proof** (safe):

- Send `approvedDelta` in Pulse body (non-empty) → `forceGlobal` in gate phase
- Or set `x-msgf-brain-sensitivity: 0.1` and use distinctive / high-entropy paste text

---

## 4. Prove CONVERGE + ARBITRATE once (definition of done)

Run after deploy (license + tenant from `bootstrap:solo`):

```bash
npm run smoke:pulse-converge -w msgf
```

**Pass when:**

- HTTP 200/202 from Pulse
- Response JSON includes evidence of **global** path (`global_converge`, `pulse_global_converge`, or `requiresTieBreaker` / dual-model fields) **OR** documented bypass (`converge_bypass`, `converge_timeout_degraded`) with `logic_drift` in forensic/admin view
- `GET /api/msgf/dashboard/pulse-routing?tenant_id=…` shows `global_converge >= 1` after the smoke (may take one Redis window)

**ARBITRATE** is proven when:

- `requiresTieBreaker` appears on a disagreeing run, **or**
- heal-queue shows `human_arbitration_packages` / `PENDING_HUMAN_ARBITRATION` after circuit opens (use admin dashboard)

After one green smoke: mark CONVERGE/ARBITRATE **Done (behavior)** in your head; stop re-implementing the same pipeline.

---

## 5. Dashboard: how to read “0 Big Brain”

| What you see | Meaning |
| :--- | :--- |
| **Small Brain % high**, `global_converge: 0` | Efficiency — routine pulses did not need dual-model |
| **Verify → Vault** / **dev-event vault hits** rising | Tenant memory growing without Big Brain |
| **CONVERGE cache hits** | Past Big Brain work being **reused** cheaply |
| **`global_converge > 0`** | At least one pulse escalated — check admin queue if tie-breaker pending |

---

## 6. Making it feel complete (product checklist)

| Action | Owner |
| :--- | :--- |
| Run `smoke:pulse-converge` on staging/prod once | You |
| Sync roadmap §7: CONVERGE/ARBITRATE **Done (behavior)** | Doc |
| Watch token savings: verify passes, Hall dedupes, cache hits | Dashboard |
| Use **admin** `#big-brain-issues` only when `big_brain_escalations_pending > 0` | Operators |
| Optional: monthly forced `approvedDelta` pulse in staging to exercise path | Ops habit |

---

## Changelog

| Date | Change |
| :--- | :--- |
| 2026-09-18 | P7 closed loop: reputation scores now steer the next Pulse/Active/swarm admission. Shadow CTA applies deferred hits once. Prompts never train models. |
| 2026-09-17 | Global Brain swarm telemetry is structural only (cause codes, topology, token burn) — prompts never train models. Session Replay is tenant forensics, not this loop. [`MSGF_GLOBAL_BRAIN_TELEMETRY.md`](./MSGF_GLOBAL_BRAIN_TELEMETRY.md). |
| 2026-05-28 | Initial doc + `smoke:pulse-converge` script |
