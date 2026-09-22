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
 * Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
 */
import { Suspense } from "react";

import { OpsConsole } from "@/app/_components/admin/ops/OpsConsole";

export default function AdminOpsPage() {
  return (
    <Suspense fallback={null}>
      <OpsConsole />
    </Suspense>
  );
}
