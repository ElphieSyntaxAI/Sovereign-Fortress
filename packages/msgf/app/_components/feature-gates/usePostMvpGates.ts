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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T170731Z-internal
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
 * Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
 */
import { useEffect, useState } from "react";

import type { PostMvpGateSnapshot } from "@/lib/post-mvp-gates";

const DEFAULT_GATES: PostMvpGateSnapshot = {
  signing: false,
  dropbox_archive: false,
  mcp_product: false,
  author_fan_hub: false,
  author_helper: false,
};

export function usePostMvpGates(): PostMvpGateSnapshot {
  const [gates, setGates] = useState<PostMvpGateSnapshot>(DEFAULT_GATES);

  useEffect(() => {
    let active = true;
    void fetch("/api/msgf/feature-gates", { cache: "no-store", credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return;
        const json = (await res.json()) as { ok?: boolean; gates?: PostMvpGateSnapshot };
        if (active && json.ok && json.gates) setGates(json.gates);
      })
      .catch(() => {
        /* keep defaults off */
      });
    return () => {
      active = false;
    };
  }, []);

  return gates;
}
