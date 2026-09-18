# MSGF — Buyer walkthrough (new customer, not integrator)

**Purpose:** Test MSGF **as a paying SaaS customer** — separate Supabase user, dashboard Pulse, pricing — not the B2B `bootstrap:solo` license path.

**Production:** https://elphiesgatedai.elphiesyntax.com  
**Local:** http://127.0.0.1:3001 (`npm run dev -w msgf` binds **3001**, not 3000)

**Contrast:** [`MSGF_SOLO_INTEGRATION.md`](../../integrations/technical-specs/MSGF_SOLO_INTEGRATION.md) is for **third-party apps** calling MSGF with `msgf_live_…` keys. This doc is for **you** using the MSGF web product.

**Pricing SSOT:** `packages/msgf/app/_components/pricing/pricing-tiers.ts` — **$0** Indie · **$99** Pro perpetual · **$49**/user/mo Startup Team.

**Privacy:** Global Brain swarm telemetry is **zero-text** (how a wave failed, never the prompt). Session Replay remains tenant legal/security retention — not training. [`MSGF_GLOBAL_BRAIN_TELEMETRY.md`](../technical-specs/MSGF_GLOBAL_BRAIN_TELEMETRY.md).

---

## 1. Two personas (do not mix)

| Persona | How they authenticate | Typical use |
| :--- | :--- | :--- |
| **Integrator / operator** | `MSGF_CONTRACT_LICENSE_KEY` + `x-msgf-entity-id` | Education BFF, API deep test, `/admin/ops` |
| **Buyer / customer** | Supabase session cookie | Pricing, workspace, dashboard Pulse |

Use a **new email** and **incognito** for the buyer test. Comment out `MSGF_CONTRACT_LICENSE_KEY` so Pulse cannot inherit the integrator tenant.

Public `/sign-up` is **not** account creation. It is the **beta waitlist**. Console seats are invite-only during beta. For a real buyer UI test, mint a confirmed user with `create:buyer-user` and sign in at `/sign-in`.

---

## 2. What a real buyer can see without a console seat

Walk these **unauthenticated** surfaces first (prod or local). They are the public funnel.

| Surface | URL | Signal |
| :--- | :--- | :--- |
| Home / platform hub | `/` | Marketing chooser, not the signed-in dashboard |
| Features | `/features` | Shipped capability map |
| Pricing | `/pricing` | Indie $0 · Pro $99 one-time · Startup $49/user/mo |
| Getting started | `/getting-started` | Workspace → Pulse Guard → map a project. Step 1 “Sign up” still links here; that is the **waitlist**, not account creation. |
| Waitlist | `/sign-up` | “Join MSGF beta testing” — email goes to the waitlist, **not** `auth.users` |
| Shadow trial | `/shadow-trial` | Header **Free 7-day trial** CTA. No console seat. Clock starts on first SDK call. Proof email includes projected $ plus **would have promoted / blocked** hashed resource counts. Starting 3-day full access applies those scores once. |
| Sign in | `/sign-in` | Invited / minted buyers. Email/password, or Google Workspace if the domain is allowlisted. |
| Status | `/status` | Public health |

Indie CTA on `/pricing` is **Download IDE extension**, not Stripe. Pro / Startup CTAs POST `/api/billing/checkout` (`pro_individual` / `startup_team`).

---

## 3. Dev environment (buyer console test)

In `packages/msgf/.env.local`:

```env
MSGF_APP_URL=http://127.0.0.1:3001

# Comment out integrator license while testing buyers (otherwise Pulse can inherit the wrong tenant):
# MSGF_CONTRACT_LICENSE_KEY=

MSGF_ENTITLEMENT_MOCK_STRIPE_ACTIVE=1
MSGF_CREDIT_GUARD_DISABLED=1

# Optional: starter credits on first dashboard visit (buyer onboarding)
MSGF_REGISTRATION_STARTER_CREDITS=25
MSGF_REGISTRATION_BILLING_LICENSE=monthly
```

Stripe (real “purchase” path):

- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_PRO_INDIVIDUAL` ($99 perpetual)
- `STRIPE_PRICE_STARTUP_TEAM` ($49/user/mo)
- `STRIPE_WEBHOOK_SECRET`
- `stripe listen --forward-to localhost:3001/api/webhooks/stripe`

Checkout success URL is `/pricing?checkout=success&plan=…`. Webhook logs `STRIPE_PAYMENT_SUCCESS` and stamps entitlements on `p4_profiles`.

**Paid-launch honesty:** live Stripe keys may already be on `msgf-api`, but mock entitlements can still be ON. Do not promise self-serve card success on a sales call until [`MSGF_DEV_TODO.md`](../MSGF_DEV_TODO.md) §2b Checkout smoke + mock-off is green.

---

## 4. Full buyer journey (manual)

### A. Public funnel

1. **Start MSGF** — `npm run dev -w msgf` → http://127.0.0.1:3001 (or use production).
2. **Incognito** — not signed in as operator.
3. Hit `/`, `/features`, `/pricing`, `/getting-started`.
4. `/sign-up` — confirm it is waitlist copy (“Join beta waitlist”), not a password form. Optional: `/shadow-trial`.

### B. Console seat (invited / minted)

5. **Mint a buyer** (local / staging) — skip email confirm:

```bash
npm run create:buyer-user -w msgf
# optional: npm run create:buyer-user -w msgf -- --email=buyer@example.com
```

6. **Sign in** — `/sign-in` with the printed email/password. (`create:buyer-user` already confirms the email.)
7. **First `/dashboard` load** runs `ensureGatedAiBuyerAccount`:
   - Creates **`p4_profiles` + pledge** (`state_beats`, tenant `tenant_gated` unless `MSGF_GATED_TENANT_ID` is set).
   - Does **not** seed P1–P6. Governance matrix stays empty until you map a project.
   - Independent buyers land in a personal sandbox (workspace + dashboard both allowed).
8. **Workspace** — `/workspace` → map a folder / GitHub repo (`/setup/projects`). Copy the `.vscode/settings.json` / IDE token block. Download Pulse Guard from pricing or `/getting-started`.
9. **Purchase (optional but realistic)** — stay signed in, then `/pricing`:
   - **Indie ($0)** — extension download only.
   - **Individual Pro ($99 one-time)** or **Startup Team ($49 / user / mo)** → Stripe Checkout (test card `4242 4242 4242 4242`).
   - Success: `/pricing?checkout=success&plan=…` — then `/account` for Stripe Customer Portal when a customer id exists.
10. **Pulse** — from dashboard / workspace / extension after baseline typing (cookie capture: README Phase 0 Steps D–E, but hit **:3001**).
    - Session Pulse uses **`p4_profiles`** (no `msgf_live_` key in the browser).
    - First `POST /api/msgf/pulse` may return **202** with `baseline_required: true`. Later calls **200**.
11. **Reports** — `/dashboard/daily-reports`: metered vs proven; Shadow Proxy panel if you pointed an SDK at `/api/v1`. Also `/dashboard#token-savings` and Source Audit.
12. **Heal queue** — dashboard drawer; API uses the profile tenant (`tenant_gated` by default), not `integration_sandbox`.
13. **Skip `/admin/ops`** unless this user is `GLOBAL_ADMIN` / `COMPANY_ADMIN`. Buyers can file the onscreen FAB (`POST /api/msgf/report-issue`); operators triage `#bug-inbox`.

---

## 5. Scripted helpers

| Command | What it does |
| :--- | :--- |
| `npm run create:buyer-user -w msgf` | Creates a confirmed Supabase auth user; prints email/password (you still sign in through the UI). |
| `npm run probe:buyer -w msgf` | After sign-in: set `MSGF_PULSE_COOKIE` in `.env.local`, probes `/health` + session Pulse + heal-queue. Accepts Pulse **200 or 202**. |

```bash
npm run create:buyer-user -w msgf
```

Then sign in at `/sign-in`, open `/dashboard` once, copy the session cookie (Application → Cookies → `sb-*-auth-token`) into:

```env
MSGF_PULSE_COOKIE=sb-...-auth-token=...
```

```bash
MSGF_APP_URL=http://127.0.0.1:3001 npm run probe:buyer -w msgf
```

If Pulse says `ERR_PROFILE_MISSING` / “No p4_profiles row”, open `/dashboard` once and retry.

---

## 6. Strict “must pay before Pulse” test

Onboarding **defaults** `stripe_subscription_status` to `active` for monthly licenses. Mock-off alone is not enough. Also zero starter credits and do **not** stamp active:

```env
MSGF_ENTITLEMENT_MOCK_STRIPE_ACTIVE=0
MSGF_REGISTRATION_STARTER_CREDITS=0
MSGF_REGISTRATION_BILLING_LICENSE=monthly
MSGF_REGISTRATION_STRIPE_STATUS=inactive
```

Restart the dev server. Sign in as a **fresh** minted user (existing profiles already have `active`). Open `/dashboard` once, then Pulse **before** checkout → **429** (`ERR_CREDIT_GUARD_EXHAUSTED` / “Monthly subscription is not active”). Complete Checkout + webhook → Pulse **200** (or **202** if baseline still required).

---

## 7. Checklist

| Step | Signal |
| :--- | :--- |
| Public funnel | `/pricing` shows $0 / $99 / $49; `/sign-up` is waitlist; `/shadow-trial` loads |
| New auth user | Script output UUID, or Supabase Dashboard → Authentication |
| Sign-in | `/sign-in` → `/dashboard` or `/workspace` (not waitlist) |
| Onboarding | Row in `p4_profiles` (`tenant_gated`); pledge in `state_beats`; pillars empty until a project exists |
| Workspace | `/workspace` + `/setup/projects` mapping; IDE token copy block |
| Indie $0 | Pricing CTA downloads `.vsix` (no Stripe) |
| Checkout | Stripe session success; webhook log `STRIPE_PAYMENT_SUCCESS`; `/account` portal when customer id exists |
| Pulse | `POST /api/msgf/pulse` **200 or 202** with session cookie, no license header |
| Reports | Period history loads; foreign `tenant_id` → 403 |
| Not integrator | No `MSGF_CONTRACT_LICENSE_KEY` in server env during test |

---

## Related

- [`MSGF_PRODUCT_OVERVIEW.md`](./MSGF_PRODUCT_OVERVIEW.md) — packaging, sales claims, RC exclusions
- [`MSGF_GLOBAL_BRAIN_TELEMETRY.md`](../technical-specs/MSGF_GLOBAL_BRAIN_TELEMETRY.md) — zero-text swarm absorb vs Session Replay
- [`MSGF_DEV_TODO.md`](../MSGF_DEV_TODO.md) §2b — live Checkout smoke + mock-off
- [`packages/msgf/README.md`](../../../packages/msgf/README.md) — Pulse cookie + baseline curl (use port **3001**)

---

## Changelog

| Date | Change |
| :--- | :--- |
| 2026-09-18 | Shadow trial proof includes would-have P7 promote/block counts; 3-day full access applies those scores once. |
| 2026-09-17 | Port **3001**; `/sign-up` is beta waitlist; public funnel + Shadow trial; Indie $0 CTA; workspace / account; Pulse 202; strict test needs `MSGF_REGISTRATION_STRIPE_STATUS=inactive`. Global Brain telemetry is zero-text; Session Replay is not a training corpus. |
| 2026-08-06 | Reports / Shadow Proxy awareness; tenant IDOR note. |
| 2026-05-23 | Initial buyer SSoT; session Pulse via `p4_profiles`; dashboard gatedai onboarding sync. |
