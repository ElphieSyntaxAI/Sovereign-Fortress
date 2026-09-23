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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
export const CURRENT_LEGAL_VERSION = "2026.09.18-UTAH-SAFE";

export const PLATFORM_PLEDGE = {
  version: CURRENT_LEGAL_VERSION,
  guarantees: [
    "Zero-Training: Prompts, outputs, and sensitive application data are never used to train Elphie Syntax or partner models.",
    "Zero-Text Global Brain: Swarm and Global Brain safety telemetry is structural only (cause codes, latency, token consumption, hashed mandate, graph topology) — never raw user text.",
    "Synthetic Benchmarks: Any research benchmarks published or licensed by MSGF rely exclusively on anonymized, synthetically generated structural test cases.",
    "Human-in-the-Loop: No 'RED' tier logic flags without human audit.",
    "Data Sovereignty: All P4 keystroke data is purged 30 days after session close.",
    "Compliance Retention: msgf_prompt_sessions (Session Replay / harm ledger) are tenant legal/security records, exempt from the 30-day keystroke purge, not a training corpus, and not the Global Brain feed.",
  ],
  signedBy: "Elphie Syntax LLC - Systems Integrity Unit"
} as const;

/** Short copy for tenant settings / Session Replay UI. */
export const PROMPT_SESSION_RETENTION_NOTICE =
  "Harm recommendation and Session Replay records (msgf_prompt_sessions) are retained for legal and security review, are not used to train models, are not the Global Brain feed, and are not deleted by the 30-day keystroke / HAL purge.";

