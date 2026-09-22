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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
 */
import { PlatformHubLanding } from "@/app/_components/landing/PlatformHubLanding";

/** Legacy platform chooser — production picker is elphiesyntax.com. */
export default function HubPage() {
  return <PlatformHubLanding />;
}
