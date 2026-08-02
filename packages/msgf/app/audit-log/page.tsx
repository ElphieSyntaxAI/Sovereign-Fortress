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
 * Distribution Build ID: MSGF-149f647f-20260728T230931Z-internal
 */
import Link from "next/link";
import { cookies, headers } from "next/headers";

import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";
import { tenantGuard } from "@msgf/lib/guard";
import {
  DEMO_TENANT_ACME_UUID,
  DEMO_TENANT_GLOBEX_UUID,
  DEMO_TENANT_INTRUDER_UUID,
} from "@msgf/lib/tenant-ids";

type NarrativeRow = {
  id: string;
  created_at: string;
  tenant_id: string;
  actor_id: string | null;
  action_type: string | null;
  message: string;
  severity: string | null;
  metadata: Record<string, unknown> | null;
};

export default async function AuditLogPage() {
  const cookieStore = await cookies();
  const hdrs = await headers();
  const supabase = createClient(cookieStore, requestHostFromHeaders(hdrs));

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // We are forcing a mismatch to see if the "immune system" works
  // User is 'acme', but we tell the guard we are looking for 'hacker-hq'
  await tenantGuard(
    { user_metadata: { tenant_id: DEMO_TENANT_ACME_UUID } } as any,
    DEMO_TENANT_INTRUDER_UUID
  );

  const meta = user?.user_metadata as Record<string, unknown> | undefined;
  const jwtTenant =
    typeof meta?.tenant_id === "string" ? meta.tenant_id : null;

  let testA: NarrativeRow[] | null = null;
  let testAError: string | null = null;
  let testB: NarrativeRow[] | null = null;
  let testBError: string | null = null;

  if (user) {
    const a = await supabase
      .from("p4_narrative_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    testA = a.data as NarrativeRow[] | null;
    testAError = a.error?.message ?? null;

    const b = await supabase
      .from("p4_narrative_logs")
      .select("*")
      .eq("tenant_id", DEMO_TENANT_GLOBEX_UUID);
    testB = b.data as NarrativeRow[] | null;
    testBError = b.error?.message ?? null;
  }

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Audit log (RLS acid test)</h1>
        <Link
          href="/"
          className="text-sm text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline"
        >
          Home
        </Link>
      </div>

      {!user ? (
        <p className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-zinc-300">
          Sign in with a user that has{" "}
          <code className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-200">
            user_metadata.tenant_id
          </code>{" "}
          set to a valid UUID string (e.g.{" "}
          <code className="rounded bg-zinc-800 px-1 py-0.5">
            11111111-1111-4111-8111-111111111111
          </code>
          ), then reload this page.
        </p>
      ) : (
        <>
          <section className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
            <h2 className="text-sm font-medium text-zinc-200">Session</h2>
            <p className="text-sm text-zinc-400">
              User: <span className="text-zinc-200">{user.email ?? user.id}</span>
            </p>
            <p className="text-sm text-zinc-400">
              JWT tenant (user_metadata):{" "}
              <span className="text-zinc-200">
                {jwtTenant ?? "— (set in Dashboard → Authentication → Users → User metadata)"}
              </span>
            </p>
          </section>

          <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
            <h2 className="text-sm font-medium text-zinc-200">
              Test A — all visible logs (RLS should restrict to your tenant)
            </h2>
            {testAError ? (
              <p className="text-sm text-red-400">{testAError}</p>
            ) : (
              <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">
                {(testA?.length ?? 0) === 0 ? (
                  <li className="text-zinc-500">No rows returned (or table empty for your tenant).</li>
                ) : (
                  (testA ?? []).map((row) => (
                    <li
                      key={row.id}
                      className="rounded border border-zinc-800/80 bg-zinc-950/60 px-3 py-2"
                    >
                      <span className="text-zinc-500">{row.created_at}</span>{" "}
                      <span className="font-medium text-amber-200/90">{row.tenant_id}</span>{" "}
                      <span className="text-zinc-300">{row.message}</span>
                    </li>
                  ))
                )}
              </ul>
            )}
          </section>

          <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
            <h2 className="text-sm font-medium text-zinc-200">
              Test B — explicit filter{" "}
              <code className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-200">
                tenant_id = {DEMO_TENANT_GLOBEX_UUID}
              </code>{" "}
              (anon key + your session)
            </h2>
            <p className="text-xs text-zinc-500">
              If your JWT tenant is not the Globex demo UUID, RLS should return no rows even if
              Globex data exists.
            </p>
            {testBError ? (
              <p className="text-sm text-red-400">{testBError}</p>
            ) : (
              <p className="text-sm text-zinc-300">
                Row count:{" "}
                <span className="font-mono text-zinc-100">{testB?.length ?? 0}</span>
                {(testB?.length ?? 0) === 0 ? (
                  <span className="ml-2 text-emerald-400/90">(expected silo behavior)</span>
                ) : null}
              </p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
