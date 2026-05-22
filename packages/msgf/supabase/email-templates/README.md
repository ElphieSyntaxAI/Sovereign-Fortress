# Supabase Auth Email Templates

Hosted Supabase sends auth emails from **Supabase Auth**, not from the Next.js app. Templates are generated in-repo from the shared brand layout, then pasted into the Supabase Dashboard.

## Regenerate HTML (logo + jewel aesthetic)

From monorepo root:

```bash
npm run email:templates:build -w msgf
```

Source: [`lib/email/branded-auth-email.ts`](../../lib/email/branded-auth-email.ts) — obsidian mesh background, emerald + amethyst CTA gradient, glass card, **96px logo** from `/brand/elphie-syntax-logo.png`.

Override logo URL when building (must be **HTTPS** and publicly reachable by Gmail/Outlook):

```bash
MSGF_EMAIL_LOGO_URL=https://elphiesgatedai.elphiesyntax.com/brand/elphie-syntax-logo.png npm run email:templates:build -w msgf
```

Default logo host: `https://elphiesgatedai.elphiesyntax.com` (falls back if env unset).

## Paste into Supabase Dashboard

Path: **Authentication → Emails** — for each template type, set **Subject** and **Body (HTML)**:

| File | Supabase email type |
| :--- | :--- |
| `confirm-signup-subject.txt` + `confirm-signup.html` | Confirm signup |
| `magic-link-subject.txt` + `magic-link.html` | Magic link |
| `reset-password-subject.txt` + `reset-password.html` | Reset password |
| `invite-user-subject.txt` + `invite-user.html` | Invite user |
| `change-email-subject.txt` + `change-email.html` | Change email address |

## Required Auth Settings

**URL Configuration** (Authentication → URL Configuration):

1. **Site URL** — production MSGF URL, e.g. `https://elphiesgatedai.elphiesyntax.com`
2. **Redirect URLs** — include:
   - `https://elphiesgatedai.elphiesyntax.com/auth/callback`
   - `https://msgf-api-bkracxai6q-uc.a.run.app/auth/callback` (Cloud Run, if used)
   - `http://localhost:3000/auth/callback` (local dev)

**Email provider** (Authentication → Providers → Email):

- Enable **Confirm email** for sign-up in production.
- Configure **custom SMTP** (Resend, Postmark, SendGrid, etc.) for reliable delivery; built-in Supabase mail is rate-limited.

## App flow

`AuthForm` uses:

```ts
supabase.auth.signUp({
  email,
  password,
  options: { emailRedirectTo: authCallbackUrl() },
});
```

After sign-up → `/confirm-email?email=...` with **Resend confirmation** via `supabase.auth.resend({ type: "signup", ... })`.

## Brand alignment

Matches MSGF landing tokens in `app/globals.css`: `--color-jewel-emerald`, `--color-jewel-purple`, `.landing-mesh`, `.glass-panel`. Logo matches [`BrandLogo`](../../app/_components/brand/BrandLogo.tsx) → `public/brand/elphie-syntax-logo.png`.
