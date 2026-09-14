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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
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
 * Distribution Build ID: MSGF-c122f849-20260911T160051Z-internal
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
 * Distribution Build ID: MSGF-c122f849-20260911T155844Z-internal
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
 * Distribution Build ID: MSGF-c122f849-20260911T154800Z-internal
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
 * Distribution Build ID: MSGF-c122f849-20260812T073711Z-internal
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
 * Distribution Build ID: MSGF-c122f849-20260812T072718Z-internal
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
 * Distribution Build ID: MSGF-c122f849-20260812T071103Z-internal
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
 * Distribution Build ID: MSGF-c122f849-20260812T065535Z-internal
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
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
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
 * Distribution Build ID: MSGF-149f647f-20260728T230931Z-internal
 */
import { useMemo, useState } from "react";

import {
  buildLocalChildProjectInput,
  deriveProjectOriginFromLocalPath,
  joinParentAndRelativeChild,
} from "@/lib/services/user-project-paths";
import type { UserProjectRow } from "@/lib/services/user-projects";

type Props = {
  projects: UserProjectRow[];
  onMapped: () => Promise<void>;
  setError: (msg: string | null) => void;
  setMessage: (msg: string | null) => void;
};

function supportsDirectoryPicker(): boolean {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

export function LocalSubfolderPickerPanel({ projects, onMapped, setError, setMessage }: Props) {
  const [parentPath, setParentPath] = useState("");
  const [parentName, setParentName] = useState("");
  const [children, setChildren] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [includeParent, setIncludeParent] = useState(false);
  const [manualChildrenText, setManualChildrenText] = useState("");
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);

  const mappedOrigins = useMemo(
    () => new Set(projects.map((p) => p.project_origin)),
    [projects]
  );

  const manualChildren = useMemo(
    () =>
      manualChildrenText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean),
    [manualChildrenText]
  );

  const effectiveChildren = children.length > 0 ? children : manualChildren;

  async function pickParentFolder() {
    if (!supportsDirectoryPicker()) {
      setError(
        "Folder picker needs Chrome or Edge. Use the manual parent path + child folders fields below."
      );
      return;
    }
    setPicking(true);
    setError(null);
    try {
      const picker = window.showDirectoryPicker;
      if (!picker) {
        setError(
          "Folder picker needs Chrome or Edge. Use the manual parent path + child folders fields below."
        );
        return;
      }
      const handle = await picker.call(window, { mode: "read" });
      setParentName(handle.name);
      const names: string[] = [];
      for await (const entry of handle.values()) {
        if (entry.kind === "directory") {
          names.push(entry.name);
        }
      }
      names.sort((a, b) => a.localeCompare(b));
      setChildren(names);
      setSelected(new Set());
      setMessage(
        `Scanned “${handle.name}” — ${names.length} subfolder(s). Enter the absolute parent path below so IDE mappings resolve on disk.`
      );
      if (!parentPath.trim()) {
        setParentPath(handle.name);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Folder picker failed.");
    } finally {
      setPicking(false);
    }
  }

  function toggleChild(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function previewOrigin(relativeChild: string): string {
    const base = parentPath.trim() || parentName || "local";
    return deriveProjectOriginFromLocalPath(joinParentAndRelativeChild(base, relativeChild));
  }

  async function addSelected() {
    const parent = parentPath.trim();
    if (!parent) {
      setError("Enter the parent folder path on disk (required for local mappings).");
      return;
    }

    const toAdd = [...selected];
    if (toAdd.length === 0 && !includeParent) {
      setError("Select at least one subfolder, or include the parent folder.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const projectsPayload = [];
      if (includeParent) {
        const leaf = parent.split(/[/\\]/).filter(Boolean).pop() ?? parent;
        projectsPayload.push({
          source_type: "local" as const,
          display_name: leaf,
          local_path: parent,
          project_origin: deriveProjectOriginFromLocalPath(parent),
        });
      }
      for (const rel of toAdd) {
        projectsPayload.push(buildLocalChildProjectInput({ parentPath: parent, relativeChild: rel }));
      }

      const res = await fetch("/api/msgf/projects/bulk", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projects: projectsPayload }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        created_count?: number;
        skipped_count?: number;
        error?: string;
        errors?: Array<{ error: string }>;
      };
      if (!res.ok && !(json.created_count && json.created_count > 0)) {
        throw new Error(json.error ?? json.errors?.[0]?.error ?? `HTTP ${res.status}`);
      }
      setSelected(new Set());
      setMessage(
        `Mapped ${json.created_count ?? 0} local workspace(s)` +
          (json.skipped_count ? ` (${json.skipped_count} skipped)` : "") +
          "."
      );
      await onMapped();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to map local folders.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="glass-panel rounded-2xl border border-amber-500/20 p-5 sm:p-6">
      <h3 className="text-base font-semibold text-slate-100">Local / monorepo subfolders</h3>
      <p className="mt-1 text-sm text-slate-400">
        Map nested apps (e.g. <code className="text-amber-200">apps/author-ecosystem</code>) as
        separate <code className="text-amber-200">project_origin</code> rows. Browser folder picker
        works in Chrome/Edge; manual paths work everywhere.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={picking}
          onClick={() => void pickParentFolder()}
          className="rounded-full border border-amber-500/40 bg-amber-500/15 px-4 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-500/25 disabled:opacity-50"
        >
          {picking ? "Opening…" : "Pick parent folder"}
        </button>
        {!supportsDirectoryPicker() ? (
          <span className="self-center text-xs text-slate-500">Picker unavailable — use manual entry</span>
        ) : null}
      </div>

      <label className="mt-4 block text-sm text-slate-300">
        Parent path on disk
        <input
          value={parentPath}
          onChange={(e) => setParentPath(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100"
          placeholder="C:/Users/you/Desktop/ElphieSyntaxLLC"
        />
      </label>

      <label className="mt-3 block text-sm text-slate-300">
        Child folders (one per line) — optional if you used the picker
        <textarea
          value={manualChildrenText}
          onChange={(e) => {
            setManualChildrenText(e.target.value);
            if (children.length > 0) setChildren([]);
          }}
          rows={4}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100"
          placeholder={"apps/author-ecosystem\npackages/msgf\napps/syntax-educates"}
        />
      </label>

      <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={includeParent}
          onChange={(e) => setIncludeParent(e.target.checked)}
          className="rounded border-slate-600"
        />
        Also map the parent folder as its own project
      </label>

      {effectiveChildren.length > 0 ? (
        <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-slate-800 p-2">
          {effectiveChildren.map((name) => {
            const origin = previewOrigin(name);
            const mapped = mappedOrigins.has(origin);
            const checked = mapped || selected.has(name);
            return (
              <li key={name}>
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm ${
                    mapped ? "opacity-60" : "hover:bg-slate-900/80"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={mapped}
                    onChange={() => toggleChild(name)}
                    className="rounded border-slate-600"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-mono text-slate-100">{name}</span>
                    <span className="ml-2 font-mono text-[10px] text-slate-500">{origin}</span>
                    {mapped ? (
                      <span className="ml-2 text-[10px] uppercase text-emerald-400">mapped</span>
                    ) : null}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          Pick a parent folder or paste relative child paths to see a checklist.
        </p>
      )}

      <button
        type="button"
        disabled={saving || (selected.size === 0 && !includeParent)}
        onClick={() => void addSelected()}
        className="mt-4 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-50"
      >
        {saving ? "Adding…" : `Add selected (${selected.size}${includeParent ? "+parent" : ""})`}
      </button>
    </section>
  );
}
