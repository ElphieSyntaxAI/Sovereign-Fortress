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
function slugifyFingerprintSeed(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}

export function buildEntityFingerprint(name: string, kind: string): string {
  const slug = slugifyFingerprintSeed(name) || slugifyFingerprintSeed(kind) || "entity";
  return `fingerprint_${slug}`;
}

export function buildBeatId(order: number, title?: string): string {
  const slug = title ? slugifyFingerprintSeed(title).slice(0, 24) : "";
  return slug ? `beat_id_${slug}` : `beat_id_scene_${order + 1}`;
}
