# MSGF Google Workspace SSO (I3)

Company tenancy via Supabase Google OAuth + `msgf_company_domains` allowlist.

## Enable (ops)

1. Supabase Dashboard → Authentication → Providers → **Google** (client id/secret).
2. Authorized redirect: `https://<MSGF_HOST>/auth/callback`
3. Apply migration `20260724020000_company_domains_signing_provider.sql` if needed.
4. COMPANY_ADMIN adds domains: `POST /api/msgf/workspace/company-domains` `{ "domain": "acme.com" }`

## Env

```
# Optional: hint Google account picker to a Workspace domain
NEXT_PUBLIC_GOOGLE_WORKSPACE_HD=acme.com
# Disable Workspace CTA: MSGF_GOOGLE_WORKSPACE_SSO=0
# Circuit (failures / 5m window):
GOOGLE_SSO_CIRCUIT_FAILURES=5
GOOGLE_SSO_CIRCUIT_WINDOW_SEC=300
# Staging force-open for fallback QA:
GOOGLE_SSO_CIRCUIT_FORCE_OPEN=1
```

## Flow

1. Sign-in → **Continue with Google Workspace** (`AuthForm`)
2. `/auth/callback` → `POST /api/msgf/auth/workspace-sso-complete`
3. Lookup email domain (and `hd` if present) in `msgf_company_domains`
4. Match → attach `p4_profiles.company_id` → portal/dashboard
5. No match / gmail.com → sign out → `/invite-only?reason=…`

Missing `hd` is OK when the email domain is allowlisted.

## Circuit / invite fallback

When OAuth fails repeatedly (or `GOOGLE_SSO_CIRCUIT_FORCE_OPEN=1`), the Workspace button disables and AuthForm shows: use email/password if you already have a team invite.

## Code

- `lib/services/company-domains.ts` — lookup / CRUD helpers
- `lib/services/google-sso-circuit.ts` — circuit + `hd` extract
- `lib/services/workspace-sso.ts` — complete attach
- `app/invite-only/page.tsx`
- `app/api/msgf/auth/workspace-sso-complete/route.ts`
- `app/api/msgf/auth/google-sso-status/route.ts`
