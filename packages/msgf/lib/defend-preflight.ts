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
 * DEFEND / Vault-Hall preflight aliases.
 *
 * Canonical implementation remains in `lib/msgf-shadow.ts` (historical name).
 * Prefer importing from this module for new code to avoid colliding with
 * Shadow Proxy (`x-msgf-mode: shadow`) and Passive IDE Scan.
 */

export {
  preFlightCheck as runDefendPreflight,
  preFlightCheck,
  type ShadowTier as DefendTier,
  type ShadowPulse as DefendPreflightPulse,
  type ShadowPreflightResult as DefendPreflightResult,
  type ShadowPreflightResult as DefendPreflightCheck,
  type ShadowPreflightOptions as DefendPreflightOptions,
  type ShadowTier,
  type ShadowPulse,
  type ShadowPreflightResult,
  type ShadowPreflightOptions,
} from "@/lib/msgf-shadow";
