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
 * Distribution Build ID: MSGF-1013d7a-20260522T022234Z-internal
 */
export type AdminSurfaceLink = {
  label: string;
  href: string;
  description?: string;
  external?: boolean;
};

export type AdminLaunchButton = {
  label: string;
  href: string;
  external?: boolean;
};

export type AdminProductSurface = {
  id: "msgf" | "author" | "education";
  title: string;
  eyebrow: string;
  summary: string;
  tone: "emerald" | "amethyst" | "topaz";
  /** Primary CTA — open the app for operator testing. */
  testLaunch: AdminLaunchButton;
  /** Secondary CTA — local Vite/BFF stack. */
  localTestLaunch?: AdminLaunchButton;
  production: AdminSurfaceLink[];
  localDev: AdminSurfaceLink[];
  msgfHosted?: AdminSurfaceLink[];
  detailHref: string;
};

function trimUrl(raw: string | undefined): string | null {
  const s = raw?.trim();
  return s || null;
}

function joinPath(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Resolve operator test URLs for the three customer-facing surfaces.
 * Production URLs come from env; local dev uses monorepo defaults (see docs/MONOREPO_PRODUCTS.md).
 */
function preferLocalAuthorInDev(
  prod: AdminLaunchButton,
  local: AdminLaunchButton
): { testLaunch: AdminLaunchButton; localTestLaunch: AdminLaunchButton } {
  if (process.env.NODE_ENV === "development") {
    return { testLaunch: local, localTestLaunch: prod };
  }
  return { testLaunch: prod, localTestLaunch: local };
}

export function getAdminProductSurfaces(): AdminProductSurface[] {
  const msgfProd =
    trimUrl(process.env.MSGF_APP_URL) ||
    trimUrl(process.env.NEXT_PUBLIC_MSGF_APP_URL) ||
    "https://elphiesgatedai.elphiesyntax.com";
  const msgfLocal = trimUrl(process.env.MSGF_LOCAL_DEV_URL) || "http://127.0.0.1:3000";

  const authorProd =
    trimUrl(process.env.AUTHOR_APP_URL) ||
    trimUrl(process.env.NEXT_PUBLIC_AUTHOR_APP_URL) ||
    "https://authorecosystem.elphiesyntax.com";
  const authorLocalClient =
    trimUrl(process.env.AUTHOR_CLIENT_DEV_URL) || "http://127.0.0.1:5173";
  const authorLocalBff =
    trimUrl(process.env.AUTHOR_ECOSYSTEM_URL) ||
    trimUrl(process.env.AUTHOR_BFF_URL) ||
    "http://127.0.0.1:3002";

  const educationProd =
    trimUrl(process.env.EDUCATION_APP_URL) ||
    trimUrl(process.env.NEXT_PUBLIC_EDUCATION_APP_URL) ||
    "https://syntaxeducates.elphiesyntax.com";
  const educationLocal =
    trimUrl(process.env.EDUCATION_LOCAL_DEV_URL) || "http://127.0.0.1:5175";
  const educationTeacherProd =
    trimUrl(process.env.EDUCATION_TEACHER_DASHBOARD_URL) ||
    joinPath(educationProd, "/teacher");

  return [
    {
      id: "msgf",
      eyebrow: "Brain · Engine",
      title: "MSGF — Gated AI",
      summary: "Ops dashboard, pillar health, incidents, and education APIs hosted on this app.",
      tone: "emerald",
      detailHref: "/products/msgf",
      testLaunch: { label: "Open ops dashboard", href: "/admin/dashboard" },
      localTestLaunch: { label: "MSGF dev (localhost)", href: msgfLocal, external: true },
      production: [
        { label: "MSGF console (prod)", href: msgfProd, external: true },
        { label: "Governance dashboard", href: "/dashboard" },
        { label: "Operator dashboard", href: "/admin/dashboard" },
      ],
      localDev: [
        { label: "MSGF dev server", href: msgfLocal, external: true },
        { label: "System status", href: "/status" },
        { label: "Audit log (tenant guard demo)", href: "/audit-log" },
      ],
      msgfHosted: [
        {
          label: "Education curriculum catalog API",
          href: "/api/msgf/education/admin/curriculum-catalog",
          description: "GET with admin session + tenant headers",
        },
      ],
    },
    {
      id: "author",
      eyebrow: "Creative Integrity Flywheel",
      title: "Author Ecosystem",
      summary:
        "Author BFF + Vite client. Sign in with the same Supabase project when MSGF_AUTH_COOKIE_DOMAIN is aligned.",
      tone: "amethyst",
      detailHref: "/products/author",
      ...preferLocalAuthorInDev(
        {
          label: "Open Author Ecosystem (prod)",
          href: authorProd,
          external: true,
        },
        {
          label: "Open Author Ecosystem (localhost)",
          href: authorLocalClient,
          external: true,
        }
      ),
      production: [
        { label: "Author app (prod)", href: authorProd, external: true },
        { label: "Product roadmap", href: "/products/author" },
      ],
      localDev: [
        {
          label: "Author client (Vite)",
          href: authorLocalClient,
          external: true,
          description: "npm run dev in apps/author-ecosystem/client",
        },
        {
          label: "Author BFF",
          href: authorLocalBff,
          external: true,
          description: "npm run dev in apps/author-ecosystem/server",
        },
        {
          label: "Probe Author ↔ MSGF",
          href: "/products/author",
          description: "See packages/msgf/scripts/probe-author-ecosystem.mjs",
        },
      ],
    },
    {
      id: "education",
      eyebrow: "K–12 · LTI · Utah-aware",
      title: "Syntax Education",
      summary:
        "syntax-educates Vite app: student sandbox, teacher dashboard, and MSGF education routes on this host.",
      tone: "topaz",
      detailHref: "/products/education",
      testLaunch: {
        label: "Open Syntax Education",
        href: educationProd,
        external: true,
      },
      localTestLaunch: {
        label: "Local sandbox (localhost)",
        href: joinPath(educationLocal, "/sandbox"),
        external: true,
      },
      production: [
        { label: "Education app (prod)", href: educationProd, external: true },
        { label: "Teacher dashboard (prod)", href: educationTeacherProd, external: true },
        { label: "Product roadmap", href: "/products/education" },
      ],
      localDev: [
        {
          label: "Local app — Sandbox",
          href: joinPath(educationLocal, "/sandbox"),
          external: true,
          description: "npm run dev in apps/syntax-educates (port 5175)",
        },
        {
          label: "Local app — Teacher",
          href: joinPath(educationLocal, "/teacher"),
          external: true,
        },
        {
          label: "Local app — Login",
          href: joinPath(educationLocal, "/login"),
          external: true,
        },
      ],
      msgfHosted: [
        {
          label: "Socratic tutor API",
          href: "/api/msgf/education/socratic-tutor",
          description: "POST · session + tenant",
        },
        {
          label: "Reading gate API",
          href: "/api/msgf/education/student/reading-gate",
          description: "POST · student workspace",
        },
      ],
    },
  ];
}
