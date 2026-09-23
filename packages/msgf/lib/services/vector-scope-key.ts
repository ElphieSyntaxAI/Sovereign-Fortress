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
import { createHash } from "crypto";

export const SUBPATH_HASH_HEX_LEN = 16;

/**
 * Normalize a file path or directory prefix for stable hashing.
 * - backslash → slash
 * - trim
 * - strip leading ./
 * - collapse duplicate slashes
 * - lowercase
 * - strip trailing slash (except root)
 */
export function normalizePathForScope(raw: string): string {
  let p = raw.trim().replace(/\\/g, "/").toLowerCase();
  while (p.startsWith("./")) p = p.slice(2);
  p = p.replace(/\/+/g, "/");
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}

/** sha256 hex truncated to 16 chars. Empty/whitespace → empty string (caller may omit stamp). */
export function computeSubpathHash(filePathOrDirPrefix: string): string {
  const normalized = normalizePathForScope(filePathOrDirPrefix);
  if (!normalized) return "";
  return createHash("sha256").update(normalized, "utf8").digest("hex").slice(0, SUBPATH_HASH_HEX_LEN);
}

/**
 * Prefer explicit file path; else directory prefix. Returns null when neither yields a hash.
 */
export function resolveSubpathHash(params: {
  filePath?: string | null;
  dirPrefix?: string | null;
  explicitHash?: string | null;
}): string | null {
  const explicit = params.explicitHash?.trim().toLowerCase();
  if (explicit && /^[a-f0-9]{8,64}$/.test(explicit)) {
    return explicit.slice(0, SUBPATH_HASH_HEX_LEN);
  }
  const fromFile = params.filePath?.trim()
    ? computeSubpathHash(params.filePath)
    : "";
  if (fromFile) return fromFile;
  const fromDir = params.dirPrefix?.trim() ? computeSubpathHash(params.dirPrefix) : "";
  return fromDir || null;
}
