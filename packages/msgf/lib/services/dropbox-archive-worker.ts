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
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  dropboxArchiveMockMode,
  persistArchiveResult,
  uploadSignedArchive,
} from "@/lib/services/dropbox-archive";
import {
  dequeueMsgfJob,
  type DropboxArchiveJob,
} from "@/lib/services/msgf-job-queue";

export type ProcessArchiveJobsResult = {
  processed: number;
  mocked: number;
  errors: number;
};

export async function processDropboxArchiveJobs(
  admin: SupabaseClient,
  opts?: { limit?: number }
): Promise<ProcessArchiveJobsResult> {
  const limit = Math.min(Math.max(opts?.limit ?? 10, 1), 50);
  let processed = 0;
  let mocked = 0;
  let errors = 0;

  for (let i = 0; i < limit; i++) {
    const job = await dequeueMsgfJob("dropbox-archive");
    if (!job || job.type !== "dropbox-archive") break;
    processed += 1;

    try {
      const mockedJob = await handleOneArchiveJob(admin, job);
      if (mockedJob) mocked += 1;
    } catch (e) {
      errors += 1;
      console.warn("[dropbox-archive] job failed:", e instanceof Error ? e.message : e);
      if (job.envelope_id) {
        await admin
          .from("msgf_docusign_envelopes")
          .update({ archive_status: "failed" })
          .eq("id", job.envelope_id);
      }
    }
  }

  return { processed, mocked, errors };
}

async function handleOneArchiveJob(
  admin: SupabaseClient,
  job: DropboxArchiveJob
): Promise<boolean> {
  const { data: company } = await admin
    .from("msgf_companies")
    .select("display_name, dropbox_archive_path")
    .eq("id", job.company_id)
    .maybeSingle();

  const companyName = (company as { display_name?: string } | null)?.display_name;
  const companySlug =
    companyName?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48) ||
    job.company_id.slice(0, 8);

  // Prefer company override as Dropbox path root via env-style DROPBOX_ARCHIVE_ROOT for this job
  const pathOverride = (company as { dropbox_archive_path?: string | null } | null)
    ?.dropbox_archive_path?.trim();
  const prevRoot = process.env.DROPBOX_ARCHIVE_ROOT;
  if (pathOverride) {
    process.env.DROPBOX_ARCHIVE_ROOT = pathOverride;
  }

  try {
    const result = await uploadSignedArchive({
      companyId: job.company_id,
      companySlug,
      inviteId: job.invite_id,
      envelopeId: job.envelope_id,
      provider: job.provider,
    });

    await persistArchiveResult(admin, {
      companyId: job.company_id,
      inviteId: job.invite_id,
      envelopeId: job.envelope_id,
      result,
    });

    return result.mocked || dropboxArchiveMockMode();
  } finally {
    if (pathOverride) {
      if (prevRoot === undefined) delete process.env.DROPBOX_ARCHIVE_ROOT;
      else process.env.DROPBOX_ARCHIVE_ROOT = prevRoot;
    }
  }
}
