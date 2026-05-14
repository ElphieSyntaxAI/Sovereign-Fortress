# Author Ecosystem — Terms & Conditions (source of truth)

Markdown in this folder is the **canonical copy** for Author Ecosystem legal surfaces.

## How updates propagate

1. **Web app (Vite):** `apps/author-ecosystem/client/src/legal/termsRegistry.ts` imports each file with `?raw`. Editing a `.md` file and rebuilding/redeploying updates all UI that consumes `TERMS_DOCUMENTS` / `getTermsDocument`.
2. **BFF (optional consumers):** `GET /api/legal/terms` and `GET /api/legal/terms/:slug` read the same files from disk at runtime (see `server/src/lib/termsRoot.ts`).

## Files

| File | Audience |
|------|----------|
| `author-terms.md` | Authors |
| `editor-helper-terms.md` | Editors & helpers |
| `fan-chronicler-terms.md` | Fans & chroniclers |
| `publisher-legal-terms.md` | Publishers & legal entities |

## Version string

Update **`TERMS_LAST_UPDATED_ISO`** in `client/src/legal/termsRegistry.ts` when counsel publishes a revision (displayed in the Terms UI).

## Related: NDAs

Role-specific **Non-Disclosure Agreements** live in `../nda/` with the same slugs (`author`, `editor`, `fan`, `publisher`). **Registration** requires executing the bilateral **Vault Pact** (`../nda/vault-pact-bilateral.md`) by typing the published attestation phrase; role schedules (Terms + NDA) are incorporated by reference as linked in the registration UI.
