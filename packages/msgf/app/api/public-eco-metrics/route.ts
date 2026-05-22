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
 * Distribution Build ID: MSGF-44d0906-20260522T043912Z-internal
 */
import { NextResponse } from "next/server";

import {
  getPublicEcoMetrics,
  hasPublicEcoDatabaseEnv,
  PUBLIC_ECO_CACHE_CONTROL,
} from "@/lib/services/public-eco-metrics";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET() {
  const data = await getPublicEcoMetrics(
    hasPublicEcoDatabaseEnv() ? createAdminClient() : undefined
  );
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": PUBLIC_ECO_CACHE_CONTROL,
    },
  });
}
