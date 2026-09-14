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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Elphie's Gated AI | MSGF",
  description:
    "Modular State-Gate Framework — prefrontal cortex for AI with TRI/Grok consensus, Sentry quarantine, DocuSign/Dropbox Sign, and quantum-ready hybrid vault crypto.",
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
      "Prefrontal cortex for AI — TRI CONVERGE, Sentry→Vault, e-sign, quantum-ready envelopes.",
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
