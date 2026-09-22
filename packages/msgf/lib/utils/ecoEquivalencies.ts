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
 * Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
 */
import type { EcoMetrics } from "@/lib/utils/ecoCalculator";
import { formatDisplayNumber } from "@/lib/utils/formatLocale";

export type EcoEquivalencyStatements = {
  water_bottles_saved: string;
  tree_seedlings_equivalent: string;
  tesla_model_3_charges_equivalent: string;
};

export const WATER_BOTTLES_PER_GALLON = 20;
export const CO2_LBS_PER_TREE_SEEDLING_10_YEARS = 133;
export const MWH_PER_TESLA_MODEL_3_CHARGE = 0.077;

function formatNumber(value: number, maximumFractionDigits = 1): string {
  return formatDisplayNumber(value, { maximumFractionDigits });
}

function assertFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite, non-negative number.`);
  }
}

export function waterGallonsToBottleStatement(gallons: number): string {
  assertFiniteNonNegative(gallons, "gallons");
  const bottles = gallons * WATER_BOTTLES_PER_GALLON;
  return `${formatNumber(bottles, 0)} standard 16.9oz water bottles saved`;
}

export function co2LbsToTreeSeedlingStatement(co2Lbs: number): string {
  assertFiniteNonNegative(co2Lbs, "co2Lbs");
  const seedlings = co2Lbs / CO2_LBS_PER_TREE_SEEDLING_10_YEARS;
  return `equivalent to ${formatNumber(seedlings, 1)} tree seedlings grown for 10 years`;
}

export function kwhToTeslaModel3ChargeStatement(kwh: number): string {
  assertFiniteNonNegative(kwh, "kwh");
  const mwh = kwh / 1000;
  const charges = mwh / MWH_PER_TESLA_MODEL_3_CHARGE;
  return `equivalent to ${formatNumber(charges, 1)} full Tesla Model 3 battery charges`;
}

export function buildEcoEquivalencyStatements(metrics: EcoMetrics): EcoEquivalencyStatements {
  return {
    water_bottles_saved: waterGallonsToBottleStatement(metrics.freshwater_conserved_gallons),
    tree_seedlings_equivalent: co2LbsToTreeSeedlingStatement(metrics.co2e_offset_lbs),
    tesla_model_3_charges_equivalent: kwhToTeslaModel3ChargeStatement(
      metrics.grid_compute_prevented_kwh
    ),
  };
}
