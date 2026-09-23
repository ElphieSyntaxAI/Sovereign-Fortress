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
 * Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
 */
import Link from "next/link";

import type { AdminLaunchButton, AdminProductSurface } from "@/lib/admin-product-surfaces";

const TONE_RING: Record<AdminProductSurface["tone"], string> = {
  emerald: "border-emerald-500/25",
  amethyst: "border-violet-500/25",
  topaz: "border-amber-500/25",
};

const TONE_EYEBROW: Record<AdminProductSurface["tone"], string> = {
  emerald: "text-emerald-300/85",
  amethyst: "text-violet-300/85",
  topaz: "text-amber-300/85",
};

const TONE_PRIMARY_BTN: Record<AdminProductSurface["tone"], string> = {
  emerald:
    "border-emerald-500/40 bg-emerald-500/20 text-emerald-50 hover:bg-emerald-500/30",
  amethyst:
    "border-violet-500/40 bg-violet-500/20 text-violet-50 hover:bg-violet-500/30",
  topaz: "border-amber-500/40 bg-amber-500/20 text-amber-50 hover:bg-amber-500/30",
};

const TONE_SECONDARY_BTN: Record<AdminProductSurface["tone"], string> = {
  emerald:
    "border-emerald-500/25 text-emerald-200/90 hover:border-emerald-400/40 hover:bg-emerald-500/10",
  amethyst:
    "border-violet-500/25 text-violet-200/90 hover:border-violet-400/40 hover:bg-violet-500/10",
  topaz:
    "border-amber-500/25 text-amber-200/90 hover:border-amber-400/40 hover:bg-amber-500/10",
};

function launchDestinationLabel(href: string): string {
  try {
    const u = new URL(href, "http://localhost");
    return u.host + (u.pathname !== "/" ? u.pathname : "");
  } catch {
    return href;
  }
}

function LaunchButton({
  launch,
  tone,
  variant,
}: {
  launch: AdminLaunchButton;
  tone: AdminProductSurface["tone"];
  variant: "primary" | "secondary";
}) {
  const className = `inline-flex w-full flex-col items-center justify-center gap-0.5 rounded-full border px-4 py-2.5 text-sm font-semibold transition sm:w-auto ${
    variant === "primary" ? TONE_PRIMARY_BTN[tone] : TONE_SECONDARY_BTN[tone]
  }`;
  const dest = launchDestinationLabel(launch.href);

  const inner = (
    <>
      <span className="inline-flex items-center gap-2">
        {launch.label}
        <span aria-hidden>{launch.external ? "↗" : "→"}</span>
      </span>
      <span className="text-[10px] font-normal opacity-80">{dest}</span>
    </>
  );

  if (launch.external) {
    return (
      <a href={launch.href} target="_blank" rel="noreferrer noopener" className={className}>
        {inner}
      </a>
    );
  }

  return (
    <Link href={launch.href} className={className}>
      {inner}
    </Link>
  );
}

function LinkList({ links }: { links: AdminProductSurface["production"] }) {
  if (links.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1.5">
      {links.map((link) => (
        <li key={`${link.label}-${link.href}`}>
          {link.external ? (
            <a
              href={link.href}
              target="_blank"
              rel="noreferrer noopener"
              className="text-sm font-medium text-slate-200 underline-offset-4 hover:text-white hover:underline"
            >
              {link.label} ↗
            </a>
          ) : (
            <Link
              href={link.href}
              className="text-sm font-medium text-slate-200 underline-offset-4 hover:text-white hover:underline"
            >
              {link.label}
            </Link>
          )}
          {link.description ? (
            <p className="text-xs text-slate-500">{link.description}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function SurfaceCard({ surface }: { surface: AdminProductSurface }) {
  return (
    <article
      className={`glass-panel flex flex-col gap-4 rounded-2xl border p-5 ${TONE_RING[surface.tone]}`}
    >
      <header className="space-y-1">
        <p
          className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${TONE_EYEBROW[surface.tone]}`}
        >
          {surface.eyebrow}
        </p>
        <h3 className="text-lg font-bold text-slate-50">{surface.title}</h3>
        <p className="text-sm text-slate-400">{surface.summary}</p>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <LaunchButton launch={surface.testLaunch} tone={surface.tone} variant="primary" />
        {surface.localTestLaunch ? (
          <LaunchButton launch={surface.localTestLaunch} tone={surface.tone} variant="secondary" />
        ) : null}
      </div>

      {surface.id === "author" ? (
        <p className="rounded-lg border border-violet-500/30 bg-violet-950/25 px-3 py-2 text-xs text-slate-400">
          <strong className="text-violet-100">Author dashboard</strong> uses SSO handoff: your MSGF
          sign-in is copied to the Author BFF (port 3002), then you land on{" "}
          <code className="text-violet-200">/home</code> or{" "}
          <code className="text-violet-200">/admin</code>. Use the same host (
          <code className="text-violet-200">127.0.0.1</code>, not{" "}
          <code className="text-violet-200">localhost</code>) as Docker dev.
        </p>
      ) : null}
      {surface.id === "education" ? (
        <p className="rounded-lg border border-slate-600/40 bg-slate-900/40 px-3 py-2 text-xs text-slate-400">
          Opens <code className="text-violet-200">syntaxeducates.elphiesyntax.com</code> (separate
          Vite app). MSGF operator sign-in remains on this host.
        </p>
      ) : null}

      <details className="group text-sm">
        <summary className="cursor-pointer list-none text-xs font-medium text-slate-500 hover:text-slate-300 [&::-webkit-details-marker]:hidden">
          More links
          <span className="ml-1 text-slate-600 group-open:hidden">▾</span>
          <span className="ml-1 hidden text-slate-600 group-open:inline">▴</span>
        </summary>
        <div className="mt-3 space-y-4 border-t border-slate-700/40 pt-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Production / hosted
            </p>
            <LinkList links={surface.production} />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Local dev
            </p>
            <LinkList links={surface.localDev} />
          </div>
          {surface.msgfHosted && surface.msgfHosted.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                MSGF APIs (this host)
              </p>
              <LinkList links={surface.msgfHosted} />
            </div>
          ) : null}
        </div>
      </details>

      <footer className="mt-auto border-t border-slate-700/30 pt-3">
        <Link
          href={surface.detailHref}
          className="text-xs text-slate-500 hover:text-slate-300 hover:underline"
        >
          Find out more (roadmap) →
        </Link>
      </footer>
    </article>
  );
}

type Props = {
  surfaces: AdminProductSurface[];
};

export function AdminProductLauncher({ surfaces }: Props) {
  return (
    <section
      aria-label="Admin product launcher"
      className="glass-panel rounded-2xl border border-violet-500/20 p-5 sm:p-6"
    >
      <div className="mb-5 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-300/90">
          Operator portal · Prelaunch testing
        </p>
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
          <span className="text-gradient-jewel">Launch Author & Syntax Education</span>
        </h2>
        <p className="max-w-3xl text-sm text-slate-400">
          Author and Syntax Education open on their <strong className="text-slate-200">own
          subdomains</strong> (<code className="text-violet-200">authorecosystem.elphiesyntax.com</code>
          , <code className="text-violet-200">syntaxeducates.elphiesyntax.com</code>) — that is
          correct. MSGF stays on <code className="text-violet-200">elphiesgatedai.elphiesyntax.com</code>.
          Buttons show the destination host. Use <strong className="text-slate-200">localhost</strong>{" "}
          only after you start the local dev servers on your machine.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {surfaces.map((s) => (
          <SurfaceCard key={s.id} surface={s} />
        ))}
      </div>
    </section>
  );
}
