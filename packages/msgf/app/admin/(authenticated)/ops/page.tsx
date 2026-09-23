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
import { Suspense } from "react";

import { OpsConsole } from "@/app/_components/admin/ops/OpsConsole";

export default function AdminOpsPage() {
  return (
    <Suspense fallback={null}>
      <OpsConsole />
    </Suspense>
  );
}
