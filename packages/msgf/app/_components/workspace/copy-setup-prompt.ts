"use server";

import { buildWorkspaceSetupPrompt } from "@/lib/workspace-setup-prompt";

export async function copyWorkspaceSetupPrompt(input: {
  tenantKey: string;
  existingOrigins: string[];
}): Promise<string> {
  return buildWorkspaceSetupPrompt(input);
}
