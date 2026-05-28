# MSGF Refactoring Directive — Core Website Modernization

Use with `GET /api/msgf/agent-context?mode=guided&refactor_profile=website_modernization` (planned).

## 1. Target scope

- **Focus:** `packages/msgf/app/_components/`, `packages/msgf/app/**/page.tsx` (marketing, dashboard shell, workspace).
- **Deny:** `middleware.ts`, `lib/services/*`, `app/api/**`, `supabase/migrations/**`.

## 2. Technical goals

- Functional components, memoization where arrays scale.
- Strict TypeScript; guard clauses at handler entry.
- **Do not** change global CSS/Tailwind tokens unless requested.

## 3. Constraints

- No new npm dependencies.
- Do not modify multi-tenant middleware, RLS, or credit guard.

## 4. Mandatory workflow

Output **Remediation Step Plan** only (no code) until user confirms:

1. Files to create/modify/delete.
2. Propagation to parent routes.
3. Validation: `npm run validate:deployment`, `npm run build -w msgf`.

**Terminology:** “Code drift” here ≠ MSGF `logic_drift_score` (Pulse metric).
