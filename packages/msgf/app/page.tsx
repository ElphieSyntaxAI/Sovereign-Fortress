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
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */
import { HomeLanding } from "@/app/_components/landing/HomeLanding";

/**
 * `/` — MSGF marketing (logged-out home on elphiesgatedai).
 * Platform chooser lives at elphiesyntax.com (Author client picker).
 * Legacy hub mirror: `/hub` → PlatformHubLanding.
 */
export default function Page() {
  return <HomeLanding />;
}
