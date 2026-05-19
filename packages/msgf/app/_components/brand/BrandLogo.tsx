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
 * Distribution Build ID: MSGF-2b663b7-20260519T155850Z-internal
 */
/**
 * Single source of truth for the Elphie Syntax brand mark used in MSGF chrome
 * (LandingNav, DashboardNav, PlatformHubLanding, favicon slots, etc.).
 *
 * Source PNG lives at `packages/msgf/public/brand/elphie-syntax-logo.png` so any
 * Cloud Run / Vercel deploy serves it directly from `/brand/elphie-syntax-logo.png`.
 * We use `unoptimized` so the browser loads that static URL — no dependency on the
 * `/_next/image` optimizer (avoids extra sharp/runtime work in minimal containers).
 */
import Image from "next/image";

type Props = {
  /** Rendered size in CSS pixels (logo is square). */
  size?: number;
  /** Extra wrapper classes (e.g. ring + bg tint). */
  className?: string;
  /** Override accessible label if used outside a Link with adjacent text. */
  alt?: string;
  /** Hide from AT when there's adjacent text (typical nav lockup). */
  decorative?: boolean;
  /** Set to true on the very first hero/nav for LCP priority. */
  priority?: boolean;
};

export const BRAND_LOGO_SRC = "/brand/elphie-syntax-logo.png";
const BRAND_LOGO_ALT = "Elphie Syntax";

export function BrandLogo({
  size = 36,
  className,
  alt,
  decorative = false,
  priority = false,
}: Props) {
  return (
    <span
      className={
        "flex shrink-0 items-center justify-center overflow-hidden rounded-xl " +
        (className ?? "")
      }
      style={{ width: size, height: size }}
      aria-hidden={decorative ? true : undefined}
    >
      <Image
        src={BRAND_LOGO_SRC}
        alt={decorative ? "" : alt ?? BRAND_LOGO_ALT}
        width={size}
        height={size}
        priority={priority}
        unoptimized
        sizes={`${size}px`}
        style={{ width: size, height: size, objectFit: "contain" }}
      />
    </span>
  );
}
