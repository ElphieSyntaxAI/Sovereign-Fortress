# Supabase Auth Email Templates

Hosted Supabase sends sign-up confirmation emails from Supabase Auth, not from the Next.js
application. Keep these templates in-repo, then paste them into the Supabase Dashboard.

## Confirm Sign Up

Dashboard path:

1. Supabase Dashboard -> Authentication -> Emails -> Confirm signup
2. Subject: paste `confirm-signup-subject.txt`
3. Body: paste `confirm-signup.html`
4. Save

## Required Auth Settings

Dashboard path:

1. Supabase Dashboard -> Authentication -> URL Configuration
2. Set **Site URL** to the production MSGF URL, for example:
   `https://msgf-api-bkracxai6q-uc.a.run.app`
3. Add redirect URLs:
   - `https://msgf-api-bkracxai6q-uc.a.run.app/auth/callback`
   - `https://elphiesgatedai.elphiesyntax.com/auth/callback` (when DNS is live)
   - `http://localhost:3000/auth/callback` (local dev)

## Required Delivery Settings

Dashboard path:

1. Supabase Dashboard -> Authentication -> Providers -> Email
2. Enable **Confirm email** for production/test sign-up confirmation.
3. Configure SMTP for reliable delivery. Supabase's built-in sender is rate-limited and may not
   reliably reach personal inboxes during testing.

Recommended SMTP providers: Resend, Postmark, SendGrid, Mailgun, Amazon SES.

## App Flow

`AuthForm` calls:

```ts
supabase.auth.signUp({
  email,
  password,
  options: { emailRedirectTo: "/auth/callback" },
});
```

After sign-up, the user is sent to `/confirm-email?email=...`, and the sign-up form includes a
`Resend confirmation email` action using `supabase.auth.resend({ type: "signup", ... })`.
