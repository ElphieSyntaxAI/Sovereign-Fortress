# MSGF — Solo service integration (third-party projects)

**Purpose:** Run MSGF as a **standalone guardrail API** in another product (HR typing monitor, LMS, internal tools) without Author Ecosystem.

**Buying the MSGF web product (new customer)?** Use [`MSGF_BUYER_WALKTHROUGH.md`](./MSGF_BUYER_WALKTHROUGH.md) instead — sign-up, Stripe, session Pulse — not `bootstrap:solo`.

**Engine:** https://elphiesgatedai.elphiesyntax.com  
**Roadmap status:** [`MSGF_V1_ROADMAP.md`](./MSGF_V1_ROADMAP.md) §10  
**Testing:** [`MSGF_TESTING.md`](./MSGF_TESTING.md)

---

## 1. What you get from MSGF alone

| Capability | API / package |
| :--- | :--- |
| Rhythm / HAL gate | `POST /api/msgf/pulse` · `msgf/universal/p1-hal-standard` |
| Codebase brain ingest | `POST /api/msgf/ingest` |
| Post-ingest remediation | `GET/POST /api/msgf/heal-queue` |
| Human arbitration | `POST /api/msgf/heal-queue/human-arbitration` |
| Global mitigations (DEFEND) | `msgf_rules` / `global_mitigations` (DB) |
| Scheduled ops | `POST /api/msgf/ops/v32-heartbeat` |
| TypeScript client | `msgf/connector/MsgfBridge` · `msgf/ide-connector` |
| Chunked HAL packets | `msgf/hal-author-bridge` (175 words / 10 overlap) |

**Not included** (stay in Author or your product): manuscript ledger, RAG librarian, cool-down UX, Docs extension capture.

---

## 2. One-time operator setup (this repo)

```bash
cd /path/to/ElphieSyntaxLLC

# 1. Schema + env
npm run db:push -w msgf
npm run verify:msgf-env -w msgf
npm run verify:db-schema -w msgf

# 2. Bootstrap integrator tenant (pledge + pillars + license key printed once)
npm run bootstrap:solo -w msgf -- --tenant=your_product_silo

# 3. Start MSGF
npm run dev -w msgf

# 4. Deep probe (another terminal)
npm run probe:solo -w msgf
```

Save the printed `MSGF_CONTRACT_LICENSE_KEY` — it cannot be recovered from the DB.

**Recommended dev flags** (until Stripe is finished):

```env
MSGF_CREDIT_GUARD_DISABLED=1
MSGF_ENTITLEMENT_MOCK_STRIPE_ACTIVE=1
```

---

## 3. Calling Pulse from your app

### Option A — HTTP

```http
POST /api/msgf/pulse
Authorization: Bearer msgf_live_…
x-msgf-license-key: msgf_live_…
x-msgf-ide-pulse: 1
x-msgf-entity-id: <human-uuid>
x-msgf-tenant-id: <tenant-silo>
Content-Type: application/json

{
  "keystrokes": [
    { "ts": 1710000000100, "key": "a", "type": "keydown", "flightMs": 95, "dwellMs": 80 }
  ]
}
```

Optional trusted rhythm scores from **your** BFF (not Author):

```http
x-msgf-author-hal: {"halScore":82,"typingScore":78,"isImeSession":false,"locale":"en","rhythmUnitCount":12,"wordCount":40}
```

### Option B — MsgfBridge (Node / TS)

```ts
import { MsgfBridge } from "msgf/connector/MsgfBridge";

const bridge = new MsgfBridge({
  baseUrl: process.env.MSGF_APP_URL!,
  tenantId: "your_product_silo",
  licenseKey: process.env.MSGF_CONTRACT_LICENSE_KEY!,
  entityId: userUuid,
});

await bridge.dispatch({
  keystrokes: [{ ts: Date.now(), key: "x", type: "keydown", flightMs: 120 }],
});
```

### Your “secret sauce”

MSGF handles gates, Vault/Hall, consensus, heal queue. Your product adds:

- Capture (browser, desktop, LMS)
- Business rules (words/hour, idle, assignment tags)
- Optional `x-msgf-author-hal` header with your scorer

Use `msgf/hal-author-bridge` to map your events and chunk by 175 words with 10-word overlap.

---

## 4. Deep-test checklist (operator)

**Windows + OneDrive:** if `npm run dev -w msgf` fails with `EINVAL` on `.next/.../readlink`, delete `packages/msgf/.next` and retry. Use `MSGF_APP_URL=http://127.0.0.1:3000` in `packages/msgf/.env.local` for local `probe:solo`.

| Step | Command |
| :--- | :--- |
| Offline regression | `npm run test:unit -w msgf` |
| Build gate | `npm run validate:deployment` |
| Integration DB tests | `npm run test:integration -w msgf` |
| Full solo gate | `npm run deep-test:solo -w msgf` (unit + build; use `--live` for probe) |
| LOM harness | `MSGF_ENABLE_LOM_TEST=1` + dev server + `npm run test:lom-disagreement -w msgf` |
| Ingest sample | `npm run test:ingest-workflow -w msgf` |

---

## 5. Production deploy

1. `npm run validate:deployment`
2. `./deploy.sh` or `./setup-cloud.sh` with `MSGF_OPS_CRON_SECRET`, Redis, Supabase env
3. Re-run `npm run bootstrap:solo -w msgf` against **production** DB (or mint license only)
4. `MSGF_APP_URL=https://elphiesgatedai.elphiesyntax.com npm run probe:solo -w msgf`

---

## 6. Stripe

Billing is **deferred until post-test signoff**. Solo integrators can use contract license + mock entitlements for deep testing without live Stripe.
