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
 * Distribution Build ID: MSGF-1013d7a-20260522T022234Z-internal
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
 * Distribution Build ID: MSGF-1013d7a-20260522T021802Z-internal
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
 * Distribution Build ID: MSGF-1013d7a-20260522T021523Z-internal
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
 * Distribution Build ID: MSGF-1013d7a-20260522T020901Z-internal
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
 * Distribution Build ID: MSGF-1013d7a-20260522T020416Z-internal
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
 * Distribution Build ID: MSGF-1013d7a-20260522T015948Z-internal
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
 * Distribution Build ID: MSGF-1013d7a-20260522T015504Z-internal
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
 * Distribution Build ID: MSGF-1013d7a-20260522T015202Z-internal
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
 * Distribution Build ID: MSGF-1013d7a-20260522T014746Z-internal
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
 * Distribution Build ID: MSGF-1013d7a-20260522T014449Z-internal
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
 * Distribution Build ID: MSGF-1013d7a-20260522T014202Z-internal
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
 * Distribution Build ID: MSGF-1013d7a-20260522T013808Z-internal
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { PricingCtaButton } from "@/app/_components/pricing/PricingCtaButton";

type IdeCredentials = {
  apiUrl: string;
  tenantKey: string;
  accessToken: string;
  expiresAt: number | null;
  settingsJson: string;
  settingsPath: string;
  projectCount: number;
};

type Props = {
  apiUrl: string;
  tenantKey: string;
  projectCount: number;
};

function CopyField({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [value]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        <button
          type="button"
          onClick={() => void onCopy()}
          className="rounded-md border border-slate-600/60 bg-slate-800/60 px-2.5 py-1 text-xs font-medium text-slate-200 transition hover:bg-slate-700/80"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        className={`max-h-48 overflow-auto rounded-lg border border-slate-700/60 bg-slate-950/80 p-3 text-xs text-emerald-100/90 ${mono ? "font-mono" : ""}`}
      >
        {value}
      </pre>
    </div>
  );
}

function StepBadge({ n, done }: { n: number; done?: boolean }) {
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
        done
          ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/40"
          : "bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/30"
      }`}
    >
      {done ? "✓" : n}
    </span>
  );
}

export function WorkspaceIdeSetup({ apiUrl, tenantKey, projectCount }: Props) {
  const [creds, setCreds] = useState<IdeCredentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCredentials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/workspace/ide-credentials", { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as IdeCredentials & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Could not load IDE credentials.");
      }
      setCreds(data);
    } catch (e) {
      setCreds(null);
      setError(e instanceof Error ? e.message : "Could not load IDE credentials.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCredentials();
  }, [loadCredentials]);

  const settingsPreview =
    creds?.settingsJson ??
    JSON.stringify(
      {
        "msgf.apiUrl": apiUrl,
        "msgf.tenantKey": tenantKey,
        "msgf.authToken": "<click Refresh token after sign-in>",
        "msgf.role": "dev",
      },
      null,
      2
    );

  return (
    <section
      id="ide-setup"
      className="glass-panel rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.03] p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300/90">
            IDE setup
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-100">Connect Cursor or VS Code</h2>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            Three steps: paste settings, install the guard extension, then open your repo. Pulse uses
            your sign-in token and personal sandbox tenant — no manual license minting.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadCredentials()}
          disabled={loading}
          className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh token"}
        </button>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {error}
        </p>
      ) : null}

      <ol className="mt-6 space-y-6">
        <li className="flex gap-4">
          <StepBadge n={1} done={Boolean(creds?.accessToken)} />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h3 className="font-medium text-slate-100">Paste into your repo</h3>
              <p className="mt-1 text-sm text-slate-400">
                In the project you are guarding, create or edit{" "}
                <code className="text-violet-200">.vscode/settings.json</code> and merge the block
                below. Reload the window after saving.
              </p>
            </div>
            <CopyField label="VS Code / Cursor workspace settings" value={settingsPreview} />
            {creds?.expiresAt ? (
              <p className="text-xs text-slate-500">
                Session token expires{" "}
                {new Date(creds.expiresAt * 1000).toLocaleString()}. Use{" "}
                <strong className="text-slate-400">Refresh token</strong> here, then update{" "}
                <code className="text-violet-200">msgf.authToken</code> in the IDE when Pulse stops
                authenticating.
              </p>
            ) : null}
          </div>
        </li>

        <li className="flex gap-4">
          <StepBadge n={2} />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h3 className="font-medium text-slate-100">Install msgf-pulse-guard</h3>
              <p className="mt-1 text-sm text-slate-400">
                Download the <code className="text-violet-200">.vsix</code>, then in Cursor/VS Code:
                Extensions → ⋯ → <strong className="text-slate-300">Install from VSIX…</strong>
              </p>
            </div>
            <div className="max-w-xs">
              <PricingCtaButton
                kind="extension_download"
                label="Download extension"
                variant="outline"
              />
            </div>
          </div>
        </li>

        <li className="flex gap-4">
          <StepBadge n={3} done={projectCount > 0} />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h3 className="font-medium text-slate-100">Open your repo & verify Pulse</h3>
              <p className="mt-1 text-sm text-slate-400">
                Type in a file, wait a few seconds, and check the MSGF status bar (green/amber/ruby).
                Map the same folder on the dashboard so pillar health matches your code.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/setup/projects"
                className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/20"
              >
                {projectCount > 0 ? "Manage mapped projects" : "Map this project"} →
              </Link>
              <Link
                href="/dashboard"
                className="rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-100 transition hover:bg-violet-500/20"
              >
                Governance dashboard →
              </Link>
            </div>
          </div>
        </li>
      </ol>

      <details className="mt-6 rounded-xl border border-slate-700/50 bg-slate-900/30 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-300">
          Optional: bring your own model keys (BYOK)
        </summary>
        <p className="mt-3 text-sm text-slate-400">
          For dual-model consensus on your own API wallet, add keys under{" "}
          <code className="text-violet-200">.msgf/keys/gemini.key</code> and{" "}
          <code className="text-violet-200">.msgf/keys/claude.key</code> in the repo root. Or use a
          managed Pro license —{" "}
          <Link href="/pricing" className="text-violet-300 hover:underline">
            compare tiers
          </Link>
          .
        </p>
      </details>
    </section>
  );
}
