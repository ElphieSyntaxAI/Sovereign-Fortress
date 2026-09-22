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
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { sanitizeTenantScope } from "@/lib/sanitize-tenant-scope";
import {
  deriveProjectOriginFromLocalPath,
} from "@/lib/services/user-project-paths";

export type UserProjectSourceType = "local" | "github";

export type UserProjectRow = {
  id: string;
  user_id: string;
  source_type: UserProjectSourceType;
  display_name: string;
  local_path: string | null;
  github_url: string | null;
  repository_full_name: string | null;
  project_origin: string;
  created_at: string;
  updated_at: string;
};

const GithubUrlSchema = z.string().url().refine(
  (url) => {
    try {
      const host = new URL(url).hostname.toLowerCase();
      return host === "github.com" || host === "www.github.com";
    } catch {
      return false;
    }
  },
  { message: "github_url must be a github.com repository URL." }
);

export const CreateUserProjectBodySchema = z
  .object({
    source_type: z.enum(["local", "github"]),
    display_name: z.string().min(1).max(160),
    local_path: z.string().max(512).optional(),
    github_url: GithubUrlSchema.optional(),
    project_origin: z.string().min(1).max(256).optional(),
  })
  .strict();

export type CreateUserProjectBody = z.infer<typeof CreateUserProjectBodySchema>;

export const BULK_CREATE_USER_PROJECTS_MAX = 50;

export const BulkCreateUserProjectsBodySchema = z
  .object({
    projects: z.array(CreateUserProjectBodySchema).min(1).max(BULK_CREATE_USER_PROJECTS_MAX),
  })
  .strict();

export type BulkCreateUserProjectsBody = z.infer<typeof BulkCreateUserProjectsBodySchema>;

export type BulkCreateUserProjectsResult = {
  created: UserProjectRow[];
  skipped: Array<{ display_name: string; project_origin: string; reason: string }>;
  errors: Array<{ display_name: string; error: string }>;
};

export {
  buildLocalChildProjectInput,
  deriveProjectOriginFromLocalPath,
  joinParentAndRelativeChild,
  normalizePathSegment,
} from "@/lib/services/user-project-paths";

function parseGithubRepository(githubUrl: string): { fullName: string; projectOrigin: string } {
  const url = new URL(githubUrl);
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2) {
    throw new Error("github_url must include owner and repository name.");
  }
  const owner = segments[0];
  const repo = segments[1].replace(/\.git$/i, "");
  const fullName = `${owner}/${repo}`;
  return { fullName, projectOrigin: fullName.slice(0, 256) };
}

export function resolveProjectOriginInput(input: CreateUserProjectBody): string {
  const explicit = sanitizeTenantScope(input.project_origin ?? "");
  if (explicit) return explicit.slice(0, 256);

  if (input.source_type === "local") {
    const path = input.local_path?.trim();
    if (!path) throw new Error("local_path is required for local projects.");
    return deriveProjectOriginFromLocalPath(path);
  }

  const githubUrl = input.github_url?.trim();
  if (!githubUrl) throw new Error("github_url is required for GitHub projects.");
  return parseGithubRepository(githubUrl).projectOrigin;
}

export async function listUserProjects(
  admin: SupabaseClient,
  userId: string
): Promise<UserProjectRow[]> {
  const { data, error } = await admin
    .from("msgf_user_projects")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`list user projects failed: ${error.message}`);
  }

  const rows = (data ?? []) as UserProjectRow[];
  for (const row of rows) {
    const cleaned = sanitizeTenantScope(row.project_origin);
    if (cleaned && cleaned !== row.project_origin) {
      row.project_origin = cleaned;
      void admin
        .from("msgf_user_projects")
        .update({ project_origin: cleaned })
        .eq("id", row.id)
        .eq("user_id", userId)
        .then(({ error: repairErr }) => {
          if (repairErr) {
            console.warn(
              `[user-projects] project_origin repair failed for ${row.id}:`,
              repairErr.message
            );
          }
        });
    }
  }
  return rows;
}

export async function createUserProject(
  admin: SupabaseClient,
  userId: string,
  input: CreateUserProjectBody
): Promise<UserProjectRow> {
  const projectOrigin = resolveProjectOriginInput(input);
  let localPath: string | null = null;
  let githubUrl: string | null = null;
  let repositoryFullName: string | null = null;

  if (input.source_type === "local") {
    localPath = input.local_path?.trim() ?? null;
  } else {
    const parsed = parseGithubRepository(input.github_url!.trim());
    githubUrl = input.github_url!.trim();
    repositoryFullName = parsed.fullName;
  }

  const { data, error } = await admin
    .from("msgf_user_projects")
    .insert({
      user_id: userId,
      source_type: input.source_type,
      display_name: input.display_name.trim(),
      local_path: localPath,
      github_url: githubUrl,
      repository_full_name: repositoryFullName,
      project_origin: projectOrigin,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`create user project failed: ${error.message}`);
  }

  return data as UserProjectRow;
}

export async function deleteUserProject(
  admin: SupabaseClient,
  userId: string,
  projectId: string
): Promise<void> {
  const { error } = await admin
    .from("msgf_user_projects")
    .delete()
    .eq("id", projectId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`delete user project failed: ${error.message}`);
  }
}

/**
 * Create many project mappings. Duplicate `project_origin` rows are skipped (not hard errors).
 */
export async function createUserProjectsBulk(
  admin: SupabaseClient,
  userId: string,
  inputs: CreateUserProjectBody[]
): Promise<BulkCreateUserProjectsResult> {
  const created: UserProjectRow[] = [];
  const skipped: BulkCreateUserProjectsResult["skipped"] = [];
  const errors: BulkCreateUserProjectsResult["errors"] = [];
  const seenOrigins = new Set<string>();

  for (const input of inputs) {
    let projectOrigin: string;
    try {
      projectOrigin = resolveProjectOriginInput(input);
    } catch (e) {
      errors.push({
        display_name: input.display_name,
        error: e instanceof Error ? e.message : String(e),
      });
      continue;
    }

    if (seenOrigins.has(projectOrigin)) {
      skipped.push({
        display_name: input.display_name,
        project_origin: projectOrigin,
        reason: "duplicate_in_request",
      });
      continue;
    }
    seenOrigins.add(projectOrigin);

    try {
      const row = await createUserProject(admin, userId, input);
      created.push(row);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const isDuplicate =
        /duplicate|unique|msgf_user_projects_user_origin/i.test(message) ||
        /23505/.test(message);
      if (isDuplicate) {
        skipped.push({
          display_name: input.display_name,
          project_origin: projectOrigin,
          reason: "already_mapped",
        });
      } else {
        errors.push({ display_name: input.display_name, error: message });
      }
    }
  }

  return { created, skipped, errors };
}
