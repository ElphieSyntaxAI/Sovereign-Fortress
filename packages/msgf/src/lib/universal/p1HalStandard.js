"use strict";
/**
 * Universal **P1 — HAL** contract (telemetry-only). Normative human doc: `../../.msgf/P1_HAL.md`.
 * Do not import Author Ecosystem–specific types here — this module is the MSGF-side universal envelope.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.P1_FORBIDDEN_AUTHOR_SPECIFIC_KEYS = exports.P1_HAL_PILLAR_ID = void 0;
exports.assertP1UniversalNonPolluted = assertP1UniversalNonPolluted;
exports.toUniversalP1PulseBody = toUniversalP1PulseBody;
exports.P1_HAL_PILLAR_ID = "P1_HAL";
/** Keys that must never appear on payloads forwarded into MSGF universal verification. */
exports.P1_FORBIDDEN_AUTHOR_SPECIFIC_KEYS = [
    "book_title",
    "bookTitle",
    "manuscript_title",
    "manuscriptTitle",
    "tier_price",
    "tierPrice",
    "display_price",
    "displayPrice",
    "authorship_tier_label",
    "billing_display_name",
];
/**
 * Throws if a plain object (e.g. merged request body) contains author-marketing keys that would
 * pollute MSGF P1 telemetry semantics.
 */
function assertP1UniversalNonPolluted(payload) {
    for (const k of exports.P1_FORBIDDEN_AUTHOR_SPECIFIC_KEYS) {
        if (k in payload && payload[k] !== undefined) {
            throw new Error(`P1 universal envelope polluted by forbidden key: ${k}`);
        }
    }
}
/**
 * Builds the pulse JSON body with **only** universal P1 fields. Drops any unknown keys.
 */
function toUniversalP1PulseBody(input) {
    const o = {
        keystrokes: [...input.keystrokes],
    };
    if (input.humanTieBreakerResolved === true) {
        o["humanTieBreakerResolved"] = true;
    }
    assertP1UniversalNonPolluted(o);
    return o;
}
