"use client";

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
