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
import type { SupabaseClient } from "@supabase/supabase-js";

import type { ClassifierPathOverride } from "@/lib/services/converge-tier/classifier";
import type { ConvergeTier } from "@/lib/services/converge-tier/types";

export type CompanyTierRuleRow = {
  id: string;
  company_id: string;
  path_glob: string;
  force_tier: ConvergeTier;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export async function listCompanyTierRules(
  admin: SupabaseClient,
  companyId: string
): Promise<CompanyTierRuleRow[]> {
  const { data, error } = await admin
    .from("msgf_company_tier_rules")
    .select("id, company_id, path_glob, force_tier, enabled, created_at, updated_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`listCompanyTierRules: ${error.message}`);
  return (data ?? []) as CompanyTierRuleRow[];
}

export async function insertCompanyTierRule(
  admin: SupabaseClient,
  params: { companyId: string; pathGlob: string; forceTier: ConvergeTier }
): Promise<CompanyTierRuleRow> {
  const { data, error } = await admin
    .from("msgf_company_tier_rules")
    .insert({
      company_id: params.companyId,
      path_glob: params.pathGlob.trim(),
      force_tier: params.forceTier,
      enabled: true,
    })
    .select("id, company_id, path_glob, force_tier, enabled, created_at, updated_at")
    .single();

  if (error) throw new Error(`insertCompanyTierRule: ${error.message}`);
  return data as CompanyTierRuleRow;
}

export async function patchCompanyTierRule(
  admin: SupabaseClient,
  params: { id: string; companyId: string; enabled?: boolean; forceTier?: ConvergeTier }
): Promise<CompanyTierRuleRow> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (params.enabled != null) patch.enabled = params.enabled;
  if (params.forceTier) patch.force_tier = params.forceTier;

  const { data, error } = await admin
    .from("msgf_company_tier_rules")
    .update(patch)
    .eq("id", params.id)
    .eq("company_id", params.companyId)
    .select("id, company_id, path_glob, force_tier, enabled, created_at, updated_at")
    .single();

  if (error) throw new Error(`patchCompanyTierRule: ${error.message}`);
  return data as CompanyTierRuleRow;
}

export async function deleteCompanyTierRule(
  admin: SupabaseClient,
  params: { id: string; companyId: string }
): Promise<void> {
  const { error } = await admin
    .from("msgf_company_tier_rules")
    .delete()
    .eq("id", params.id)
    .eq("company_id", params.companyId);
  if (error) throw new Error(`deleteCompanyTierRule: ${error.message}`);
}

export function toClassifierOverrides(rows: CompanyTierRuleRow[]): ClassifierPathOverride[] {
  return rows
    .filter((r) => r.enabled)
    .map((r) => ({ pathGlob: r.path_glob, forceTier: r.force_tier }));
}

export async function loadClassifierOverridesForCompany(
  admin: SupabaseClient,
  companyId: string | null | undefined
): Promise<ClassifierPathOverride[]> {
  if (!companyId?.trim()) return [];
  const rows = await listCompanyTierRules(admin, companyId.trim());
  return toClassifierOverrides(rows);
}
