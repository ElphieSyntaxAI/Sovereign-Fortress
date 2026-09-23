# MSGF Billing (Stripe Checkout + entitlements)

**SSoT for paid seats, Checkout, and entitlement writers.**  
**Plans / hard gates:** [`MSGF_PLAN_ENTITLEMENTS.md`](./MSGF_PLAN_ENTITLEMENTS.md)  
**Buyer journey:** [`MSGF_BUYER_WALKTHROUGH.md`](../marketing/MSGF_BUYER_WALKTHROUGH.md)  
**Packaging:** [`MSGF_PRODUCT_OVERVIEW.md`](../marketing/MSGF_PRODUCT_OVERVIEW.md) §9.1  
**RC smoke:** [`MSGF_DEV_TODO.md`](../MSGF_DEV_TODO.md) §2b

---

## Prices (SSOT)

`packages/msgf/app/_components/pricing/pricing-tiers.ts` — quote from that file.

| Tier | Monthly | Yearly | Stripe `plan` / `msgf_tier` |
| :--- | :--- | :--- | :--- |
| BYOK | $0 | $0 | No Checkout — `/shadow-trial` |
| Pro | $29 | $290 | `pro_individual` → `individual_pro` |
| Startup | $49 / workspace | $490 / workspace | `startup_team` → `corporate_startup` |
| Enterprise | $199 / workspace | $1,990 / workspace | `enterprise` → `corporate_enterprise` |

Env Price IDs: `STRIPE_PRICE_PRO_INDIVIDUAL` (+ `_YEARLY`), `STRIPE_PRICE_STARTUP_TEAM` (+ `_YEARLY`), `STRIPE_PRICE_ENTERPRISE` (+ `_YEARLY`).

---

## Checkout

| Item | Detail |
| :--- | :--- |
| Route | `POST /api/billing/checkout` (`plan` + `interval`: `month` \| `year`) |
| Code | [`stripe-checkout-plans.ts`](../../../packages/msgf/lib/billing/stripe-checkout-plans.ts) |
| **Success URL** | `{origin}/workspace?tab=projects` |
| Cancel URL | Pricing / prior surface |
| Metadata | `msgf_plan`, `msgf_tier`, seat quantity as applicable |

After Shadow trial full access, **Subscribe to Pro** uses the same success landing.

---

## Webhook → entitlements

| Item | Detail |
| :--- | :--- |
| Route | `POST /api/webhooks/stripe` |
| Writers | [`stripe-entitlements.ts`](../../../packages/msgf/lib/services/stripe-entitlements.ts) |
| Profile | `billing_license_type`, `stripe_subscription_*`, credits, **`commercial_plan`** |
| Company | Startup/Enterprise: `msgf_companies.seat_limit` + **`commercial_plan`**; admin `team_platform_role` |

`commercialPlanFromMsgfTier` maps Stripe metadata → durable plan. Workspace company plan overrides personal profile on resolve.

---

## Mock / live flags

| Flag | Role |
| :--- | :--- |
| `MSGF_ENTITLEMENT_MOCK_STRIPE_ACTIVE=1` | Treat subscription as active without live webhook truth (staging / soft-RC) |
| `MSGF_STRIPE_WEBHOOK_LIVE=1` | Production webhook truth |
| `MSGF_STRIPE_WEBHOOK_LIVE=0` | Staging / test webhook |

**Paid launch:** keep mock ON until a live Checkout smoke proves writers; then flip live + mock off together. Do not promise self-serve card success before that.

Portal: `POST /api/billing/portal` → Stripe Customer Portal (`/account`).

---

## Account APIs

| Route | Purpose |
| :--- | :--- |
| `GET /api/billing/account` | Session billing snapshot |
| `POST /api/billing/checkout` | Create Checkout session |
| `POST /api/billing/portal` | Billing portal session |

---

## Related

- Plan feature 403s: [`MSGF_PLAN_ENTITLEMENTS.md`](./MSGF_PLAN_ENTITLEMENTS.md)
- Staging personas with pre-set plans: [`MSGF_STAGING_SEED.md`](./MSGF_STAGING_SEED.md)
