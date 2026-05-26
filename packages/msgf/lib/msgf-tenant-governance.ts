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
 * Distribution Build ID: MSGF-c103094-20260526T230730Z-internal
 */
/**
 * Tenant governance — PRODUCTION_AUTHOR domain lock + DEV_TEST sandbox writes.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  MSGF_TENANT_ID_HEADER,
  MSGF_WRITE_TARGET_HEADER,
} from "@/lib/msgf-http-headers";

export { MSGF_WRITE_TARGET_HEADER };

/** Author production silo — browser traffic must come from allowed origins. */
export const MSGF_TENANT_PRODUCTION_AUTHOR = "PRODUCTION_AUTHOR";

/** Sandbox silo — writes land in `msgf_sandbox`, not production Hall/Vault. */
export const MSGF_TENANT_DEV_TEST = "DEV_TEST";

/** Personal free-tier / independent developer tenant prefix (`tenant-indiv-{userId}`). */
export const TENANT_INDIV_PREFIX = "tenant-indiv-";

export const MSGF_PILLAR_TABLE_PRODUCTION = "pillar_vectors" as const;
export const MSGF_PILLAR_TABLE_SANDBOX = "msgf_sandbox" as const;

export type MsgfPillarTableName =
  | typeof MSGF_PILLAR_TABLE_PRODUCTION
  | typeof MSGF_PILLAR_TABLE_SANDBOX;

export const MSGF_WRITE_TARGET_SANDBOX = "sandbox";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const DEFAULT_PRODUCTION_AUTHOR_ORIGINS = [
  "https://elphiesyntax.com",
  "https://www.elphiesyntax.com",
  "https://authorecosystem.elphiesyntax.com",
  "https://elphiesgatedai.elphiesyntax.com",
  "https://syntaxeducates.elphiesyntax.com",
  "http://localhost:3002",
  "http://127.0.0.1:3002",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

export function normalizeMsgfGovernanceTenantId(
  raw: string | null | undefined
): string | null {
  const tid = raw?.trim();
  return tid || null;
}

export function isProductionAuthorTenant(tenantId: string): boolean {
  return tenantId === MSGF_TENANT_PRODUCTION_AUTHOR;
}

export function isDevTestTenant(tenantId: string): boolean {
  return tenantId === MSGF_TENANT_DEV_TEST;
}

export function isPersonalSandboxTenant(tenantId: string): boolean {
  const tid = tenantId.trim();
  return tid.startsWith(TENANT_INDIV_PREFIX) || isDevTestTenant(tid);
}

/** Canonical personal silo id for an independent developer. */
export function allocatePersonalSandboxTenantId(userId: string): string {
  return `${TENANT_INDIV_PREFIX}${userId}`;
}

/**
 * Independent when `company_id` is null/empty, or the tenant key is already a personal sandbox slug.
 */
export function isIndependentDeveloper(profile: {
  company_id: string | null;
  tenantKey: string | null;
}): boolean {
  if (!profile.company_id) return true;
  const key = profile.tenantKey?.trim() ?? "";
  return key.length > 0 && isPersonalSandboxTenant(key);
}

export function isMsgfWriteMethod(method: string): boolean {
  return WRITE_METHODS.has(method.toUpperCase());
}

/**
 * Cold-layer table for Vault / Hall rows (reads + writes).
 * DEV_TEST always uses `msgf_sandbox` so the Hall of Records stays clean.
 */
export function resolvePillarVectorsTable(tenantId: string): MsgfPillarTableName {
  if (isDevTestTenant(tenantId) || isPersonalSandboxTenant(tenantId)) {
    return MSGF_PILLAR_TABLE_SANDBOX;
  }
  return MSGF_PILLAR_TABLE_PRODUCTION;
}

export function resolveWriteTargetHeader(tenantId: string): string | null {
  if (isDevTestTenant(tenantId) || isPersonalSandboxTenant(tenantId)) {
    return MSGF_WRITE_TARGET_SANDBOX;
  }
  return null;
}

function configuredProductionOrigins(): string[] {
  const raw = process.env.MSGF_PRODUCTION_AUTHOR_ALLOWED_ORIGINS?.trim();
  if (!raw) return DEFAULT_PRODUCTION_AUTHOR_ORIGINS;
  return raw
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

function requestOrigins(request: NextRequest): string[] {
  const found: string[] = [];
  const origin = request.headers.get("origin")?.trim();
  if (origin) found.push(origin.replace(/\/$/, ""));

  const referer = request.headers.get("referer")?.trim();
  if (referer) {
    try {
      found.push(new URL(referer).origin);
    } catch {
      /* ignore */
    }
  }

  const host = request.headers.get("host")?.trim();
  if (host) {
    const plainHost = host.split(":")[0]?.toLowerCase();
    if (plainHost === "localhost" || plainHost === "127.0.0.1") {
      found.push(`http://${host}`);
      found.push(`https://${host}`);
    } else {
      found.push(`https://${host}`);
    }
  }

  return [...new Set(found)];
}

function originAllowed(request: NextRequest, allowed: string[]): boolean {
  const candidates = requestOrigins(request);
  if (!candidates.length) {
    return process.env.MSGF_PRODUCTION_AUTHOR_ALLOW_MISSING_ORIGIN === "1";
  }
  return candidates.some((c) =>
    allowed.some((a) => c === a || c.startsWith(`${a}/`))
  );
}

/**
 * Blocks PRODUCTION_AUTHOR traffic from unknown origins (403).
 * Returns null when allowed or tenant is not PRODUCTION_AUTHOR.
 */
export function assertProductionAuthorOrigin(
  request: NextRequest,
  tenantId: string | null
): NextResponse | null {
  if (!tenantId || !isProductionAuthorTenant(tenantId)) {
    return null;
  }

  const allowed = configuredProductionOrigins();
  if (originAllowed(request, allowed)) {
    return null;
  }

  return NextResponse.json(
    {
      ok: false,
      error: "PRODUCTION_AUTHOR requests are only accepted from authorized Author domains.",
      code: "ERR_PRODUCTION_AUTHOR_ORIGIN",
    },
    { status: 403 }
  );
}
