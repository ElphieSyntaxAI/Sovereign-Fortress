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
export const CURRENT_LEGAL_VERSION = "2026.05.05-UTAH-SAFE";

export const PLATFORM_PLEDGE = {
  version: CURRENT_LEGAL_VERSION,
  guarantees: [
    "Zero-Training: Data will never be used to train Elphie Syntax or Partner models.",
    "Human-in-the-Loop: No 'RED' tier logic flags without human audit.",
    "Data Sovereignty: All P4 keystroke data is purged 30 days after session close.",
    "Compliance Retention: msgf_prompt_sessions (Session Replay / harm ledger) are exempt from the 30-day keystroke purge and are retained for legal and security review.",
  ],
  signedBy: "Elphie Syntax LLC - Systems Integrity Unit"
} as const;

/** Short copy for tenant settings / Session Replay UI. */
export const PROMPT_SESSION_RETENTION_NOTICE =
  "Harm recommendation and Session Replay records (msgf_prompt_sessions) are retained for legal and security review and are not deleted by the 30-day keystroke / HAL purge.";

