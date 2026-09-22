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
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import {
  BulkCreateUserProjectsBodySchema,
  createUserProjectsBulk,
} from "@/lib/services/user-projects";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

async function requireUser() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

/** POST — bulk create project mappings (max 50). */
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BulkCreateUserProjectsBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const admin = createAdminClient();
    const result = await createUserProjectsBulk(admin, user.id, parsed.data.projects);
    const ok = result.errors.length === 0;
    return NextResponse.json(
      {
        ok,
        created: result.created,
        skipped: result.skipped,
        errors: result.errors,
        created_count: result.created.length,
        skipped_count: result.skipped.length,
        error_count: result.errors.length,
      },
      { status: ok || result.created.length > 0 ? 201 : 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to bulk create projects.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
