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
  title: "MSGF — Gated AI · Brand · Elphie Syntax",
  description:
    "Prefrontal cortex for AI — from IDE to cloud. MSGF V3.2 — Command Center, verify loop, six pillars, and defensible token savings.",
};

export default function Page() {
  return <HomeLanding />;
}
