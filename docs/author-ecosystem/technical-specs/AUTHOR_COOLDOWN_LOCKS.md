# Author Cool-Down & Revision Locks

**SSoT for manuscript lock tiers, status machine, and unlock → MSGF verify-result.**  
**Product lexicon:** Cool Down Lock / Bicameral Audit in [`AUTHOR_ECOSYSTEM_ROADMAP.md`](../AUTHOR_ECOSYSTEM_ROADMAP.md)  
**MSGF verify / gateway:** [`AUTHOR_MSGF_WIRING.md`](../../integrations/technical-specs/AUTHOR_MSGF_WIRING.md)

---

## Implementation lock tiers

Code uses **`4w` / `6w` / `8w`** on `p4_manuscripts.lock_tier` (`RevisionLockService.ts`). Product copy in the roadmap still mentions 2/4/6 weeks in places — **engineering SSOT is 4/6/8 weeks** until product + pricing converge.

| `LockTier` | Duration |
| :--- | :--- |
| `4w` | 4 × 7 days |
| `6w` | 6 × 7 days |
| `8w` | 8 × 7 days |

Unlock = `lock_expires_at` reached (or operator release path) → status transitions; unlock posts MSGF **`verify-result`** where wired.

---

## Revision status (DB)

```text
DRAFTING → LOCKED → AUDITING → AUDITING_COMPLETE / READY_FOR_EDITOR
         ↘ COOLDOWN_LOCKED (planning-sync / apprentice-guild gate; often 24h)
```

| Status | Meaning |
| :--- | :--- |
| `DRAFTING` | Editable WIP |
| `LOCKED` | Cool-down active; `lock_expires_at` + `lock_tier` set |
| `AUDITING` | Librarian / Critic (or queue) running |
| `AUDITING_COMPLETE` | Report available (`p4_audit_queue` / dashboard) |
| `READY_FOR_EDITOR` | Human editor path |
| `COOLDOWN_LOCKED` | Separate short gate (e.g. planning sync) — not the multi-week lock |

Client also reads `cooldown_revision_status` for **Vault Cooling** UI (`CoolDownLock.tsx`). Treat editorial `revision_status` and cooldown fields as related but not identical.

Roadmap target vocabulary (`STATE_SOVEREIGN`, `STATE_COOLDOWN`, …) maps onto these rows over time; do not rename DB enums prematurely.

---

## Gates

- `RevisionGateMiddleware.ts` — blocks mutating routes while locked; resolves Apprentice / Guild tier for subsidized paths.
- `RevisionAuditService.ts` — bicameral / Librarian logic revision; rigor buckets follow cooldown duration (4w/6w/8w).
- `AuditQueueProcessor.ts` — advances queue → `AUDITING_COMPLETE`.

---

## Key files

| File | Role |
| :--- | :--- |
| `RevisionLockService.ts` | Apply / release lock; tier ms map |
| `RevisionAuditService.ts` | Semantic audit + schedule on cooldown |
| `RevisionGateMiddleware.ts` | HTTP gates |
| `CoolDownLock.tsx` | Client vault-cooling UX |
| `CreativeManuscriptShell.tsx` | Remount / disable when locked |
