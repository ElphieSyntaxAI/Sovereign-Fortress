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
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import {
  CreateUserProjectBodySchema,
  createUserProject,
  listUserProjects,
  loadProjectActivity,
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

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const projects = await listUserProjects(admin, user.id);
    const activity = await loadProjectActivity(
      admin,
      projects.map((project) => project.project_origin)
    );
    return NextResponse.json({ ok: true, projects, activity });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list projects.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = CreateUserProjectBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const admin = createAdminClient();
    const project = await createUserProject(admin, user.id, parsed.data);
    return NextResponse.json({ ok: true, project }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create project.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
