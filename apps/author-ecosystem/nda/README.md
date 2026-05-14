# Author Ecosystem — Non-Disclosure Agreements (source of truth)

Markdown in this folder is the **canonical NDA copy** for the same role lanes as Terms (`author`, `editor`, `fan`, `publisher`), plus the **bilateral Vault Pact** between Platform Architect and Sovereign Author.

## Propagation (same pattern as `../terms/`)

1. **Web:** `client/src/legal/ndaRegistry.ts` imports role NDAs with `?raw` via Vite alias `@nda`. The Vault Pact is additionally bundled in `client/src/legal/vaultPactRegistry.ts` from `vault-pact-bilateral.md`.
2. **BFF:** `GET /api/legal/vault-pact`, `GET /api/legal/nda`, and `GET /api/legal/nda/:slug` read from disk (`server/src/lib/ndaRoot.ts`).
3. **Registration:** BFF `POST /api/auth/register` requires an exact **`vault_pact_signature`** matching the published attestation phrase (see `client/src/legal/vaultPactAttestation.ts` and `server/src/lib/vaultPactAttestation.ts`).

Update **`NDA_LAST_UPDATED_ISO`** in `ndaRegistry.ts` and `legalNda.controller.ts` when counsel publishes a revision to role NDAs. Update **`VAULT_PACT_LAST_UPDATED_ISO`** in `vaultPactRegistry.ts` and `legalNda.controller.ts` when the bilateral pact changes.

## Files

| File | Audience |
|------|----------|
| `vault-pact-bilateral.md` | **Vault Seal** — bilateral ElphieSyntax ↔ Author NDA & data sovereignty (registration attestation) |
| `author-nda.md` | Authors |
| `editor-helper-nda.md` | Editors & helpers |
| `fan-chronicler-nda.md` | Fans & chroniclers |
| `publisher-legal-nda.md` | Publishers & legal entities |
