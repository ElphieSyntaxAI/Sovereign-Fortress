/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
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
