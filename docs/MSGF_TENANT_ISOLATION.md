# MSGF Tenant Isolation (A4)

**Invariant:** `service_role` Pulse / admin paths **bypass RLS**. Compound scope must be enforced in **app-layer** filters on every Vault/Hall read that can return another project's wins.

## Scope keys (metadata JSONB)

| Key | Source | Required? |
| :--- | :--- | :--- |
| `tenant_id` | IDE tenantKey / license silo | **Always** |
| `company_id` | `p4_profiles.company_id` (UUID) | When company tenancy active |
| `project_origin` | Mapped repo / monorepo tag | When IDE sends it |
| `subpath_hash` | `sha256(normalize(path)).slice(0,16)` | When IDE sends file/dir |
| `file_path` | Original path (audit) | Optional companion to hash |

Helpers:

- `lib/services/vector-scope-key.ts` — `normalizePathForScope`, `computeSubpathHash`
- `lib/services/msgf-metadata-scope.ts` — `withMsgfMetadataScope` stamps hash on writes
- `lib/services/tenant-query-scope.ts` — `applyPillarVectorsCompoundScopeFilter`, `filterPillarRowsByCompoundScope`

## Write path

SWEEP ingest and Vault/Hall persist (`buildVaultHallMetadata` / `buildIngestMetadata`) stamp `project_origin` + `subpath_hash` when path is known.

## Read path

When the client provides `project_origin` and/or a path:

1. PostgREST `.eq` on matching metadata keys
2. Post-read `filterPillarRowsByCompoundScope` (defense-in-depth)

Wrong `project_origin` → empty result set.

## RLS note

`msgf_tenant_row_allowed` still keys primarily on `tenant_id`. Do **not** rely on RLS alone for company/project/path isolation under `service_role`.

## Index

Migration `20260724030000_pillar_vectors_compound_scope.sql` — composite expression index on metadata keys.
