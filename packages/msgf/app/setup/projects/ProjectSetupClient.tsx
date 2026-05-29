"use client";

/**
 * @deprecated Use WorkspaceView / WorkspaceSetupProjectsTab on /workspace?tab=setup.
 * Kept for imports that still reference this module.
 */
import { WorkspaceSetupProjectsTab } from "@/app/_components/workspace/WorkspaceSetupProjectsTab";

export function ProjectSetupClient() {
  return (
    <WorkspaceSetupProjectsTab
      accessRole="DEVELOPER"
      companySilo="Independent personal sandbox"
      tenantKey="—"
    />
  );
}
