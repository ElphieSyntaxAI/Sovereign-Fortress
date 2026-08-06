/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
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
