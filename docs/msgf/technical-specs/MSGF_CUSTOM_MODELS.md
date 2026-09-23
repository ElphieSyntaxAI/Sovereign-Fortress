# MSGF Custom Models (Eco Trio + DeepSeek)

**SSoT for tenant custom endpoints and Eco Trio catalog.**  
**Code:** [`packages/msgf/lib/services/model-routing/types.ts`](../../../packages/msgf/lib/services/model-routing/types.ts) · [`tenant-consensus-config.ts`](../../../packages/msgf/lib/services/tenant-consensus-config.ts)  
**UI:** [`ConsensusPresetPanel.tsx`](../../../packages/msgf/app/_components/dashboard/ConsensusPresetPanel.tsx)  
**API:** `GET/PUT /api/msgf/tenant/consensus-config`  
**Migration:** `20260923140000_custom_reasoning_endpoint.sql` (`custom_reasoning_endpoint` jsonb, nullable)  
**Tests:** `packages/msgf/tests/hosted-endpoint-catalog.test.ts`  
**Product copy:** [`MSGF_PRODUCT_OVERVIEW.md`](../marketing/MSGF_PRODUCT_OVERVIEW.md) §3.3a

---

## Eco Trio

Exactly **three** eco slots (`ECO_TRIO_SLOT_COUNT = 3`). Recommended display names:

| Slot | Catalog | Default credential mode |
| :--- | :--- | :--- |
| Gemma 3 | Hosted Google OpenAI-compat URL + `gemma-3-4b-it` | `api_key` |
| Qwen 3 | DashScope compatible-mode URL + `qwen3-8b` | `api_key` |
| Phi-3 | No hosted catalog URL — start **HTTPS** with empty URL | `https` |

All three must set `isEcoModel: true` and a known `providerKind` (`CUSTOM_OPENAI_COMPATIBLE` or `CUSTOM_ANTHROPIC`).

---

## DeepSeek R1 (reasoning slot)

Separate from Eco Trio. Stored on **`custom_reasoning_endpoint`** (not inside the eco array). UI row: **Use for reasoning**. Catalog:

- `baseURL`: `https://api.deepseek.com/v1`
- `modelName`: `deepseek-reasoner`
- Auth: Bearer

Dispatcher runs this slot only when `useForReasoning` is set / medium-drift reasoning path selects it.

---

## API key vs HTTPS

| Mode | Behavior on save |
| :--- | :--- |
| **`api_key`** (default when catalog matches) | `resolveEndpointBaseURL` fills the **catalog** `baseURL`; operator pastes key only |
| **`https`** | Keep the **typed** URL (private VPC / tunnel / self-host) |

UI toggles: **Use HTTPS** / **Use API key**. Do not show “: missing” on provider labels.

Keys are encrypted at rest (`apiKeyCipher`); public reads return `apiKeyConfigured` never the secret.

---

## Protocol / auth headers

Dispatcher supports:

- OpenAI-compatible: `Authorization: Bearer <key>`
- Anthropic-compatible: `x-api-key`
- Optional catalog `authHeaderStyle`: `bearer` | `x-goog-api-key` (for Google OpenAI-compat hosts that reject Bearer)

Staging smoke (2026-09-23): Gemma catalog Bearer returned a **non-auth** model/API error (header path accepted). Revisit `x-goog-api-key` if Google starts rejecting Bearer again.

---

## Entitlement

Eco Trio + custom endpoints are **core Pro+** product (not in the Startup/Enterprise-only matrix). See [`MSGF_PLAN_ENTITLEMENTS.md`](./MSGF_PLAN_ENTITLEMENTS.md). Tri-Tribunal preset is separate and plan-gated.

---

## Related routing

Platform Small Brain / Big Brain / TRI: [`MSGF_BRAIN_ROUTING.md`](./MSGF_BRAIN_ROUTING.md). Tenant presets include `custom_byok` and `tri_tribunal`.
