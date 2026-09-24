# Author Vault Pact & Registration

**SSoT for bilateral NDA attestation and atomic Author signup.**  
**Local ports / admin handoff / Hybrid KEM flags:** [`AUTHOR_MSGF_WIRING.md`](../../integrations/technical-specs/AUTHOR_MSGF_WIRING.md)  
**Legal SSOT file:** `apps/author-ecosystem/nda/vault-pact-bilateral.md`

---

## Attestation phrase

Registration (and session bridge renewals that re-assert the pact) require typing exactly:

```text
I SIGN THE VAULT PACT
```

Mismatch → clear error pointing at the phrase (BFF does not accept partial/fuzzy match).

---

## Atomic register

`registerAuthorWithVaultPact` (`server/src/lib/registerAuthorWithVaultPact.ts`):

1. Create Supabase Auth user (outside SQL txn — if RPC fails, Auth user may need cleanup).
2. RPC `register_author_with_vault_pact` writes profile + `legal_attestations` with:
   - Exact phrase
   - `content_hash` = **SHA-256** of Vault Pact markdown (64 hex; schema CHECK)
   - `metadata.vault_pact_md5` for dual-hash parity
3. Optional **Hybrid KEM** seal of the content hash when `MSGF_HYBRID_KEM_ENABLED=1` (`authorHybridSeal.ts`).

Doc slug default: `vault-pact-bilateral` (`PACT_GUARD_DOC_SLUG` override). Middleware: `pactGuard.ts`.

---

## Beta gate

Public picker status is **Foundational testing** — registration is gated behind **`/beta`** waitlist on production. Staging uses the isolated stack for operator smokes; real beta collection stays on production domains (see [`STAGING_AND_RELEASE.md`](../../STAGING_AND_RELEASE.md)).

---

## Session bridge

`authSessionBridge.controller.ts` can require Vault signature on certain flows. MSGF operator → Author SSO: `GET /api/msgf/admin/author-handoff` → `POST /api/auth/msgf-handoff` (wiring doc).

---

## Related

| Concern | Spec / path |
| :--- | :--- |
| Pact markdown | `nda/vault-pact-bilateral.md` + `nda/README.md` |
| Ensure `public.profiles` row | `ensurePublicAuthorProfile.ts` |
| Retailer / HAL export attestation line | `RetailerExportService.ts` |
