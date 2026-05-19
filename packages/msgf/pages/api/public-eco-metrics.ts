/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 */
import type { NextApiRequest, NextApiResponse } from "next";

import {
  getPublicEcoMetrics,
  hasPublicEcoDatabaseEnv,
  PUBLIC_ECO_CACHE_CONTROL,
  type PublicEcoMetricsResponse,
} from "@/lib/services/public-eco-metrics";
import { createAdminClient } from "@/utils/supabase/admin";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PublicEcoMetricsResponse | { ok: false; error: string }>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ ok: false, error: "Method not allowed." });
    return;
  }

  res.setHeader("Cache-Control", PUBLIC_ECO_CACHE_CONTROL);
  const data = await getPublicEcoMetrics(
    hasPublicEcoDatabaseEnv() ? createAdminClient() : undefined
  );
  res.status(200).json(data);
}
