# MSGF Signing (DocuSign + Dropbox Sign)

Provider-agnostic policy sign-off for team invites (`enforce_docusign` bundle flag).

## Providers

| Provider | Env | Webhook |
| :--- | :--- | :--- |
| DocuSign (default) | `DOCUSIGN_*`, `MSGF_DOCUSIGN_CONNECT_SECRET` | `POST /api/msgf/ops/docusign-webhook` or `POST /api/msgf/ops/signing-webhook?provider=docusign` |
| Dropbox Sign | `DROPBOX_SIGN_API_KEY`, `DROPBOX_SIGN_WEBHOOK_SECRET` | `POST /api/msgf/ops/dropbox-sign-webhook` or `POST /api/msgf/ops/signing-webhook?provider=dropbox_sign` |

Company override: `msgf_companies.signing_provider` (`docusign` \| `dropbox_sign`).  
Env default: `SIGNING_PROVIDER=docusign|dropbox_sign`.

## Mock QA

```
MSGF_SIGNING_MOCK=1
# or legacy:
MSGF_DOCUSIGN_MOCK=1
```

Mock-complete (signed-in invitee):

`POST /api/msgf/workspace/docusign/mock-complete`  
Body: `{ "invite_id": "<uuid>", "provider": "docusign"|"dropbox_sign" }`

Sets envelope `completed`, invite `onboarding_status=APPROVED`, `p4_profiles.account_status=active`.

## Idempotency + archive queue (I5)

Webhooks claim `msgf_webhook_inbox.idempotency_key` (`provider:request_id:event`) before completing.

- Replay → `duplicate: true`, no second APPROVED transition
- After APPROVED → enqueue `dropbox-archive` (Redis list, or memory fail-open)
- Redis down → `archive_status=pending_local` (IDE mint still unlocked)
- Drain: `POST /api/msgf/ops/archive-worker` with `Authorization: Bearer $MSGF_OPS_CRON_SECRET`
- Backlog: `GET /api/msgf/ops/archive-worker`

Live Dropbox PDF upload is **I4**; I5 ships queue + mock archive worker.

## Dropbox archive (I4)

```
MSGF_DROPBOX_ARCHIVE_MOCK=1
DROPBOX_ARCHIVE_ROOT=/MSGF-Audit
DROPBOX_ACCESS_TOKEN=   # live only
```

- Mock writes `tmp/dropbox-archive/<company>/<yyyy>/<invite>/signed.pdf` + `audit.json`
- Company override: `msgf_companies.dropbox_archive_path` via Team readiness panel
- Worker: `POST /api/msgf/ops/archive-worker`

## Flow

1. Invite with `enforce_docusign: true` → profile `pending_signatures`, invite `PENDING_SIGNATURE`, envelope `sent`.
2. Signer completes provider UI (or mock-complete).
3. Webhook → `completeSigningEnvelope` → IDE mint unlocked (`getComplianceStatus.is_locked` false).

## Code

- `lib/services/signing/SigningProvider.ts`
- `lib/services/signing/DocuSignSigningProvider.ts`
- `lib/services/signing/DropboxSignSigningProvider.ts`
- `lib/services/signing/resolveSigningProvider.ts`
- `lib/services/signing/createSigningEnvelopeForInvite.ts`
- `lib/services/signing/completeSigningEnvelope.ts`
