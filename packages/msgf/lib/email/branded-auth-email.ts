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
 * Distribution Build ID: MSGF-c1a5d75-20260723T221428Z-internal
 */
/**
 * Branded transactional email layout — matches MSGF landing aesthetic
 * (obsidian mesh, emerald + amethyst jewel accents, glass panel card).
 *
 * Used by `scripts/build-supabase-email-templates.mjs` to emit HTML for
 * Supabase Dashboard → Authentication → Emails.
 */

/** Production MSGF host — logo must be publicly reachable for email clients. */
export function resolveBrandEmailLogoUrl(): string {
  const explicit = process.env.MSGF_EMAIL_LOGO_URL?.trim();
  if (explicit) return explicit;
  const base =
    process.env.MSGF_PUBLIC_APP_URL?.trim()?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_MSGF_APP_URL?.trim()?.replace(/\/$/, "") ||
    "https://elphiesgatedai.elphiesyntax.com";
  return `${base}/brand/elphie-syntax-logo.png`;
}

export const BRAND_EMAIL_LOGO_URL = resolveBrandEmailLogoUrl();

export const BRAND_EMAIL = {
  bg: "#0a0612",
  card: "#0f172a",
  cardFooter: "#0b1020",
  text: "#e2e8f0",
  textMuted: "#94a3b8",
  textDim: "#64748b",
  emerald: "#6ee7b7",
  emeraldDeep: "#10b981",
  purple: "#a78bfa",
  purpleDeep: "#a855f7",
  border: "rgba(167,139,250,0.28)",
  font:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
} as const;

export type BrandedAuthEmailInput = {
  /** HTML <title> and preheader context */
  pageTitle: string;
  /** Small caps line above headline (e.g. "Welcome to Elphie Syntax") */
  eyebrow: string;
  headline: string;
  intro: string;
  ctaLabel: string;
  /** Supabase Go template token, e.g. `{{ .ConfirmationURL }}` */
  ctaHref: string;
  /** Shown under CTA when link fallback is included */
  linkFallback?: boolean;
  /** Footer note; may include `{{ .Email }}` */
  footerNote: string;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Table-based HTML for Supabase Auth (and other SMTP providers).
 * `ctaHref` is emitted verbatim so Go templates survive the build script.
 */
export function buildBrandedAuthEmail(input: BrandedAuthEmailInput): string {
  const eyebrow = escapeHtml(input.eyebrow);
  const headline = escapeHtml(input.headline);
  const intro = escapeHtml(input.intro);
  const ctaLabel = escapeHtml(input.ctaLabel);
  const footerNote = input.footerNote; // may contain {{ .Email }}
  const pageTitle = escapeHtml(input.pageTitle);
  const logoUrl = escapeHtml(BRAND_EMAIL_LOGO_URL);

  const linkBlock = input.linkFallback
    ? `
                      <p style="margin:20px auto 0; max-width:450px; color:${BRAND_EMAIL.textMuted}; font-size:13px; line-height:1.55;">
                        If the button does not work, copy and paste this link into your browser:
                      </p>
                      <p style="margin:8px auto 0; max-width:500px; word-break:break-all; color:${BRAND_EMAIL.purple}; font-size:12px; line-height:1.55;">
                        ${input.ctaHref}
                      </p>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <title>${pageTitle}</title>
  </head>
  <body style="margin:0; padding:0; background:${BRAND_EMAIL.bg}; color:${BRAND_EMAIL.text}; font-family:${BRAND_EMAIL.font};">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">
      ${intro}
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND_EMAIL.bg}; padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px; border-radius:28px; border:1px solid ${BRAND_EMAIL.border}; background:${BRAND_EMAIL.card}; overflow:hidden;">
            <tr>
              <td style="padding:0; background-color:#090716; background-image:radial-gradient(ellipse 80% 50% at 20% 0%, rgba(16,185,129,0.28), transparent 55%), radial-gradient(ellipse 70% 45% at 88% 12%, rgba(168,85,247,0.32), transparent 50%), linear-gradient(135deg, #090716 0%, #111827 100%);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="center" style="padding:34px 28px 22px;">
                      <img
                        src="${logoUrl}"
                        width="96"
                        height="96"
                        alt="Elphie Syntax"
                        style="display:block; width:96px; height:96px; border-radius:24px; border:1px solid rgba(52,211,153,0.35); background:rgba(16,185,129,0.12); object-fit:contain;"
                      />
                      <div style="margin-top:18px; font-size:11px; letter-spacing:0.26em; text-transform:uppercase; color:${BRAND_EMAIL.emerald}; font-weight:700;">
                        ${eyebrow}
                      </div>
                      <h1 style="margin:12px 0 0; color:#f8fafc; font-size:28px; line-height:1.15; letter-spacing:-0.04em; font-weight:800;">
                        ${headline}
                      </h1>
                      <p style="margin:16px auto 0; max-width:460px; color:#cbd5e1; font-size:15px; line-height:1.65;">
                        ${intro}
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:10px 28px 38px;">
                      <a
                        href="${input.ctaHref}"
                        style="display:inline-block; border-radius:999px; padding:15px 28px; background:linear-gradient(135deg, #047857 0%, ${BRAND_EMAIL.emeraldDeep} 42%, ${BRAND_EMAIL.purpleDeep} 100%); color:#ffffff; text-decoration:none; font-size:15px; font-weight:800; box-shadow:0 18px 38px rgba(16,185,129,0.22);"
                      >
                        ${ctaLabel}
                      </a>${linkBlock}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 28px; background:${BRAND_EMAIL.cardFooter}; border-top:1px solid rgba(148,163,184,0.13);">
                <p style="margin:0; color:${BRAND_EMAIL.textMuted}; font-size:12px; line-height:1.65; text-align:center;">
                  ${footerNote}
                </p>
                <p style="margin:14px 0 0; color:${BRAND_EMAIL.textDim}; font-size:11px; line-height:1.55; text-align:center;">
                  <span style="color:${BRAND_EMAIL.emerald}; font-weight:600;">Elphie Syntax LLC</span>
                  · Glass-box sovereignty · MSGF Gated AI
                </p>
                <p style="margin:10px 0 0; color:${BRAND_EMAIL.textDim}; font-size:10px; line-height:1.5; text-align:center;">
                  <a href="https://elphiesyntax.com" style="color:${BRAND_EMAIL.purple}; text-decoration:none;">elphiesyntax.com</a>
                  ·
                  <a href="https://elphiesgatedai.elphiesyntax.com" style="color:${BRAND_EMAIL.purple}; text-decoration:none;">elphiesgatedai.elphiesyntax.com</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}
