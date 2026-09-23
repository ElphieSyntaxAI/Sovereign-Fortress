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
 * Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
 */
/**
 * Tenant Small Brain CONVERGE presets (dual / tri / custom BYOK).
 *
 * GET — current config (+ catalog)
 * PUT — body `{ profileId, providers?, defaultProvider? }`
 *   defaultProvider = Small Brain lead (gemini/google | anthropic | xai)
 *   providers = dual/TRI pair (custom_byok / solo_fast)
 */
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { MSGF_TENANT_ID_HEADER } from "@/lib/msgf-http-headers";
import { resolveTenantIdForPillars } from "@/lib/services/msgf-metadata-scope";
import {
  CONSENSUS_PRESET_CATALOG,
  TENANT_PRESET_IDS,
  isTenantTriConsensusEnabled,
  parseMsgfConsensusProvider,
  type MsgfConsensusProvider,
  type TenantConsensusPresetId,
} from "@/lib/services/consensus/msgf-consensus-config";
import {
  CUSTOM_ANTHROPIC,
  CUSTOM_OPENAI_COMPATIBLE,
  type CustomEndpointInput,
  type CustomEndpointKind,
} from "@/lib/services/model-routing/types";
import {
  getTenantConsensusConfig,
  upsertTenantConsensusConfig,
} from "@/lib/services/tenant-consensus-config";
import { listTenantProviderCredentialPresence } from "@/lib/services/tenant-provider-credentials";
import {
  TenantSettingsAuthError,
  assertUserMayManageTenantSettings,
} from "@/lib/services/tenant-settings-auth";

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

function parseEcoEndpoint(item: unknown, index: number): CustomEndpointInput {
  const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
  const kindRaw = typeof row.providerKind === "string" ? row.providerKind : CUSTOM_OPENAI_COMPATIBLE;
  const providerKind: CustomEndpointKind =
    kindRaw === CUSTOM_ANTHROPIC ? CUSTOM_ANTHROPIC : CUSTOM_OPENAI_COMPATIBLE;
  const displayName =
    typeof row.displayName === "string" && row.displayName.trim()
      ? row.displayName.trim()
      : `Eco ${index + 1}`;
  const credentialMode =
    row.credentialMode === "https" || row.credentialMode === "api_key"
      ? row.credentialMode
      : undefined;
  const authHeaderStyle =
    row.authHeaderStyle === "x-goog-api-key" ? "x-goog-api-key" : "bearer";
  return {
    providerId:
      typeof row.providerId === "string" && row.providerId.trim()
        ? row.providerId.trim()
        : `eco-${index + 1}`,
    displayName,
    baseURL: typeof row.baseURL === "string" ? row.baseURL.trim() : "",
    apiKey: typeof row.apiKey === "string" ? row.apiKey : undefined,
    modelName: typeof row.modelName === "string" ? row.modelName.trim() : "",
    maxTokens: Number(row.maxTokens) > 0 ? Number(row.maxTokens) : 4096,
    costPer1kInput: Number.isFinite(Number(row.costPer1kInput)) ? Number(row.costPer1kInput) : 0,
    costPer1kOutput: Number.isFinite(Number(row.costPer1kOutput)) ? Number(row.costPer1kOutput) : 0,
    isEcoModel: row.isEcoModel !== false,
    providerKind,
    privateHostAllowed: row.privateHostAllowed === true,
    credentialMode,
    authHeaderStyle,
    useForReasoning: row.useForReasoning === true,
  };
}

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, { status: 401 });

    const headerTenant = req.headers.get(MSGF_TENANT_ID_HEADER)?.trim() || "";
    const tenantId = resolveTenantIdForPillars(
      headerTenant,
      user.user_metadata as Record<string, unknown>
    );
    const admin = createAdminClient();
    await assertUserMayManageTenantSettings({ admin, user, tenantId, write: false });

    const projectOrigin = req.nextUrl.searchParams.get("project_origin")?.trim() ?? "";
    const [config, presence] = await Promise.all([
      getTenantConsensusConfig({ admin, tenantId, projectOrigin }),
      listTenantProviderCredentialPresence({ admin, tenantId }),
    ]);

    return json({
      tenant_id: tenantId,
      project_origin: projectOrigin,
      config,
      presets: TENANT_PRESET_IDS.map((id) => ({
        profileId: id,
        ...(id === "custom_byok"
          ? { mode: "DUAL_OR_TRI", providers: [] as string[], strictness: "varies" }
          : id === "eco_trio"
            ? { mode: "TRI", providers: [] as string[], strictness: "MAJORITY", profileId: "eco_trio" }
            : CONSENSUS_PRESET_CATALOG[id as keyof typeof CONSENSUS_PRESET_CATALOG]),
        tri_requires_entitlement: id === "tri_tribunal",
      })),
      tri_entitlement_enabled: isTenantTriConsensusEnabled(),
      keys: {
        gemini_configured: presence.gemini,
        anthropic_configured: presence.anthropic,
        xai_configured: presence.xai,
      },
    });
  } catch (e) {
    if (e instanceof TenantSettingsAuthError) {
      return json({ error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Unexpected error.";
    console.error("[consensus-config GET]", e);
    return json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, { status: 401 });

    const headerTenant = req.headers.get(MSGF_TENANT_ID_HEADER)?.trim() || "";
    const tenantId = resolveTenantIdForPillars(
      headerTenant,
      user.user_metadata as Record<string, unknown>
    );

    const admin = createAdminClient();
    await assertUserMayManageTenantSettings({ admin, user, tenantId, write: true });

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const profileIdRaw = typeof body?.["profileId"] === "string" ? body["profileId"].trim() : "";
    if (!(TENANT_PRESET_IDS as readonly string[]).includes(profileIdRaw)) {
      return json({ error: "Invalid profileId" }, { status: 400 });
    }
    const profileId = profileIdRaw as TenantConsensusPresetId;
    const defaultProvider = parseMsgfConsensusProvider(
      body?.["defaultProvider"] ?? body?.["default_provider"]
    );

    if (profileId === "tri_tribunal" && !isTenantTriConsensusEnabled()) {
      return json(
        { error: "tri_tribunal requires MSGF_TENANT_TRI_CONSENSUS_ENABLED=1" },
        { status: 403 }
      );
    }

    let customProviders: MsgfConsensusProvider[] | undefined;
    if (profileId === "custom_byok" || profileId === "solo_fast") {
      const raw = body?.["providers"];
      if (profileId === "custom_byok" && !Array.isArray(raw) && !defaultProvider) {
        return json({ error: "custom_byok requires providers: string[] or defaultProvider" }, { status: 400 });
      }
      customProviders = [];
      if (Array.isArray(raw)) {
        for (const item of raw) {
          const p = parseMsgfConsensusProvider(item);
          if (!p) return json({ error: `Invalid provider: ${String(item)}` }, { status: 400 });
          customProviders.push(p);
        }
      } else if (defaultProvider) {
        customProviders = [defaultProvider];
      }
      const unique = [...new Set(customProviders)];
      if (unique.length < 1 || unique.length > 3) {
        return json({ error: "Choose 1 default AI, or 2–3 providers for dual/TRI" }, { status: 400 });
      }
      if (unique.length === 3 && !isTenantTriConsensusEnabled()) {
        return json(
          { error: "3-provider TRI requires MSGF_TENANT_TRI_CONSENSUS_ENABLED=1" },
          { status: 403 }
        );
      }
      customProviders = unique;
    }

    const projectOrigin =
      typeof body?.["project_origin"] === "string" ? body["project_origin"].trim() : "";

    let ecoEndpoints: CustomEndpointInput[] | undefined;
    if (profileId === "eco_trio") {
      const current = await getTenantConsensusConfig({ admin, tenantId, projectOrigin });
      customProviders = current.providers;
      const raw = body?.["customEcoEndpoints"] ?? body?.["custom_eco_endpoints"];
      if (!Array.isArray(raw)) {
        return json({ error: "Eco Trio requires 3 eco models" }, { status: 400 });
      }
      ecoEndpoints = raw.map((item, index) => parseEcoEndpoint(item, index));
    }

    let reasoningEndpoint: CustomEndpointInput | null | undefined;
    if ("customReasoningEndpoint" in (body ?? {}) || "custom_reasoning_endpoint" in (body ?? {})) {
      const raw = body?.["customReasoningEndpoint"] ?? body?.["custom_reasoning_endpoint"];
      if (raw === null) {
        reasoningEndpoint = null;
      } else if (raw && typeof raw === "object") {
        const parsed = parseEcoEndpoint(raw, 0);
        reasoningEndpoint = {
          ...parsed,
          providerId: parsed.providerId || "reasoning-1",
          displayName: parsed.displayName || "DeepSeek R1",
          isEcoModel: false,
          useForReasoning: parsed.useForReasoning !== false,
        };
      }
    }

    const config = await upsertTenantConsensusConfig({
      admin,
      tenantId,
      profileId,
      customProviders,
      defaultProvider: defaultProvider ?? undefined,
      projectOrigin,
      ecoEndpoints,
      reasoningEndpoint,
    });

    return json({ tenant_id: tenantId, config });
  } catch (e) {
    if (e instanceof TenantSettingsAuthError) {
      return json({ error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Unexpected error.";
    console.error("[consensus-config PUT]", e);
    return json({ error: msg }, { status: 400 });
  }
}
