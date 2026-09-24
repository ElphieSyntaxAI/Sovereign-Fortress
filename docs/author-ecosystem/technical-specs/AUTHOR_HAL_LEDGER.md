# Author HAL Ledger

**SSoT for Human Authorship Ledger telemetry on Author Ecosystem.**  
**Pulse bridge / headers:** [`AUTHOR_MSGF_WIRING.md`](../../integrations/technical-specs/AUTHOR_MSGF_WIRING.md)  
**PQC cert (optional):** [`MSGF_PQC_CRYPTO_AUDIT.md`](../../msgf/technical-specs/MSGF_PQC_CRYPTO_AUDIT.md)  
**Product lexicon:** HAL Ledger in [`AUTHOR_ECOSYSTEM_ROADMAP.md`](../AUTHOR_ECOSYSTEM_ROADMAP.md)

---

## Purpose

Capture biometric / interaction evidence (keystroke rhythm, content delta, locale/IME) so authorship claims are defensible (“Chain of Origin”). HAL is **not** training data and is not Global Brain export content.

---

## Live path

1. Client or **Chrome extension** posts session / chunk events to Author BFF.
2. BFF validates manuscript tenant session, runs tamper checks, scores linguistics + rhythm.
3. Persists to `p4_hal_ledger` (+ rolling-5 baseline helpers).
4. When `MSGF_AUTHOR_HAL_PULSE_ENABLED=1`, syncs ~175w chunks to MSGF Pulse with Author HAL headers (`x-msgf-author-hal`, tenant slug `author_ecosystem`).

Primary routes live on `hal.controller.ts`:

| Route family | Role |
| :--- | :--- |
| Session / chunk-pulse | Live typing + content delta → ledger + optional MSGF |
| Offline lease / renew / resync | Sealed batch when Docs/Word is offline |
| Tamper / DNA | Keystroke DNA events + anomaly thresholds |

---

## Offline sealed batch

- Issue lease → author works offline → seal batch → `acceptHalOfflineResync`.
- Implementation: `halOfflineSeal.ts`, `halOfflineResync.ts`, tests in `halOfflineSealed.test.ts`.
- Tamper suite: `halTamperChecks.ts` (HTTP status mapped per failure class).

---

## Scoring notes

| Input | Effect |
| :--- | :--- |
| Keystroke latencies / DNA events | Rhythm anomaly vs locale baseline |
| Content delta | Stylometric factors |
| Locale `en` \| `es` \| `ja` | IME relax for `ja`; calibration thresholds |
| Rolling-5 baseline | Linguistic match factor vs tenant history |
| `identityRoot` | Marks tenant typing baseline row |

Helpers: `halMetrics.ts`, `halLinguisticFactor.ts`, `halDnaEvents.ts`.

---

## Env

| Variable | Purpose |
| :--- | :--- |
| `MSGF_AUTHOR_HAL_PULSE_ENABLED` | Forward chunks to MSGF |
| `MSGF_AUTHOR_PULSE_LICENSE_KEY` | Required for Pulse |
| `MSGF_AUTHOR_DEV_SESSION` | Dev session counters on Pulse |
| `MSGF_HAL_PQC_SIGN` | ML-DSA-65 HAL v2 certificate bundles when enabled |
| `BFF_CHROME_EXTENSION_ID` | Extension origin allowlist (when set) |

---

## Extension surface

`apps/author-ecosystem/extension` — FAB on Docs/Word Online, dashboard deep-links prefer MSGF token-savings URLs when BFF reports `msgf_mapping.dashboard_links`. See extension README for install / permissions.
