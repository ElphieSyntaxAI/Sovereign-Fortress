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
 * Distribution Build ID: MSGF-149f647f-20260728T230931Z-internal
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
 * Distribution Build ID: MSGF-c1a5d75-20260723T221428Z-internal
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
 * Distribution Build ID: MSGF-c1a5d75-20260723T221141Z-internal
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
 * Distribution Build ID: MSGF-c1a5d75-20260723T220451Z-internal
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
 * Distribution Build ID: MSGF-a7aa881-20260620T084430Z-internal
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
 * Distribution Build ID: MSGF-48a02b8-20260530T050749Z-internal
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
 * Distribution Build ID: MSGF-48a02b8-20260530T050211Z-internal
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
 * Distribution Build ID: MSGF-48a02b8-20260530T045550Z-internal
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
 * Distribution Build ID: MSGF-48a02b8-20260530T045125Z-internal
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
 * Distribution Build ID: MSGF-48a02b8-20260530T044603Z-internal
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
 * Distribution Build ID: MSGF-3a4c1de-20260529T200349Z-internal
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { PricingCtaButton } from "@/app/_components/pricing/PricingCtaButton";
import {
  CopyField,
  InfoTip,
  PULSE_GUARD_TRACKING,
  StepBadge,
} from "@/app/_components/workspace/workspace-ui";
import type { UserProjectRow } from "@/lib/services/user-projects";

type IdeCredentials = {
  apiUrl: string;
  tenantKey: string;
  accessToken: string;
  expiresAt: number | string | null;
  settingsJson: string;
  settingsPath: string;
  vscodeUri?: string;
  longLived?: { tokenId: string; expiresAt: string; ttlDays: number };
  hasActiveIdeToken?: boolean;
  tokenKind?: "long_lived" | "long_lived_active" | "needs_mint";
  ideToken?: string;
};

type Props = {
  project: UserProjectRow;
  apiUrl: string;
};

function formatExpiry(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const d = new Date(expiresAt);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString(undefined, { dateStyle: "long" }) : null;
}

function PulseStatusIndicator({ active }: { active: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">
      <span
        className={`relative flex h-3 w-3 rounded-full ${
          active ? "bg-emerald-400" : "bg-amber-400"
        }`}
        aria-hidden
      >
        {active ? (
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60" />
        ) : null}
      </span>
      <div className="text-xs">
        <p className="font-medium text-slate-200">MSGF status bar</p>
        <p className={active ? "text-emerald-300/90" : "text-amber-200/90"}>
          {active ? "Green · pulse connected" : "Amber · awaiting editor activity"}
        </p>
      </div>
    </div>
  );
}

export function WorkspaceProjectIdePanel({ project, apiUrl }: Props) {
  const [creds, setCreds] = useState<IdeCredentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [minting, setMinting] = useState(false);
  const [tokenExpires, setTokenExpires] = useState<string | null>(null);
  const [hasActive, setHasActive] = useState(false);

  const projectOrigin = project.project_origin;

  const loadCredentials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = `?project_origin=${encodeURIComponent(projectOrigin)}`;
      const res = await fetch(`/api/workspace/ide-credentials${q}`, { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as IdeCredentials & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Could not load IDE credentials.");
      }
      // GET never returns plaintext tokens — keep a just-minted settings block visible.
      setCreds((prev) => {
        const keepMintedPreview =
          Boolean(prev?.settingsJson?.includes("msgf_ide_")) &&
          !data.settingsJson?.includes("msgf_ide_");
        if (!keepMintedPreview) return data;
        return {
          ...data,
          settingsJson: prev!.settingsJson,
          ideToken: prev!.ideToken ?? data.ideToken,
          tokenKind: prev!.tokenKind ?? data.tokenKind,
          longLived: prev!.longLived ?? data.longLived,
        };
      });
    } catch (e) {
      setCreds(null);
      setError(e instanceof Error ? e.message : "Could not load IDE credentials.");
    } finally {
      setLoading(false);
    }
  }, [projectOrigin]);

  const refreshTokenStatus = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/workspace/ide-tokens?project_origin=${encodeURIComponent(projectOrigin)}`,
        { credentials: "include" }
      );
      const data = (await res.json().catch(() => ({}))) as {
        has_active_token?: boolean;
        tokens?: Array<{ expires_at: string }>;
      };
      setHasActive(Boolean(data.has_active_token));
      setTokenExpires(data.tokens?.[0]?.expires_at ?? null);
    } catch {
      setHasActive(false);
      setTokenExpires(null);
    }
  }, [projectOrigin]);

  const mintLongLivedToken = useCallback(async () => {
    setMinting(true);
    setError(null);
    try {
      const res = await fetch("/api/workspace/ide-tokens", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_origin: projectOrigin,
          label: `${project.display_name} workspace mint`,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as IdeCredentials & {
        ok?: boolean;
        error?: string;
        warning?: string;
      };
      if (!res.ok || data.ok === false) {
        const msg =
          (data as { message?: string }).message ??
          data.error ??
          "Could not mint IDE token.";
        throw new Error(msg);
      }
      if (!data.ideToken || !data.settingsJson?.includes("msgf_ide_")) {
        throw new Error("Mint succeeded but no token was returned. Try again or contact support.");
      }
      setCreds((prev) => ({
        apiUrl: data.apiUrl ?? prev?.apiUrl ?? apiUrl,
        tenantKey: data.tenantKey ?? projectOrigin,
        accessToken: data.ideToken ?? "",
        settingsJson: data.settingsJson ?? prev?.settingsJson ?? "",
        settingsPath: data.settingsPath ?? ".vscode/settings.json",
        vscodeUri: data.vscodeUri,
        longLived: data.longLived,
        expiresAt: data.expiresAt ?? prev?.expiresAt ?? null,
        hasActiveIdeToken: true,
        tokenKind: "long_lived",
        ideToken: data.ideToken,
      }));
      setTestStatus(
        data.warning ??
          `Long-lived token minted (${data.longLived?.ttlDays ?? 90} days). Copy settings in Step 2.`
      );
      await refreshTokenStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mint failed.");
    } finally {
      setMinting(false);
    }
  }, [apiUrl, loadCredentials, project.display_name, projectOrigin, refreshTokenStatus]);

  const runConnectionTest = useCallback(async () => {
    setTesting(true);
    setTestStatus(null);
    try {
      const q = `?project_origin=${encodeURIComponent(projectOrigin)}`;
      const res = await fetch(`/api/workspace/ide-connectivity-check${q}`, {
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        checks?: Array<{ name: string; ok: boolean; user_message?: string; error_code?: string }>;
      };
      if (data.ok) {
        setTestStatus("All checks passed — reload the IDE window after pasting settings.");
      } else {
        const failed = (data.checks ?? []).filter((c) => !c.ok);
        setTestStatus(
          failed.length
            ? failed
                .map(
                  (c) =>
                    `${c.name}: ${c.user_message ?? "failed"}${c.error_code ? ` [${c.error_code}]` : ""}`
                )
                .join(" · ")
            : "Connection check failed."
        );
      }
    } catch (e) {
      setTestStatus(e instanceof Error ? e.message : "Connection test failed.");
    } finally {
      setTesting(false);
    }
  }, [projectOrigin]);

  useEffect(() => {
    void loadCredentials();
    void refreshTokenStatus();
  }, [loadCredentials, refreshTokenStatus]);

  const settingsPreview =
    creds?.settingsJson ??
    JSON.stringify(
      {
        "msgf.apiUrl": apiUrl,
        "msgf.tenantKey": projectOrigin,
        "msgf.authToken": "<mint a long-lived IDE token>",
        "msgf.role": "dev",
      },
      null,
      2
    );

  const expiryLabel =
    formatExpiry(tokenExpires) ??
    (creds?.expiresAt
      ? new Date(String(creds.expiresAt)).toLocaleDateString(undefined, { dateStyle: "long" })
      : null);

  const authDone = Boolean(creds?.hasActiveIdeToken || creds?.ideToken || hasActive);
  const configDone = Boolean(creds?.settingsJson?.includes("msgf_ide_"));
  const verifyDone = authDone && configDone;

  if (loading && !creds) {
    return <p className="text-sm text-slate-500">Loading IDE configuration…</p>;
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {error}
        </p>
      ) : null}
      {testStatus ? (
        <p
          className={`rounded-lg border px-3 py-2 text-sm ${
            testStatus.startsWith("All checks")
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
              : "border-amber-500/30 bg-amber-500/10 text-amber-100"
          }`}
        >
          {testStatus}
        </p>
      ) : null}

      <ol className="space-y-6">
        <li className="flex gap-4">
          <StepBadge n={1} done={authDone} />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h4 className="font-medium text-slate-100">
                Authentication
                <InfoTip label="IDE token lifetime">
                  Mint a <strong className="text-slate-200">long-lived IDE token</strong> (
                  <code className="text-violet-200">msgf_ide_*</code>, ~90 days) for Pulse Guard.
                  Do not paste your browser session JWT (<code className="text-violet-200">eyJ…</code>
                  ) — it expires in about one hour.
                </InfoTip>
              </h4>
              <p className="mt-1 font-mono text-sm text-cyan-200/90">{projectOrigin}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void mintLongLivedToken()}
                disabled={minting}
                className="rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-100 transition hover:bg-violet-500/20 disabled:opacity-50"
              >
                {minting ? "Minting…" : "Mint New Long-Lived IDE Token"}
              </button>
              <button
                type="button"
                onClick={() => void runConnectionTest()}
                disabled={testing}
                className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-50"
              >
                {testing ? "Testing…" : "Test Connection"}
              </button>
            </div>
          </div>
        </li>

        <li className="flex gap-4">
          <StepBadge n={2} done={configDone} />
          <div className="min-w-0 flex-1 space-y-3">
            <h4 className="font-medium text-slate-100">Configuration</h4>
            <p className="text-sm text-slate-400">
              Merge into <code className="text-violet-200">.vscode/settings.json</code> in the
              folder you open in the IDE.
            </p>
            <CopyField label="VS Code / Cursor workspace settings" value={settingsPreview} />
            {creds?.vscodeUri ? (
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={creds.vscodeUri}
                  className="inline-flex rounded-full border border-violet-500/35 bg-violet-500/15 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/25"
                >
                  Open directly in Cursor / VS Code
                </a>
                <InfoTip label="Deep link security">
                  Applies settings via deep link — token visible in URL; use only on your machine.
                </InfoTip>
              </div>
            ) : null}
          </div>
        </li>

        <li className="flex gap-4">
          <StepBadge n={3} done={verifyDone} />
          <div className="min-w-0 flex-1 space-y-4">
            <h4 className="font-medium text-slate-100">Verification</h4>
            <div className="flex flex-wrap items-center gap-3">
              <div className="max-w-xs">
                <PricingCtaButton
                  kind="extension_download"
                  label="Download Extension .vsix"
                  variant="outline"
                />
              </div>
              <PulseStatusIndicator active={verifyDone} />
            </div>
            <p className="text-xs text-slate-500">
              Type in a guarded file, wait a few seconds, and confirm the status bar shows green
              (amber/ruby when drift or incidents need attention).
            </p>
          </div>
        </li>
      </ol>

      <section className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
        <h4 className="text-sm font-semibold text-slate-100">Local Pulse Guard rules</h4>
        <p className="mt-1 text-xs text-slate-500">
          File types and paths the extension actively tracks in this workspace.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300/80">
              Guarded extensions
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {PULSE_GUARD_TRACKING.extensions.map((ext) => (
                <li
                  key={ext}
                  className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-100"
                >
                  {ext}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-300/80">
              Path filters (ignored)
            </p>
            <ul className="mt-2 space-y-1">
              {PULSE_GUARD_TRACKING.pathFilters.map((rule) => (
                <li
                  key={rule}
                  className="flex items-center gap-2 font-mono text-[10px] text-slate-400"
                >
                  <span className="text-rose-400/80" aria-hidden>
                    ✕
                  </span>
                  {rule}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/dashboard"
          className="text-emerald-300 underline-offset-4 hover:underline"
        >
          Governance dashboard →
        </Link>
        {expiryLabel ? (
          <span className="text-slate-500">Token expires {expiryLabel}</span>
        ) : null}
      </div>
    </div>
  );
}
