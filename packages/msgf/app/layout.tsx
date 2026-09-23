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
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "MSGF | Elphie Syntax",
  description:
    "AI gateway between your applications and the model. MSGF inspects and organizes context so low-quality data does not poison the next prompt.",
  /**
   * Tab favicon comes from `app/icon.png` automatically (Next 15 app-router
   * convention). Adding an `apple-touch-icon` so iOS Add to Home Screen picks
   * up the same brand mark instead of a generated text glyph.
   */
  icons: {
    apple: "/brand/elphie-syntax-logo.png",
  },
  openGraph: {
    title: "MSGF | Elphie Syntax",
    description:
      "AI gateway between your applications and the model. MSGF inspects and organizes context so low-quality data does not poison the next prompt.",
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
