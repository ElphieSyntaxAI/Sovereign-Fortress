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
 * Distribution Build ID: MSGF-149f647f-20260728T230931Z-internal
 */
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Elphie's Gated AI | MSGF",
  description:
    "Modular State-Gate Framework — glass-box sovereign AI with six pillars, dual-model consensus, and auditable lineage.",
  /**
   * Tab favicon comes from `app/icon.png` automatically (Next 15 app-router
   * convention). Adding an `apple-touch-icon` so iOS Add to Home Screen picks
   * up the same brand mark instead of a generated text glyph.
   */
  icons: {
    apple: "/brand/elphie-syntax-logo.png",
  },
  openGraph: {
    title: "Elphie's Gated AI | MSGF",
    description:
      "Glass-box sovereign AI — six pillars, dual-model consensus, auditable lineage.",
    images: [{ url: "/brand/elphie-syntax-logo.png" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
