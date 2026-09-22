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
 * Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
 */
/**
 * `/brain` — MSGF brand / marketing landing.
 *
 * Used to live at `/`; the root is now the cross-product chooser hub
 * (`PlatformHubLanding`). The "MSGF — Gated AI" card and "See the MSGF brand
 * page →" footer link both point here.
 */
import type { Metadata } from "next";

import { HomeLanding } from "@/app/_components/landing/HomeLanding";

export const metadata: Metadata = {
  title: "MSGF — AI gateway · Elphie Syntax",
  description:
    "MSGF is an AI gateway: six policy domains, IDE verify, model routing and consensus, audit console, Session Replay, Sentry quarantine, Workspace SSO, SIEM, and defensible token-cost reporting.",
};

export default function Page() {
  return <HomeLanding />;
}
