# MSGF public web (`apps/web`)

**Production host:** **https://elphiesgatedai.elphiesyntax.com** (with the Next runtime in `packages/msgf/`).

**SSoT:** [`docs/msgf/MSGF_V1_ROADMAP.md`](../../../../docs/msgf/MSGF_V1_ROADMAP.md) · [`docs/MONOREPO_PRODUCTS.md`](../../../../docs/MONOREPO_PRODUCTS.md) · [`MSGF_GLOBAL_BRAIN_TELEMETRY.md`](../../../../docs/msgf/technical-specs/MSGF_GLOBAL_BRAIN_TELEMETRY.md)

## Intended scope (MSGF 1.0 — M2)

- Public marketing pages for standalone Gated AI
- Pricing + Stripe Checkout (BYOK $0 / Pro $29/mo or $290/yr / Startup $49/mo or $490/yr / Enterprise $199/mo or $1,990/yr)
- Authenticated dashboard shell in `packages/msgf` (this package is **not** a second app)
- Docs for external integrators (BYOK, API keys, tenant IDs)

## Relationship to other surfaces

| Surface | URL |
| :--- | :--- |
| MSGF API (Next) | Same origin as gatedai — `/api/msgf/*` |
| MSGF ops dashboard | Canonical `/admin/ops` in `packages/msgf`; legacy Vite `apps/msgf-dashboard` |
| Author Ecosystem | https://elphiesyntax.com |
| Syntax Education | https://syntaxeducation.elphiesyntax.com |

This package is **not started** in code. **Do not build it for 1.0.** Public marketing, pricing, and checkout already live in `packages/msgf` Next routes. Track any future split as optional M2 polish in [`MSGF_V1_ROADMAP.md`](../../../../docs/msgf/MSGF_V1_ROADMAP.md).
