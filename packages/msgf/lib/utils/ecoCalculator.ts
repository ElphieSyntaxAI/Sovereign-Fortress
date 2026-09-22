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
/**
 * Converts proven avoided LLM tokens into environmental proxies.
 *
 * Coefficients are published model factors (not utility invoices). Public /
 * marketing surfaces must only pass tokens that are `proven_avoidance` or
 * `pack_delta` evidence — see `proven-savings.ts` and `MSGF_ECO_PROVEN_ONLY`.
 *
 * Default intensity assumptions (conservative order-of-magnitude for text LLMs):
 * - 0.4 kWh per 1M tokens
 * - 0.85 lbs CO₂e per kWh
 * - 2.0 gallons freshwater per kWh (cooling proxy)
 */
export type EcoMetrics = {
  tokens_saved: number;
  grid_compute_prevented_kwh: number;
  co2e_offset_lbs: number;
  freshwater_conserved_gallons: number;
};

export const ECO_TOKENS_PER_MILLION = 1_000_000;
export const ECO_KWH_PER_MILLION_TOKENS = 0.4;
export const ECO_CO2E_LBS_PER_KWH = 0.85;
export const ECO_WATER_GALLONS_PER_KWH = 2.0;

export const ECO_METHODOLOGY_SHORT =
  "Eco impact uses published kWh/CO₂e/water coefficients applied only to proven avoided tokens (metered provider baselines or audited pack deltas). Not a utility bill.";

function cleanFloat(value: number): number {
  return Number.parseFloat(value.toFixed(4));
}

export function calculateEcoSavings(tokensSaved: number): EcoMetrics {
  if (!Number.isFinite(tokensSaved)) {
    console.error("[ecoCalculator] tokensSaved must be a finite number.", { tokensSaved });
    throw new TypeError("tokensSaved must be a finite number.");
  }

  if (tokensSaved < 0) {
    console.error("[ecoCalculator] tokensSaved cannot be negative.", { tokensSaved });
    throw new RangeError("tokensSaved cannot be negative.");
  }

  const normalizedTokens = Math.floor(tokensSaved);
  const gridComputePreventedKwh =
    (normalizedTokens / ECO_TOKENS_PER_MILLION) * ECO_KWH_PER_MILLION_TOKENS;
  const co2eOffsetLbs = gridComputePreventedKwh * ECO_CO2E_LBS_PER_KWH;
  const freshwaterConservedGallons = gridComputePreventedKwh * ECO_WATER_GALLONS_PER_KWH;

  return {
    tokens_saved: normalizedTokens,
    grid_compute_prevented_kwh: cleanFloat(gridComputePreventedKwh),
    co2e_offset_lbs: cleanFloat(co2eOffsetLbs),
    freshwater_conserved_gallons: cleanFloat(freshwaterConservedGallons),
  };
}

