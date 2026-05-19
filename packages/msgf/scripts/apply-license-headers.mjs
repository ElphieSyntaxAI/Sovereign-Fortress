#!/usr/bin/env node
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
 * Distribution Build ID: MSGF-753c05a-20260519T050509Z-internal
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
 * Distribution Build ID: MSGF-f70c13c-20260519T044237Z-internal
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
 * Distribution Build ID: MSGF-ee924ab-20260518T235305Z-internal
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
 * Distribution Build ID: MSGF-4e22f0c-20260518T205132Z-internal
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
 * Distribution Build ID: MSGF-51d39b5-20260516T031044Z-internal
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
 * Distribution Build ID: MSGF-2d8d295-20260516T002421Z-internal
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
 * Distribution Build ID: MSGF-2d8d295-20260516T002100Z-internal
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
 * Distribution Build ID: MSGF-2d8d295-20260516T001739Z-internal
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
 * Distribution Build ID: MSGF-7175065-20260515T200509Z-internal
 */
/**
 * Applies the Elphie Syntax LLC proprietary license header to MSGF package source files.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveMsgfBuildId, writeBuildIdManifest } from "./resolve-build-id.mjs";

const pkgRoot = join(fileURLToPath(new URL("..", import.meta.url)));
const MARKER = "@msgf-license-header";

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".next",
  "out",
  "build",
  ".git",
  ".agents",
  ".github",
]);

const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".sql",
]);

function blockHeader(buildId) {
  return [
    "/**",
    ` * ${MARKER}`,
    " * Proprietary and Confidential",
    " * Copyright (c) Elphie Syntax LLC. All Rights Reserved.",
    " *",
    " * This source code and associated documentation are the exclusive property of",
    " * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or",
    " * reverse-engineering — including decompilation, disassembly, or derivative",
    " * works — is strictly prohibited without prior written consent.",
    " *",
    ` * Distribution Build ID: ${buildId}`,
    " */",
    "",
  ].join("\n");
}

function sqlHeader(buildId) {
  return [
    "-- =============================================================================",
    `-- ${MARKER}`,
    "-- Proprietary and Confidential",
    "-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.",
    "--",
    "-- Unauthorized copying, distribution, publication, or reverse-engineering",
    "-- is strictly prohibited without prior written consent from Elphie Syntax LLC.",
    "--",
    `-- Distribution Build ID: ${buildId}`,
    "-- =============================================================================",
    "",
  ].join("\n");
}

function stripExistingHeader(content, ext) {
  if (ext === ".sql") {
    if (!content.includes(MARKER)) return content;
    const lines = content.split("\n");
    if (!lines[0]?.startsWith("-- ===")) return content;
    let end = 0;
    for (let i = 1; i < lines.length; i += 1) {
      if (lines[i].startsWith("-- ===")) {
        end = i + 1;
        break;
      }
    }
    while (end < lines.length && lines[end].trim() === "") end += 1;
    return lines.slice(end).join("\n");
  }

  const block = /^\/\*\*[\s\S]*?@msgf-license-header[\s\S]*?\*\/\s*/;
  if (block.test(content)) {
    return content.replace(block, "");
  }
  return content;
}

function leadingDirectives(content) {
  const preserved = [];
  let rest = content;

  if (rest.startsWith("#!")) {
    const nl = rest.indexOf("\n");
    preserved.push(rest.slice(0, nl + 1));
    rest = rest.slice(nl + 1);
  }

  const useClient = rest.match(/^["']use client["'];\s*\n/);
  if (useClient) {
    preserved.push(useClient[0]);
    rest = rest.slice(useClient[0].length);
  }

  const useStrict = rest.match(/^["']use strict["'];\s*\n/);
  if (useStrict) {
    preserved.push(useStrict[0]);
    rest = rest.slice(useStrict[0].length);
  }

  return { preserved: preserved.join(""), rest: rest.replace(/^\s+/, "") };
}

function applyHeader(filePath, buildId) {
  const ext = extname(filePath);
  let content = readFileSync(filePath, "utf8");
  content = stripExistingHeader(content, ext);
  const { preserved, rest } = leadingDirectives(content);
  const header = ext === ".sql" ? sqlHeader(buildId) : blockHeader(buildId);
  writeFileSync(filePath, preserved + header + rest, "utf8");
}

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walk(path, files);
    } else if (SOURCE_EXTENSIONS.has(extname(name))) {
      if (name.endsWith(".d.ts") && path.includes(`${join("dist", "")}`)) continue;
      if (name === "next-env.d.ts") continue;
      files.push(path);
    }
  }
  return files;
}

const buildId = resolveMsgfBuildId();
const manifest = writeBuildIdManifest(buildId);
const files = walk(pkgRoot).sort();

let updated = 0;
for (const file of files) {
  applyHeader(file, buildId);
  updated += 1;
  console.log(`[license-header] ${relative(pkgRoot, file)}`);
}

console.log(`[license-header] Build ID: ${buildId}`);
console.log(`[license-header] Manifest: ${relative(pkgRoot, manifest)}`);
console.log(`[license-header] Updated ${updated} file(s).`);
