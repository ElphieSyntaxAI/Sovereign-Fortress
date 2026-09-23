"use client";

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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
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
 * Distribution Build ID: MSGF-1826a636-20260922T233446Z-internal
 */
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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T170731Z-internal
 */
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
/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
/**
 * Shared ops search chrome for governance searchable surfaces.
 */

import type { FormEvent, ReactNode } from "react";

export type GovernanceSearchScope = "global" | "company" | "tenant";

export function AdminGovernanceSearchShell(props: {
  title: string;
  eyebrow?: string;
  description?: string;
  scope?: GovernanceSearchScope;
  query: string;
  onQueryChange: (v: string) => void;
  onSearch: () => void;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  searched?: boolean;
  filters?: ReactNode;
  children?: ReactNode;
  placeholder?: string;
  /** When set, the page-level `?q=` field is the only search box. */
  hideQuery?: boolean;
}) {
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    props.onSearch();
  };

  return (
    <section className="glass-panel rounded-2xl border border-cyan-500/25 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {props.eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/90">
              {props.eyebrow}
            </p>
          ) : null}
          <h2 className="mt-1 text-xl font-semibold text-slate-100">{props.title}</h2>
          {props.description ? (
            <p className="mt-1 max-w-2xl text-sm text-slate-400">{props.description}</p>
          ) : null}
          {props.scope ? (
            <p className="mt-2 inline-flex rounded-md border border-slate-600 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-300">
              Scope: {props.scope}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => props.onSearch()}
          disabled={props.loading}
          className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          {props.loading ? "Searching…" : "Search"}
        </button>
      </div>

      <form onSubmit={onSubmit} className="mt-4 space-y-2">
        {props.hideQuery ? null : (
          <input
            value={props.query}
            onChange={(e) => props.onQueryChange(e.target.value)}
            placeholder={props.placeholder ?? "Search…"}
            className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
            aria-label="Search query"
          />
        )}
        {props.filters}
      </form>

      {props.error ? (
        <p className="mt-3 text-sm text-rose-300" role="alert">
          {props.error}
        </p>
      ) : null}
      {props.searched && props.empty && !props.loading && !props.error ? (
        <p className="mt-3 text-sm text-slate-500">No results.</p>
      ) : null}

      <div className="mt-4">{props.children}</div>
    </section>
  );
}
