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
 * Distribution Build ID: MSGF-2790974-20260519T053954Z-internal
 */
import { PlatformHubLanding } from "@/app/_components/landing/PlatformHubLanding";

/**
 * `/` is the platform chooser hub ("What are you looking for?"). MSGF's own
 * marketing page (the original `HomeLanding`) now lives at `/brain` and stays
 * linked from the MSGF card. Keeps a single deployed URL viable as the
 * "main page" while DNS / Author client deployment catches up.
 */
export default function Page() {
  return <PlatformHubLanding />;
}
