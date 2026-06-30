import * as fs from "node:fs";
import * as path from "node:path";

import * as vscode from "vscode";

import { getMsgfDir, getWorkspaceRoot } from "./workspace/msgfWorkspace";

export const SHADOW_SCAN_DIR = "shadow-scan";
export const SHADOW_SCAN_AUDIT_FILE = "pre_ingestion_audit.md";
export const SHADOW_SCAN_MANIFEST_FILE = "last-scan.json";

export function getShadowScanDir(workspaceRoot: string): string {
  return path.join(getMsgfDir(workspaceRoot), SHADOW_SCAN_DIR);
}

export function getShadowScanAuditPath(workspaceRoot: string): string {
  return path.join(getShadowScanDir(workspaceRoot), SHADOW_SCAN_AUDIT_FILE);
}

export type ShadowScanArtifactInput = {
  auditMarkdown: string;
  projectOrigin?: string;
  lineageMap?: unknown;
  detail?: Record<string, unknown>;
};

export type ShadowScanArtifactPaths = {
  workspaceRoot: string;
  auditPath: string;
  manifestPath: string;
  relativeAuditPath: string;
};

/** Persist SWEEP output under `.msgf/shadow-scan/` (client-side; server cannot write the IDE workspace). */
export function saveShadowScanArtifacts(
  input: ShadowScanArtifactInput
): ShadowScanArtifactPaths | null {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot || !input.auditMarkdown.trim()) return null;

  const scanDir = getShadowScanDir(workspaceRoot);
  fs.mkdirSync(scanDir, { recursive: true });

  const auditPath = path.join(scanDir, SHADOW_SCAN_AUDIT_FILE);
  fs.writeFileSync(auditPath, input.auditMarkdown, "utf8");

  const manifestPath = path.join(scanDir, SHADOW_SCAN_MANIFEST_FILE);
  const manifest = {
    saved_at: new Date().toISOString(),
    project_origin: input.projectOrigin ?? null,
    lineage_map: input.lineageMap ?? null,
    detail: input.detail ?? null,
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  const readmePath = path.join(scanDir, "README.md");
  if (!fs.existsSync(readmePath)) {
    fs.writeFileSync(
      readmePath,
      [
        "# MSGF shadow scan",
        "",
        "Artifacts from **Trigger Shadow Scan** in the MSGF Command Center.",
        "",
        "| File | Purpose |",
        "|------|---------|",
        "| `pre_ingestion_audit.md` | SWEEP audit + lineage map |",
        "| `last-scan.json` | Timestamp + ingest metadata |",
        "",
      ].join("\n"),
      "utf8"
    );
  }

  const relativeAuditPath = path
    .relative(workspaceRoot, auditPath)
    .replace(/\\/g, "/");

  return { workspaceRoot, auditPath, manifestPath, relativeAuditPath };
}

export async function openShadowScanAudit(relativePath: string): Promise<void> {
  const root = getWorkspaceRoot();
  if (!root) return;
  const uri = vscode.Uri.file(path.join(root, relativePath));
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc, { preview: false });
}
