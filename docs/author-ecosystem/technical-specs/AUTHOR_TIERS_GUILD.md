# Author Tiers, Guild & Publisher Hub

**SSoT for commercial tiers vs runtime gates, and anonymized publisher visibility.**  
**Product prices / WIP limits:** [`AUTHOR_ECOSYSTEM_ROADMAP.md`](../AUTHOR_ECOSYSTEM_ROADMAP.md) §4  
**MSGF commercial plans (Gated AI):** [`MSGF_PLAN_ENTITLEMENTS.md`](../../msgf/technical-specs/MSGF_PLAN_ENTITLEMENTS.md) — separate product; do not conflate.

---

## Author tiers (product SSOT)

| Tier | Price | Caps (roadmap) |
| :--- | :--- | :--- |
| Tier 1 Free | — | Extension + HAL + 1 WIP |
| Tier 2 | $29.99 | Dashboard + 2 WIP + Guild L1 |
| Tier 3 | $79.99 | 5 WIP + 1 Lore Bot + Guild L2 |
| Tier 4 | $109.99 | 10 WIP + 3 Lore Bots + sales/video |
| Tier 5 | $199.99 | 20 WIP + 7 Lore Bots + courses |

**Reconciliation:** Legacy `msgf_legacy_tiers` seeds and BFF provisioners may still name older rows (e.g. “Tier 2: Core Author”). Align migrations and gates to the table above over time.

---

## Runtime gates (today)

| Mechanism | Path | Meaning |
| :--- | :--- | :--- |
| Guild level | `GuildTierService` + `p4_guild_tier_counters` | “Tier 2+” ≈ `getGuildTierLevel(tenantId) >= 2`; bumps on verified human flow |
| Apprentice / Guild resolve | `author-gate.ts` / `RevisionGateMiddleware` | Subsidized apprentice matching vs guild gates |
| Legacy tier_id | `msgf_legacy_users` / provisioner | Older checkTierAccess routes |
| Badges / completion | `BadgeCertificationService`, `project_completed_at` | Proof for Fan Hub / helpers |

`verified_human_flow_at` on manuscripts triggers guild counter bumps (DB trigger). Do not hand-edit counters without understanding that path.

---

## Publisher Hub (marketplace)

Anonymized WIP visibility for scouting without full IP exposure.

| Signal | Source |
| :--- | :--- |
| Publishing intent | `p4_manuscripts.publishing_intent` (`TRADITIONAL` \| `SELF` \| `UNDECIDED`) |
| Seeking agent | `is_seeking_agent` |
| HAL / quality aggregates | Editor ledger / HAL export surfaces |

Orchestration: `MarketplaceOrchestrator.ts`, `EditorLedgerService.ts`, retailer/HAL PDF export via `RetailerExportService.ts`, routes under publishing-requests.

**Publisher encryption levels** (product): Level 1 core HAL average → Level 4 full forensic trail — roadmap §4; wire to export payloads as those APIs harden.

---

## Not MSGF `commercial_plan`

Author WIP tiers are **Author product** pricing. MSGF `byok|pro|startup|enterprise` gates Gated AI seats/Tri/IDE — different matrix. A user can hold both without sharing the same enum.
