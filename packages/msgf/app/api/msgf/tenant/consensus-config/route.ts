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
/**
 * Tenant Small Brain CONVERGE presets (dual / tri / custom BYOK).
 *
 * GET — current config (+ catalog)
 * PUT — body `{ profileId, providers? }` for custom_byok
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

    const [config, presence] = await Promise.all([
      getTenantConsensusConfig({ admin, tenantId }),
      listTenantProviderCredentialPresence({ admin, tenantId }),
    ]);

    return json({
      tenant_id: tenantId,
      config,
      presets: TENANT_PRESET_IDS.map((id) => ({
        profileId: id,
        ...(id === "custom_byok"
          ? { mode: "DUAL_OR_TRI", providers: [] as string[], strictness: "varies" }
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

    if (profileId === "tri_tribunal" && !isTenantTriConsensusEnabled()) {
      return json(
        { error: "tri_tribunal requires MSGF_TENANT_TRI_CONSENSUS_ENABLED=1" },
        { status: 403 }
      );
    }

    let customProviders: MsgfConsensusProvider[] | undefined;
    if (profileId === "custom_byok") {
      const raw = body?.["providers"];
      if (!Array.isArray(raw)) {
        return json({ error: "custom_byok requires providers: string[]" }, { status: 400 });
      }
      customProviders = [];
      for (const item of raw) {
        const p = parseMsgfConsensusProvider(item);
        if (!p) return json({ error: `Invalid provider: ${String(item)}` }, { status: 400 });
        customProviders.push(p);
      }
      const unique = [...new Set(customProviders)];
      if (unique.length < 2 || unique.length > 3) {
        return json({ error: "custom_byok requires 2–3 unique providers" }, { status: 400 });
      }
      if (unique.length === 3 && !isTenantTriConsensusEnabled()) {
        return json(
          { error: "custom_byok with 3 providers requires MSGF_TENANT_TRI_CONSENSUS_ENABLED=1" },
          { status: 403 }
        );
      }
      customProviders = unique;
    }

    const config = await upsertTenantConsensusConfig({
      admin,
      tenantId,
      profileId,
      customProviders,
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
