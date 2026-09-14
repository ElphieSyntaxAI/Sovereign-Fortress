# MSGF / Author — PQC & classical crypto audit

**Audience:** Engineering + security  
**Status:** Inventory as of 2026-08-05  
**Related:** Hybrid envelope `0x03` + HAL v2 ML-DSA-65 in `@elphie-syntax/core/lib/crypto`

## 1. Platform vs app control

| Layer | Who controls crypto | App role |
| :--- | :--- | :--- |
| Browser ↔ Cloud Run / Next | Platform TLS (GCP / browser stack) | No custom handshake; enable PQ-TLS on LB when available |
| Cloud Run ↔ Supabase API / Realtime WSS | Supabase + system CAs | No app payload encryption to Postgres |
| Postgres encryption-at-rest | Supabase / GCP disk | Assume platform; app ciphertext only where listed below |
| Redis / Upstash | Provider TLS or `REDIS_TLS` | Avoid `rejectUnauthorized: false` in prod |
| Pulse telemetry body | Transport TLS + bearer/license auth | **No** E2E encrypt/sign of keystroke payloads today |
| Credential vault / hybrid envelopes | **App** | AES-GCM ± KMS; hybrid `0x03` when enabled |
| HAL authorship proof | **App** | v1 = SHA-256; v2 = ML-DSA-65 over RFC 8785 canonical JSON |

**Hybrid TLS/HTTPS negotiation is not implemented inside `packages/core` or `packages/msgf`.** Application-layer hybrid KEM (X25519 + ML-KEM-768) protects envelopes and long-lived secrets. Claiming “HTTPS is post-quantum” requires platform PQ-TLS.

## 2. Classical algorithm inventory (RSA / ECC / other)

| Algorithm | Location | Purpose | RSA/ECC? |
| :--- | :--- | :--- | :--- |
| AES-256-GCM | `packages/msgf/lib/crypto/CryptoService.ts` | BYOK / GitHub token envelopes (`0x01` / `0x02`) | No |
| AES-256-GCM | `packages/core` school calibration | FERPA forensic baselines | No |
| HMAC-SHA256 | arbitrate/skip audit, education privacy digests, LTI session, webhooks | Integrity under shared secrets | No |
| SHA-256 | HAL v1 `contentSha256`, licenses, IDE tokens, Vault Pact | Digests | No |
| RS256 (RSA JWT) | DocuSign JWT grant, LTI tool assertions | Vendor OAuth / LTI | **Yes — RSA** |
| HS256 JWT | Author BFF sessions | Legacy sessions | No |
| Platform TLS | All HTTPS / WSS | Transit confidentiality | Classical (platform) |

**Not present historically:** Ed25519/X25519 app signing, ECDSA, RSA-PSS, `createSign` for HAL, PQC (until this work).

## 3. Data in transit

- **Pulse:** HTTPS + auth headers (`pulseAuth`); skip-audit HMAC only.
- **Supabase Realtime:** `ws` over WSS; no app-level payload crypto.
- **DocuSign / LTI:** RSA JWTs as required by vendors (out of scope for ML-DSA swap).

## 4. Data at rest (P1–P6 / Supabase)

- Pillar / ledger tables: platform disk encryption; no column TDE in app.
- App ciphertext: credential envelopes; school `p4_forensic_profiles` AES-GCM mode.
- Hybrid `0x03` envelopes when `MSGF_HYBRID_KEM_ENABLED=1`.

## 5. HAL / Chain of Origin

| Version | Integrity | Verifiable without shared secret? |
| :--- | :--- | :--- |
| `human_authorship_certificate.v1` | SHA-256 of JSON | No (recomputable by forger of rows) |
| `human_authorship_certificate.v2` | ML-DSA-65 over RFC 8785 canonical payload (+ Vault Seal / Lore-Git fields) | Yes, with published public key |

Algorithm claim: **ML-DSA-65 (FIPS 204 algorithm family)**. Not a FIPS-validated crypto module unless separately certified.

## 6. Platform PQ-TLS checklist

- [ ] Cloud Run / HTTPS LB: enable hybrid PQ when Google offers it for the region
- [ ] Confirm client (browser / Node) support for negotiated PQ KEMs
- [ ] Upstash / Redis TLS: reject unauthorized CAs in prod
- [ ] Document that app hybrid envelopes complement, not replace, transport TLS

## 7. Implementation map (this delivery)

| Piece | Path |
| :--- | :--- |
| Hybrid KEM + `0x03` wire | `packages/core/src/lib/crypto/hybrid-*.ts` |
| ML-DSA-65 + canonicalize | `packages/core/src/lib/crypto/ml-dsa.ts` |
| CryptoService `0x03` | `packages/msgf/lib/crypto/CryptoService.ts` |
| HAL v2 cert | `apps/author-ecosystem/server/src/lib/AuthorSovereigntyService.ts` |
