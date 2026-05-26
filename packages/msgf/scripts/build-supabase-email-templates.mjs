#!/usr/bin/env node
/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-c103094-20260526T230730Z-internal
 */
/**
 * Regenerate Supabase Auth email HTML from lib/email/branded-auth-email.ts
 *
 * Usage: npm run email:templates:build -w msgf
 * Optional: MSGF_EMAIL_LOGO_URL=https://your-host/brand/elphie-syntax-logo.png
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(pkgRoot, "supabase", "email-templates");

const brandModuleUrl = pathToFileURL(
  path.join(pkgRoot, "lib", "email", "branded-auth-email.ts")
).href;
const { buildBrandedAuthEmail, BRAND_EMAIL_LOGO_URL } = await import(brandModuleUrl);

const templates = [
  {
    html: "confirm-signup.html",
    subject: "confirm-signup-subject.txt",
    subjectText: "Confirm your Elphie Syntax account",
    input: {
      pageTitle: "Confirm your Elphie Syntax account",
      eyebrow: "Welcome to Elphie Syntax",
      headline: "Confirm your account",
      intro:
        "You are one step away from the MSGF glass-box dashboard — visible gates, sovereign AI, and auditable lineage.",
      ctaLabel: "Confirm sign up",
      ctaHref: "{{ .ConfirmationURL }}",
      linkFallback: true,
      footerNote:
        "This confirmation link is for {{ .Email }}. If you did not create an Elphie Syntax account, you can safely ignore this email.",
    },
  },
  {
    html: "magic-link.html",
    subject: "magic-link-subject.txt",
    subjectText: "Your Elphie Syntax sign-in link",
    input: {
      pageTitle: "Sign in to Elphie Syntax",
      eyebrow: "MSGF Gated AI",
      headline: "Your secure sign-in link",
      intro:
        "Use the button below to sign in. This link expires soon and works only once for your security.",
      ctaLabel: "Sign in",
      ctaHref: "{{ .ConfirmationURL }}",
      linkFallback: true,
      footerNote:
        "Requested for {{ .Email }}. If you did not ask to sign in, you can safely ignore this email.",
    },
  },
  {
    html: "reset-password.html",
    subject: "reset-password-subject.txt",
    subjectText: "Reset your Elphie Syntax password",
    input: {
      pageTitle: "Reset your password",
      eyebrow: "Account security",
      headline: "Reset your password",
      intro:
        "We received a request to reset the password for your Elphie Syntax account. Choose a new password using the button below.",
      ctaLabel: "Reset password",
      ctaHref: "{{ .ConfirmationURL }}",
      linkFallback: true,
      footerNote:
        "For {{ .Email }}. If you did not request a reset, ignore this email — your password will not change.",
    },
  },
  {
    html: "invite-user.html",
    subject: "invite-user-subject.txt",
    subjectText: "You are invited to Elphie Syntax",
    input: {
      pageTitle: "Invitation to Elphie Syntax",
      eyebrow: "Team invite",
      headline: "You have been invited",
      intro:
        "Accept the invitation to join an Elphie Syntax workspace with MSGF guardrails, sovereign tenants, and auditable Pulse lineage.",
      ctaLabel: "Accept invitation",
      ctaHref: "{{ .ConfirmationURL }}",
      linkFallback: true,
      footerNote:
        "Invitation for {{ .Email }}. If you were not expecting this invite, you can ignore this message.",
    },
  },
  {
    html: "change-email.html",
    subject: "change-email-subject.txt",
    subjectText: "Confirm your new Elphie Syntax email",
    input: {
      pageTitle: "Confirm email change",
      eyebrow: "Account update",
      headline: "Confirm your new email",
      intro:
        "Confirm this address to complete your email change on Elphie Syntax and MSGF Gated AI.",
      ctaLabel: "Confirm new email",
      ctaHref: "{{ .ConfirmationURL }}",
      linkFallback: true,
      footerNote:
        "Confirming change for {{ .Email }}. If you did not request this update, contact support and ignore the link.",
    },
  },
];

fs.mkdirSync(outDir, { recursive: true });

for (const t of templates) {
  const html = buildBrandedAuthEmail(t.input);
  fs.writeFileSync(path.join(outDir, t.html), html, "utf8");
  fs.writeFileSync(path.join(outDir, t.subject), `${t.subjectText}\n`, "utf8");
  console.log(`[email:templates:build] wrote ${t.html}`);
}

console.log(`[email:templates:build] logo URL: ${BRAND_EMAIL_LOGO_URL}`);
console.log("[email:templates:build] Paste into Supabase Dashboard → Authentication → Emails");
