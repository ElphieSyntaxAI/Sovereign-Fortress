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
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const BLOCKED_CONSUMER_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "live.com",
  "msn.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
]);

/** Normalize email domain: trim, lower, strip leading @. */
export function normalizeCompanyDomain(raw: string): string {
  let d = raw.trim().toLowerCase();
  if (d.startsWith("@")) d = d.slice(1);
  d = d.replace(/\.+$/g, "");
  return d;
}

export function isBlockedConsumerDomain(domain: string): boolean {
  return BLOCKED_CONSUMER_DOMAINS.has(normalizeCompanyDomain(domain));
}

/** Extract domain from an email address; null if invalid. */
export function emailDomain(email: string): string | null {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at <= 0 || at === e.length - 1) return null;
  const domain = normalizeCompanyDomain(e.slice(at + 1));
  return domain.length > 0 ? domain : null;
}

/**
 * Validate a domain for company allowlist registration.
 * Returns normalized domain or throws with a stable message.
 */
export function assertRegisterableCompanyDomain(raw: string): string {
  const domain = normalizeCompanyDomain(raw);
  if (!domain || !domain.includes(".") || domain.startsWith(".")) {
    throw new Error("Invalid company domain.");
  }
  if (isBlockedConsumerDomain(domain)) {
    throw new Error(`Consumer email domain not allowed for Workspace SSO: ${domain}`);
  }
  return domain;
}

/**
 * Resolve company_id for an email / Workspace hd.
 * Consumer domains never map. Missing hd is OK when email domain is allowlisted.
 */
export async function lookupCompanyIdByEmailDomain(
  admin: SupabaseClient,
  emailOrDomain: string
): Promise<{ company_id: string; domain: string } | null> {
  const domain =
    emailOrDomain.includes("@")
      ? emailDomain(emailOrDomain)
      : normalizeCompanyDomain(emailOrDomain);
  if (!domain) return null;
  if (isBlockedConsumerDomain(domain)) return null;

  const { data, error } = await admin
    .from("msgf_company_domains")
    .select("company_id, domain")
    .eq("domain", domain)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[company-domains] lookup failed:", error.message);
    return null;
  }
  if (!data?.company_id) return null;
  return { company_id: String(data.company_id), domain: String(data.domain) };
}

export async function listCompanyDomains(
  admin: SupabaseClient,
  companyId: string
): Promise<Array<{ id: string; domain: string; created_at: string }>> {
  const { data, error } = await admin
    .from("msgf_company_domains")
    .select("id, domain, created_at")
    .eq("company_id", companyId)
    .order("domain", { ascending: true });
  if (error) throw new Error(`listCompanyDomains: ${error.message}`);
  return (data ?? []) as Array<{ id: string; domain: string; created_at: string }>;
}

export async function addCompanyDomain(
  admin: SupabaseClient,
  companyId: string,
  rawDomain: string
): Promise<{ id: string; domain: string }> {
  const domain = assertRegisterableCompanyDomain(rawDomain);
  const { data, error } = await admin
    .from("msgf_company_domains")
    .insert({ company_id: companyId, domain })
    .select("id, domain")
    .single();
  if (error) throw new Error(`addCompanyDomain: ${error.message}`);
  return data as { id: string; domain: string };
}
