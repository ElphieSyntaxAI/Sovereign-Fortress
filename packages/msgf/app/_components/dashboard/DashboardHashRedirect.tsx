"use client";

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
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-08289e1a-20260923T145027Z-internal
 */
import { useEffect } from "react";

/** Hash links from older nav items open the matching destination. */
export function DashboardHashRedirect() {
  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);
    if (hash === "#token-savings") {
      params.set("view", "roi");
      const qs = params.toString();
      window.location.replace(qs ? `/dashboard?${qs}` : "/dashboard?view=roi");
      return;
    }
    if (hash === "#security-view" || hash === "#security-view-dev") {
      params.delete("view");
      const qs = params.toString();
      window.location.replace(qs ? `/security?${qs}` : "/security");
    }
  }, []);
  return null;
}
