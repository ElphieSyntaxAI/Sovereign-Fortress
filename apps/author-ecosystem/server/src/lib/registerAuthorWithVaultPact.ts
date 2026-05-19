import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import bcrypt from "bcrypt";
import type { SupabaseClient } from "@supabase/supabase-js";

import { bootstrapTenantBrain, MSGF } from "msgf/onboarding";

const AUTHOR_MSGF_TENANT_ID =
  process.env.MSGF_AUTHOR_TENANT_ID?.trim() || "author_ecosystem";

import { getMonorepoRootDir, loadMonorepoRootEnv } from "./database/loadRootEnv.js";
import { getSupabaseAdmin } from "./supabaseAdmin.js";

export const VAULT_PACT_SIGNATURE_PHRASE = "I SIGN THE VAULT PACT" as const;

export type RegisterAuthorWithVaultPactInput = {
  email: string;
  password: string;
  username: string;
  displayName: string;
  /** Must match {@link VAULT_PACT_SIGNATURE_PHRASE} exactly (including casing). */
  vaultPactSignature: string;
  /** Defaults to Tier 2 name in msgf_legacy_tiers. */
  legacyTierName?: string;
};

export type RegisterAuthorWithVaultPactResult = {
  userId: string;
  vaultPactSha256: string;
  vaultPactMd5: string;
};

function sha256HexUtf8(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function md5HexUtf8(text: string): string {
  return createHash("md5").update(text, "utf8").digest("hex");
}

async function readVaultPactMarkdown(): Promise<string> {
  const path = join(
    getMonorepoRootDir(),
    "apps",
    "author-ecosystem",
    "nda",
    "vault-pact-bilateral.md"
  );
  return readFile(path, "utf8");
}

/**
 * Registers an author with Supabase Auth, then runs **one Postgres transaction** (RPC) for:
 * `public.profiles`, `public.legal_attestations` (exact Vault phrase + SHA-256 of pact markdown),
 * and `public.msgf_legacy_users`.
 *
 * On success, calls {@link MSGF.createPledgeBeat} and {@link MSGF.ensureAuthorPulseProfile} so
 * PulseEngine pledge checks and entitlement middleware allow the first Pulse.
 *
 * **Auth is not inside the SQL transaction.** If the RPC fails (including attestation / CHECK
 * failures), the new auth user is **deleted** so unsigned rows never remain.
 *
 * **Hashing:** `legal_attestations.content_hash` is **SHA-256 only** (64 hex) per schema. MD5 of the
 * same document is stored under `metadata.vault_pact_md5` for parity with dual-hash requirements.
 */
export async function registerAuthorWithVaultPact(
  input: RegisterAuthorWithVaultPactInput,
  options?: { supabase?: SupabaseClient }
): Promise<RegisterAuthorWithVaultPactResult> {
  loadMonorepoRootEnv();

  if (input.vaultPactSignature !== VAULT_PACT_SIGNATURE_PHRASE) {
    throw new Error("vaultPactSignature must exactly match I SIGN THE VAULT PACT");
  }

  const admin = options?.supabase ?? getSupabaseAdmin();

  const vaultMarkdown = await readVaultPactMarkdown();
  const vaultPactSha256 = sha256HexUtf8(vaultMarkdown);
  const vaultPactMd5 = md5HexUtf8(vaultMarkdown);

  const email = input.email.trim().toLowerCase();
  const username = input.username.trim();
  const displayName = input.displayName.trim();

  if (!email || !username || !input.password) {
    throw new Error("email, username, and password are required");
  }

  const tierName = input.legacyTierName ?? "Tier 2: Core Author";
  const { data: tierRows, error: tierErr } = await admin
    .from("msgf_legacy_tiers")
    .select("tier_id")
    .eq("name", tierName)
    .limit(1)
    .maybeSingle();

  if (tierErr) throw new Error(`Legacy tier lookup failed: ${tierErr.message}`);
  const tierId = tierRows?.tier_id;
  if (tierId == null || !Number.isFinite(Number(tierId))) {
    throw new Error(`Missing legacy tier '${tierName}' in msgf_legacy_tiers`);
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  if (passwordHash.length !== 60) {
    throw new Error("Unexpected bcrypt hash length");
  }

  const correlationId = randomUUID();
  const { data: created, error: signUpErr } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      username,
      display_name: displayName,
      registration_correlation_id: correlationId,
    },
  });

  if (signUpErr || !created.user?.id) {
    throw new Error(signUpErr?.message ?? "Supabase Auth signup failed");
  }

  const userId = created.user.id;

  try {
    const { data: rpcData, error: rpcErr } = await admin.rpc("register_author_with_vault_pact", {
      p_user_id: userId,
      p_display_name: displayName,
      p_username: username,
      p_email: email,
      p_password_hash: passwordHash,
      p_tier_id: Number(tierId),
      p_vault_pact_content_sha256: vaultPactSha256,
      p_signature_text: VAULT_PACT_SIGNATURE_PHRASE,
      p_metadata: { vault_pact_md5: vaultPactMd5, correlation_id: correlationId },
    });

    if (rpcErr) {
      throw new Error(rpcErr.message);
    }
    if (rpcData && typeof rpcData === "object" && (rpcData as { ok?: boolean }).ok !== true) {
      throw new Error("register_author_with_vault_pact did not return ok");
    }

    await MSGF.ensureMsgfPulseProfile({
      entityId: userId,
      tierId: Number(tierId),
      username,
      preferredTheme: "Pleasure",
      userRole: "author",
      tenantId: AUTHOR_MSGF_TENANT_ID,
      supabase: admin,
    });

    await MSGF.createPledgeBeat(userId, {
      tenantId: AUTHOR_MSGF_TENANT_ID,
      beatText: `No-AI-Training Pledge accepted with Vault Pact (${VAULT_PACT_SIGNATURE_PHRASE}).`,
    });

    await bootstrapTenantBrain(admin, AUTHOR_MSGF_TENANT_ID, userId);
  } catch (e) {
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(
        `Registration failed (${msg}) and auth user rollback failed: ${delErr.message}. userId=${userId}`
      );
    }
    throw e instanceof Error ? e : new Error(String(e));
  }

  return { userId, vaultPactSha256, vaultPactMd5 };
}
