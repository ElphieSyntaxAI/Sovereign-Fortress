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
 * Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
 */
import { cookies, headers } from "next/headers";

import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

export default async function TodosPage() {
  const cookieStore = await cookies();
  const hdrs = await headers();
  const supabase = createClient(cookieStore, requestHostFromHeaders(hdrs));

  const { data: todos, error } = await supabase.from("todos").select();

  if (error) {
    return (
      <main className="mx-auto max-w-xl space-y-4 p-6">
        <h1 className="text-xl font-semibold text-zinc-50">Todos</h1>
        <p className="text-sm text-amber-300/90">
          Could not load <code className="text-amber-200">todos</code>: {error.message}
        </p>
        <p className="text-sm text-zinc-400">
          Apply the demo migration under <code className="text-zinc-200">packages/msgf/supabase/migrations</code> to your
          project (e.g. <code className="text-zinc-200">supabase db push</code>) or create the table in the SQL editor.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-xl font-semibold text-zinc-50">Todos</h1>
      {todos?.length ? (
        <ul className="list-inside list-disc space-y-1 text-zinc-200">
          {todos.map((todo) => (
            <li key={todo.id}>{todo.name}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-400">No rows yet. Insert rows into <code className="text-zinc-200">todos</code> in Supabase.</p>
      )}
    </main>
  );
}
