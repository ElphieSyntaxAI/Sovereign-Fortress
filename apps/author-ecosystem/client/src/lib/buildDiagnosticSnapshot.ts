import type { NarrativeSelection } from "../context/NarrativeContext";
import { bffAuthHeaders, bffCredentials, bffUrl } from "./bffFetch";
import { mergeEditorStateSnapshot } from "./editorSnapshotRegistry";
import { getLastKeystrokes } from "./keystrokeRingBuffer";

export type DiagnosticSnapshotPayload = {
  captured_at: string;
  source: string;
  entity_id?: string;
  /** @deprecated Use `entity_id`. */
  author_id?: string;
  tenant_id?: string;
  editor: Record<string, unknown>;
  keystrokes_last_10: ReturnType<typeof getLastKeystrokes>;
  pillar_health?: Record<string, unknown>;
};

export async function buildDiagnosticSnapshot(params: {
  selection: NarrativeSelection | null;
  entityId?: string;
  /** @deprecated Use `entityId`. */
  authorId?: string;
  getAccessToken?: () => string | null | Promise<string | null>;
}): Promise<DiagnosticSnapshotPayload> {
  const entityId = params.entityId ?? params.authorId;
  const token = params.getAccessToken ? await params.getAccessToken() : null;
  const headers = bffAuthHeaders(token ?? null);

  let pillar_health: Record<string, unknown> | undefined;
  try {
    const res = await fetch(bffUrl("/api/msgf/health/pillars"), {
      ...bffCredentials,
      headers: { Accept: "application/json", ...headers },
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok) pillar_health = data;
    else pillar_health = { ok: false, error: data.error ?? `HTTP ${res.status}` };
  } catch (e) {
    pillar_health = {
      ok: false,
      error: e instanceof Error ? e.message : "pillar health fetch failed",
    };
  }

  const editorExtras = mergeEditorStateSnapshot();

  return {
    captured_at: new Date().toISOString(),
    source: "author_ecosystem",
    entity_id: entityId,
    author_id: entityId,
    tenant_id:
      params.selection?.tenantId ??
      import.meta.env.VITE_MSGF_TENANT_ID?.trim() ??
      "author_ecosystem",
    editor: {
      manuscript_id: params.selection?.manuscriptId ?? null,
      tenant_id: params.selection?.tenantId ?? null,
      manuscript_title: params.selection?.title ?? null,
      revision_status: params.selection?.revision_status ?? null,
      location_href: typeof window !== "undefined" ? window.location.href : undefined,
      ...editorExtras,
    },
    keystrokes_last_10: getLastKeystrokes(10),
    pillar_health,
  };
}
