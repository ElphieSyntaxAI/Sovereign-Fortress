"use client";

import { useSearchParams } from "next/navigation";

/** Shared `/admin/ops?project_origin=` filter written by OpsProjectOriginStrip. */
export function useSharedProjectOrigin(): string {
  return useSearchParams()?.get("project_origin")?.trim() || "";
}
