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
 * Distribution Build ID: MSGF-2790974-20260519T053954Z-internal
 */
/**
 * GET /api/downloads/pulse-guard — MSGF Pulse Guard IDE extension (.zip or .vsix).
 */

import { existsSync, readdirSync, readFileSync } from "fs";
import path from "path";

import { NextResponse } from "next/server";

function findExtensionArtifact(): { filePath: string; fileName: string; mime: string } | null {
  const cwd = process.cwd();

  const staticCandidates = [
    { filePath: path.join(cwd, "public", "downloads", "msgf-pulse-guard.zip"), fileName: "msgf-pulse-guard.zip", mime: "application/zip" },
    { filePath: path.join(cwd, "public", "downloads", "msgf-pulse-guard.vsix"), fileName: "msgf-pulse-guard.vsix", mime: "application/vsix" },
    {
      filePath: path.join(cwd, "..", "msgf-pulse-guard", "msgf-pulse-guard.vsix"),
      fileName: "msgf-pulse-guard.vsix",
      mime: "application/vsix",
    },
    {
      filePath: path.join(cwd, "..", "..", "packages", "msgf-pulse-guard", "msgf-pulse-guard.vsix"),
      fileName: "msgf-pulse-guard.vsix",
      mime: "application/vsix",
    },
  ];

  for (const c of staticCandidates) {
    if (existsSync(c.filePath)) return c;
  }

  const vsixDirs = [
    path.join(cwd, "..", "msgf-pulse-guard"),
    path.join(cwd, "..", "..", "packages", "msgf-pulse-guard"),
  ];

  for (const dir of vsixDirs) {
    if (!existsSync(dir)) continue;
    try {
      const vsix = readdirSync(dir)
        .filter((f) => f.endsWith(".vsix"))
        .sort()
        .reverse()[0];
      if (vsix) {
        return {
          filePath: path.join(dir, vsix),
          fileName: vsix,
          mime: "application/vsix",
        };
      }
    } catch {
      /* ignore */
    }
  }

  return null;
}

export async function GET() {
  const artifact = findExtensionArtifact();

  if (!artifact) {
    return NextResponse.json(
      {
        error:
          "Extension package not found. Build with: npm run compile -w msgf-pulse-guard && npx vsce package -o packages/msgf/public/downloads/",
        code: "EXTENSION_ARTIFACT_MISSING",
      },
      { status: 404 }
    );
  }

  const body = readFileSync(artifact.filePath);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": artifact.mime,
      "Content-Disposition": `attachment; filename="${artifact.fileName}"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
