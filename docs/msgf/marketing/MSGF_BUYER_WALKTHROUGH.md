# MSGF — Buyer walkthrough (new customer, not integrator)

**Purpose:** Test MSGF **as a paying SaaS customer** — separate Supabase user, sign-up, checkout, dashboard Pulse — not the B2B `bootstrap:solo` license path.

**Contrast:** [`MSGF_SOLO_INTEGRATION.md`](../../integrations/technical-specs/MSGF_SOLO_INTEGRATION.md) is for **third-party apps** calling MSGF with `msgf_live_…` keys. This doc is for **you** using the MSGF web product.

---

## 1. Two personas

| Persona | How they authenticate | Typical use |
| :--- | :--- | :--- |
| **Integrator / operator** | `MSGF_CONTRACT_LICENSE_KEY` + `x-msgf-entity-id` | Education BFF, API deep test |
| **Buyer / customer** | Supabase sign-up → session cookie | Pricing, dashboard, browser Pulse |

Do **not** mix them in one browser profile: use a **new email** and **incognito** for the buyer test.

---

## 2. Dev environment (buyer test)

In `packages/msgf/.env.local` for buyer UI testing:

```env
MSGF_APP_URL=http://127.0.0.1:3000

# Comment out integrator license while testing buyers (otherwise Pulse can inherit the wrong tenant):
# MSGF_CONTRACT_LICENSE_KEY=

MSGF_ENTITLEMENT_MOCK_STRIPE_ACTIVE=1
MSGF_CREDIT_GUARD_DISABLED=1

# Optional: starter credits on first dashboard visit (registration onboarding)
MSGF_REGISTRATION_STARTER_CREDITS=25
MSGF_REGISTRATION_BILLING_LICENSE=monthly
```

Stripe (real “purchase” path): set `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO_INDIVIDUAL`, and run `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

---

## 3. Full buyer journey (manual)

1. **Start MSGF** — `npm run dev -w msgf` → http://127.0.0.1:3000  
2. **Incognito window** (or another browser) — not signed in as you / operator.  
3. **Sign up** — `/sign-up` with a **new** email (e.g. `buyer-test+20260523@yourdomain.test`).  
4. **Confirm email** — Supabase confirmation link → `/auth/callback` → `/dashboard`.  
   - First dashboard load creates **`p4_profiles` + pledge** only — pillars stay empty until you add a project.  
5. **Purchase (optional but realistic)**  
   - `/pricing` → **Individual Pro ($99 one-time)** or **Startup Team ($49 / user / mo)** → Stripe Checkout (test card `4242 4242 4242 4242`).  
   - Success URL: `/pricing?checkout=success` — webhook stamps entitlements on your profile.  
6. **Pulse** — From dashboard / workspace / extension after baseline typing (see Phase 0 in [`packages/msgf/README.md`](../../../packages/msgf/README.md) Steps D–E).  
   - Session Pulse uses **`p4_profiles`** (no `msgf_live_` key in the browser).  
7. **Reports** — `/dashboard/daily-reports`: metered vs proven; Shadow Proxy panel if you pointed an SDK at `/api/v1`.  
8. **Ops (operators)** — `/admin/ops`: audit hub, Session Replay / harm, most-used resources, budgets, SIEM; bug FAB → `#bug-inbox` (promote to ARBITRATE or dismiss).  
9. **Heal queue** — Dashboard drawer; API uses your profile tenant (`tenant_gated` by default), not `integration_sandbox`.

---

## 4. Scripted helpers

| Command | What it does |
| :--- | :--- |
| `npm run create:buyer-user -w msgf` | Creates a confirmed Supabase auth user; prints email/password (you still sign in through the UI). |
| `npm run probe:buyer -w msgf` | After sign-in: set `MSGF_PULSE_COOKIE` in `.env.local`, probes health + session Pulse + heal-queue. |

**Create test user:**

```bash
npm run create:buyer-user -w msgf
# optional: npm run create:buyer-user -w msgf -- --email=buyer@example.com
```

Then sign in at `/sign-in`, open `/dashboard` once, copy session cookie into:

```env
MSGF_PULSE_COOKIE=sb-...-auth-token=...
```

```bash
MSGF_APP_URL=http://127.0.0.1:3000 npm run probe:buyer -w msgf
```

---

## 5. Strict “must pay before Pulse” test

To force entitlement failure until Stripe completes:

```env
MSGF_ENTITLEMENT_MOCK_STRIPE_ACTIVE=0
MSGF_REGISTRATION_STARTER_CREDITS=0
MSGF_REGISTRATION_BILLING_LICENSE=monthly
```

Sign up → try Pulse before checkout (should **429** entitlement) → complete checkout + webhook → Pulse **200**.

---

## 6. Checklist

| Step | Signal |
| :--- | :--- |
| New auth user | Supabase Dashboard → Authentication → new UUID |
| Onboarding | Row in `p4_profiles`; pledge in `state_beats`; pillars under `tenant_gated` |
| Checkout | Stripe session success; webhook log `STRIPE_PAYMENT_SUCCESS` |
| Pulse | `POST /api/msgf/pulse` **200** with session cookie, no license header |
| Reports | Period history loads; foreign `tenant_id` → 403 |
| Not integrator | No `MSGF_CONTRACT_LICENSE_KEY` in server env during test |

---

## Changelog

| Date | Change |
| :--- | :--- |
| 2026-08-06 | Reports / Shadow Proxy awareness; tenant IDOR note. |
| 2026-05-23 | Initial buyer SSoT; session Pulse via `p4_profiles`; dashboard gatedai onboarding sync. |
