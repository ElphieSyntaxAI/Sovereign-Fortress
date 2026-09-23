# MSGF Plan Entitlements (`commercial_plan`)

**SSoT for launch gating:** durable plan field + feature matrix + resolve rules.  
**Code:** [`packages/msgf/lib/billing/plan-entitlements.ts`](../../../packages/msgf/lib/billing/plan-entitlements.ts)  
**Migration:** `20260923150000_commercial_plan.sql`  
**Tests:** `packages/msgf/tests/plan-entitlements.test.ts`  
**Buyer matrix:** [`MSGF_BUYER_WALKTHROUGH.md`](../marketing/MSGF_BUYER_WALKTHROUGH.md) §2a

---

## Values

| `commercial_plan` | Meaning |
| :--- | :--- |
| `byok` | Default / unpaid hosted BYOK |
| `pro` | Individual Pro |
| `startup` | Startup workspace |
| `enterprise` | Enterprise workspace |

Stored on **`p4_profiles.commercial_plan`** and **`msgf_companies.commercial_plan`** (check constraint; default `byok`).

Stripe Checkout metadata still uses `msgf_tier`:

| `msgf_tier` | → `commercial_plan` |
| :--- | :--- |
| `individual_pro` | `pro` |
| `corporate_startup` | `startup` |
| `corporate_enterprise` | `enterprise` |
| (other / missing) | `byok` |

Map at write time via `commercialPlanFromMsgfTier` in Stripe entitlement writers ([`stripe-entitlements.ts`](../../../packages/msgf/lib/services/stripe-entitlements.ts)). See also [`MSGF_BILLING.md`](./MSGF_BILLING.md).

---

## Resolve order (workspace wins)

```text
if profile.company_id is set:
  use msgf_companies.commercial_plan for that company  (null → byok)
else:
  use p4_profiles.commercial_plan                      (null → byok)
```

`resolveCommercialPlanForUser(admin, userId)` implements this. Personal Pro sandboxes keep `company_id = null`.

---

## Feature matrix

Core gateway, Eco Trio, custom endpoints, and personal projects are available on **pro / startup / enterprise** (not gated by this matrix). BYOK is the unpaid front door (shadow + BYOK keys).

| Feature key | pro | startup | enterprise |
| :--- | :---: | :---: | :---: |
| `team` (invite / roles / shared company projects) | — | yes | yes |
| `audit_console` | — | yes | yes |
| `tenant_budgets` | — | yes | yes |
| `session_replay` | — | yes | yes |
| `tri_tribunal` | — | yes | yes |
| `workspace_sso` | — | — | yes |
| `siem_export` | — | — | yes |
| `sentry_quarantine` | — | — | yes |
| `signing` | — | — | yes |
| `mcp_product` | — | — | yes |
| `dropbox_archive` | — | — | yes |

There is **no** separate “Priority HITL” feature key. `/admin/ops` is one ops surface.

---

## Assert API

```ts
assertPlanFeature(plan, feature)
// → { ok: true } | { ok: false, status: 403, error: "PLAN_FEATURE_BLOCKED", feature }
```

Wire on routes that mutate or expose gated surfaces (team invite, company-domains, SIEM PUT, tenant-budgets writes, vault-quarantine actions, Tri save, signing/MCP entry points). Locked UI should link to `/pricing`.

---

## Tri-Tribunal (env ∧ plan)

Saving or running `tri_tribunal` requires **both**:

1. `MSGF_TENANT_TRI_CONSENSUS_ENABLED=1` (and platform TRI as needed: `MSGF_TRI_CONSENSUS_ENABLED=1`)
2. Resolved plan in `startup` | `enterprise`

Pro stays blocked even when Tri env flags are on.

---

## Post-MVP process flags vs plan

Process flags unhide code paths for QA (default **off**):

| Flag | Feature |
| :--- | :--- |
| `MSGF_POST_MVP_SIGNING=1` | Signing UI/API process gate |
| `MSGF_POST_MVP_DROPBOX_ARCHIVE=1` | Dropbox archive |
| `MSGF_POST_MVP_MCP=1` | MCP product surface |

Author: `AUTHOR_POST_MVP_FAN_HUB` / `AUTHOR_POST_MVP_HELPER` (leave unset for MSGF-only staging).

**Rule:** Flag on does **not** bypass plan. Signing / MCP / archive still call `assertPlanFeature(..., enterprise)`. Pro and Startup cannot open those surfaces by flipping env alone.

Code: [`post-mvp-gates.ts`](../../../packages/msgf/lib/post-mvp-gates.ts).

---

## Staging

Tri + post-MVP MSGF flags are **1** on staging Cloud Run (see [`MSGF_STAGING_SEED.md`](./MSGF_STAGING_SEED.md)). Exercise matrix with plan personas (`pro_user@msgf.dev`, `startup_admin@msgf.dev`, `enterprise_ciso@msgf.dev`).
