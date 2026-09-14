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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
/**
 * Refactoring directive profiles for guided agent-context (L2 website scope).
 */

import fs from "node:fs";
import path from "node:path";

export type RefactoringProfileId = "website_modernization";

const PROFILE_DENY_LIST = [
  "packages/msgf/middleware.ts",
  "packages/msgf/lib/creditGuard.ts",
  "packages/msgf/lib/credit-reservation.ts",
  "packages/msgf/lib/services/",
  "packages/msgf/app/api/",
  "packages/msgf/supabase/migrations/",
];

const PROFILE_ALLOW_LIST = [
  "packages/msgf/app/_components/",
  "packages/msgf/app/**/page.tsx",
  "packages/msgf/app/globals.css (only when explicitly requested)",
];

function defaultRepoRoot(): string {
  if (process.env.MSGF_REPO_ROOT?.trim()) {
    return process.env.MSGF_REPO_ROOT.trim();
  }
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, "docs", "templates", "MSGF_REFACTORING_DIRECTIVE.md");
    if (fs.existsSync(candidate)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

export function loadRefactoringDirectiveTemplate(repoRoot?: string): string {
  const root = repoRoot ?? defaultRepoRoot();
  const templatePath = path.join(root, "docs", "templates", "MSGF_REFACTORING_DIRECTIVE.md");
  try {
    return fs.readFileSync(templatePath, "utf8");
  } catch {
    return "# MSGF Refactoring Directive\n\nTemplate file missing on server.\n";
  }
}

export function buildRefactoringDirectivePack(profile: RefactoringProfileId): {
  profile: RefactoringProfileId;
  directive_markdown: string;
  allow_list: string[];
  deny_list: string[];
  validation_commands: string[];
} {
  const directive_markdown = loadRefactoringDirectiveTemplate();

  if (profile !== "website_modernization") {
    throw new Error(`Unknown refactor profile: ${profile}`);
  }

  return {
    profile,
    directive_markdown,
    allow_list: PROFILE_ALLOW_LIST,
    deny_list: PROFILE_DENY_LIST,
    validation_commands: [
      "npm run validate:deployment -w msgf",
      "npm run build -w msgf",
    ],
  };
}
