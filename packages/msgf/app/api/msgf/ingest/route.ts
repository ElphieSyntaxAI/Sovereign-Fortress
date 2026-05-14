import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";

import {
  determineBranch,
  determineCategory,
  sweepAndIngest,
} from "@/lib/msgf-ingest";
import { getVertexGenerativeModelForId } from "@/packages/core/src/msgf-vertex";
import {
  isTenantApiKeyConfigured,
  resolveTenantIdFromApiKey,
} from "@/lib/api-key-tenant";
import { assertPathsAllowedForTenant } from "@/lib/tenant-silo";
import { logIdentityViolation } from "@/lib/identity-violation-log";
import { resolveCreditGuardGeminiModelId } from "@/lib/creditGuard";

type IngestFile = { path: string; content: string };

type IngestBody = {
  tenant_id?: string;
  files?: IngestFile[];
};

function normalizeRelPath(p: string): string | null {
  const x = p.replace(/\\/g, "/").replace(/^\.\/+/, "");
  if (!x || x.includes("..") || x.startsWith("/")) return null;
  return x;
}

function getApiKey(req: NextRequest): string | null {
  const h = req.headers.get("x-msgf-api-key");
  if (h?.trim()) return h.trim();
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer "))
    return auth.slice(7).trim();
  return null;
}

function buildLineageMap(files: IngestFile[]) {
  return files.map((file) => ({
    path: file.path,
    category_1_0: determineCategory(file.path),
    branch_1_1: determineBranch(file.path),
    instance_1_1_1: "1.1.1",
  }));
}

async function summarizeForAudit(
  req: NextRequest,
  files: IngestFile[],
  lineageMap: ReturnType<typeof buildLineageMap>
) {
  const model = getVertexGenerativeModelForId(resolveCreditGuardGeminiModelId(req));
  const joined = files
    .map((f) => `## ${f.path}\n${f.content}`)
    .join("\n\n")
    .slice(0, 120000);

  const prompt = `Create a markdown report titled "pre_ingestion_audit.md" for MSGF V3.2 ULTRA.

Include:
1) Codebase overview by module
2) Risk hotspots for refactor
3) Suggested shard strategy for 1.0 / 1.1 / 1.1.1
4) Data-safety notes
5) Immediate next steps

Lineage map draft:
${JSON.stringify(lineageMap, null, 2)}

Codebase content:
${joined}
`;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
  });
  return result.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as IngestBody;
    const files = body?.files ?? [];

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: "Expected files: Array<{ path, content }>." },
        { status: 400 }
      );
    }

    const normalizedPaths: string[] = [];
    for (const f of files) {
      const np = normalizeRelPath(f.path);
      if (!np) {
        return NextResponse.json(
          { error: `Invalid or unsafe path: ${f.path}` },
          { status: 400 }
        );
      }
      normalizedPaths.push(np);
    }

    if (isTenantApiKeyConfigured()) {
      const claimed = body.tenant_id?.trim();
      if (!claimed) {
        await logIdentityViolation({
          source: "ingest_api",
          reason: "missing_tenant_id",
        });
        return NextResponse.json(
          { error: "tenant_id is required when MSGF_TENANT_API_KEYS is set." },
          { status: 400 }
        );
      }
      const apiKey = getApiKey(req);
      const resolved = resolveTenantIdFromApiKey(apiKey);
      if (!apiKey || !resolved || resolved !== claimed) {
        await logIdentityViolation({
          source: "ingest_api",
          reason: "tenant_api_key_mismatch",
          claimed_tenant_id: claimed,
          resolved_tenant_id: resolved ?? null,
        });
        return NextResponse.json(
          { error: "Identity violation: tenant_id does not match API key." },
          { status: 403 }
        );
      }
      const silo = assertPathsAllowedForTenant(resolved, normalizedPaths);
      if (!silo.ok) {
        await logIdentityViolation({
          source: "ingest_api",
          reason: "path_silo_violation",
          tenant_id: resolved,
          violations: silo.violations,
        });
        return NextResponse.json(
          {
            error: "Identity violation: one or more paths are outside this tenant silo.",
            violations: silo.violations,
          },
          { status: 403 }
        );
      }
    }

    const lineageMap = buildLineageMap(files);

    // SWEEP: map into P6 Cold Layer.
    const ingestAudit = await sweepAndIngest(files);

    // AI audit synthesis
    const aiAudit = await summarizeForAudit(req, files, lineageMap);

    const finalAuditDoc = [
      "# pre_ingestion_audit.md",
      "",
      "## Lineage Map",
      "```json",
      JSON.stringify(lineageMap, null, 2),
      "```",
      "",
      "## SWEEP Ingestion Log",
      ingestAudit,
      "",
      "## Gemini 2.5 Flash Audit Summary",
      aiAudit || "_No summary generated._",
      "",
    ].join("\n");

    await writeFile(path.join(process.cwd(), "pre_ingestion_audit.md"), finalAuditDoc, "utf8");

    return NextResponse.json({
      ok: true,
      message: "SWEEP complete. pre_ingestion_audit.md saved to project root.",
      lineage_map: lineageMap,
    });
  } catch (err: any) {
    console.error("MSGF ingest route error", err);
    return NextResponse.json(
      { error: err?.message || "Failed to run SWEEP protocol." },
      { status: 500 }
    );
  }
}

