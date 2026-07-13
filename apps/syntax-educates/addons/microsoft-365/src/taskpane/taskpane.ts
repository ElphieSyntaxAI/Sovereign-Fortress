/**
 * Syntax Education — Office.js task pane for Word · Excel · PowerPoint.
 * Pillars §3.1 (cross-platform add-on matrix) + §2.4.1 (external telemetry routing).
 *
 * Uses the shared host-agnostic client in `../../shared/the-call-client.ts`.
 */
import {
  acceptUtahDisclosure,
  createCellMutationBatcher,
  createFocusMonitor,
  flushCellMutations,
  flushFocusBeats,
  getUtahDisclosureStatus,
  postCitationCheck,
  postTheCall,
  pushCellMutation,
  recordFocusChange,
  type CitationCheckBody,
  type EcosystemSource,
  type ResearchSnippet,
  type TheCallClientOptions,
  type WritingSurface,
} from "../../../shared/the-call-client";

declare const Office: typeof import("office-js");

// ============================================================================
// Config — sourced from the LTI shadow session (set on add-in load).
// ============================================================================

const MSGF_OPTIONS: TheCallClientOptions = {
  msgfBaseUrl: "https://msgf.elphiesyntax.com",
  entityId: window.localStorage.getItem("edu_entity_id") ?? "",
  tenantId: "syntax_education",
};
const ECOSYSTEM_SOURCE: EcosystemSource = "MS_OFFICE_EDIT";

function detectOfficeSurface(): WritingSurface {
  // @ts-expect-error — Office host is set after Office.onReady
  const host = (Office?.context?.host as string | undefined)?.toLowerCase?.() ?? "";
  if (host.includes("word")) return "word-online";
  if (host.includes("excel")) return "excel-online";
  if (host.includes("powerpoint")) return "powerpoint-online";
  return "unknown";
}

// ============================================================================
// Bootstrap
// ============================================================================

const focusState = createFocusMonitor("unknown");
const cellBatcher = createCellMutationBatcher();
const recentSnippets: ResearchSnippet[] = [];
let portalUrl = "";
let readingStartedAt = 0;

Office.onReady(async () => {
  const surface = detectOfficeSurface();
  focusState.surface = surface;

  const hostLabel = document.getElementById("hostLabel");
  if (hostLabel) hostLabel.textContent = `Host: ${surface}`;

  const disclosureOk = await ensureUtahDisclosure();
  if (!disclosureOk) {
    const root = document.getElementById("app");
    if (root) {
      root.innerHTML =
        "<p>Utah S.B. 149 disclosure was declined or unavailable. AI tools are blocked.</p>";
    }
    return;
  }

  attachFocusMonitor(surface);
  attachResearchPortal(surface);
  attachCitationCheck(surface);
  await attachHostDocumentHandler(surface);
});

async function ensureUtahDisclosure(): Promise<boolean> {
  const entityToken = MSGF_OPTIONS.entityId;
  if (!entityToken) {
    console.warn("[edu] missing entity id — disclosure cannot be attested");
    return false;
  }
  try {
    const statusRes = (await getUtahDisclosureStatus(
      { entityToken },
      MSGF_OPTIONS
    )) as { status?: { accepted?: boolean; copy?: { title?: string; summary?: string } } };
    if (statusRes.status?.accepted) return true;

    const title = statusRes.status?.copy?.title ?? "Utah AI disclosure";
    const summary =
      statusRes.status?.copy?.summary ??
      "This assignment may use AI assistance. Do you understand and want to continue?";
    const accepted = window.confirm(`${title}\n\n${summary}\n\nOK = I understand — continue`);
    if (!accepted) return false;
    await acceptUtahDisclosure({ entityToken });
    return true;
  } catch (e) {
    console.warn("[edu] utah disclosure failed", e);
    return false;
  }
}

// ============================================================================
// Focus monitor (pillars §3.2)
// ============================================================================

function attachFocusMonitor(surface: WritingSurface) {
  document.addEventListener("visibilitychange", () => {
    recordFocusChange(focusState, !document.hidden, document.hidden ? "tab_hidden" : "tab_focus");
    void flushFocus(surface);
  });
  window.addEventListener("blur", () => {
    recordFocusChange(focusState, false, "window_blur");
    void flushFocus(surface);
  });
  window.addEventListener("focus", () => {
    recordFocusChange(focusState, true, "window_focus");
    void flushFocus(surface);
  });

  setInterval(() => {
    const now = Date.now();
    if (focusState.focused) focusState.activeMs += now - focusState.lastChangeAt;
    focusState.lastChangeAt = now;

    const activeTime = document.getElementById("activeTime");
    if (activeTime) {
      const seconds = Math.floor(focusState.activeMs / 1000);
      activeTime.textContent =
        seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    }
    const focusStat = document.getElementById("focusStat");
    if (focusStat) focusStat.textContent = focusState.focused ? "focused" : "paused";
  }, 1000);
}

async function flushFocus(surface: WritingSurface) {
  try {
    await flushFocusBeats(
      focusState,
      { ecosystemSource: ECOSYSTEM_SOURCE, subjectDomain: "general" },
      MSGF_OPTIONS
    );
  } catch (e) {
    console.warn("[edu] focus flush failed", e);
  }
  void surface;
}

// ============================================================================
// Document handler — KEYSTROKE (Word) + CELL_MUTATION (Excel) + FOCUS only (PowerPoint).
// ============================================================================

async function attachHostDocumentHandler(surface: WritingSurface) {
  if (surface === "excel-online") {
    // Excel — listen for cell edits via Office.js binding events.
    await new Promise<void>((resolve) => {
      try {
        Office.context.document.addHandlerAsync(
          Office.EventType.DocumentSelectionChanged,
          (_arg) => {
            // Heuristic surrogate: poll the active cell on each selection change.
            Office.context.document.getSelectedDataAsync(
              Office.CoercionType.Text,
              { valueFormat: Office.ValueFormat.Unformatted },
              (asyncResult) => {
                if (asyncResult.status !== Office.AsyncResultStatus.Succeeded) return;
                const value = String(asyncResult.value ?? "");
                const due = pushCellMutation(cellBatcher, {
                  ts: Date.now(),
                  cellRef: "ACTIVE_CELL",
                  deltaChars: value.length,
                  isPaste: value.length > 80,
                });
                if (due) {
                  void flushCellMutations(
                    cellBatcher,
                    {
                      ecosystemSource: ECOSYSTEM_SOURCE,
                      writingSurface: surface,
                      subjectDomain: "general",
                    },
                    MSGF_OPTIONS
                  );
                }
              }
            );
          },
          { asyncContext: null },
          () => resolve()
        );
      } catch (e) {
        console.warn("[edu] excel handler attach failed", e);
        resolve();
      }
    });
  } else if (surface === "word-online") {
    // Word — capture keystroke rhythm against the task pane's own focused field as a
    // proxy when the host does not expose key events. Real keystroke surfaces require
    // a separate text editing experience (e.g. dictation field) inside the pane.
    const proxy = document.getElementById("snippetText") as HTMLTextAreaElement | null;
    if (!proxy) return;
    let lastTs = performance.now();
    proxy.addEventListener("keydown", (ev) => {
      const now = performance.now();
      const flightMs = Math.max(0, now - lastTs);
      lastTs = now;
      void postTheCall(
        {
          schemaVersion: 2,
          ecosystemSource: ECOSYSTEM_SOURCE,
          telemetryMode: "KEYSTROKE",
          writingSurface: surface,
          theCall: [
            {
              key: ev.key,
              timestamp: Date.now(),
              flightMs,
              surface,
            },
          ],
        },
        MSGF_OPTIONS
      );
    });
  }
  // PowerPoint — focus_duration only; no keystroke surface.
}

// ============================================================================
// Research portal + citation check
// ============================================================================

function attachResearchPortal(_surface: WritingSurface) {
  document.getElementById("openSearch")?.addEventListener("click", () => {
    const input = document.getElementById("searchUrl") as HTMLInputElement | null;
    portalUrl = input?.value.trim() ?? "";
    if (!portalUrl) return;
    const frame = document.getElementById("researchFrame") as HTMLIFrameElement | null;
    if (frame) frame.src = portalUrl;
    readingStartedAt = Date.now();
  });
}

function attachCitationCheck(surface: WritingSurface) {
  document.getElementById("anchorBtn")?.addEventListener("click", () => {
    const snippet = (document.getElementById("snippetText") as HTMLTextAreaElement | null)?.value.trim();
    if (!snippet) return;
    recentSnippets.push({
      snippetId: cryptoRandomId(),
      sourceUrl: portalUrl || "about:blank",
      text: snippet,
      readingTimeMs: readingStartedAt ? Date.now() - readingStartedAt : 0,
      capturedAt: Date.now(),
      hasCitationAnchor: true,
    });
    setLastResult("Anchor minted — paste this snippet into your document.");
  });

  document.getElementById("checkBtn")?.addEventListener("click", async () => {
    const pasted = (document.getElementById("snippetText") as HTMLTextAreaElement | null)?.value.trim();
    if (!pasted) return;
    try {
      const body: CitationCheckBody = {
        pastedText: pasted,
        recentSnippets,
        ecosystemSource: ECOSYSTEM_SOURCE,
        writingSurface: surface,
      };
      const res = (await postCitationCheck(body, MSGF_OPTIONS)) as {
        classification?: string;
      };
      setLastResult(`Citation: ${res.classification ?? "unknown"}`);
    } catch (e) {
      setLastResult(`Check failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  });
}

function setLastResult(text: string) {
  const el = document.getElementById("lastResult");
  if (el) el.textContent = text;
}

function cryptoRandomId(): string {
  if (window.crypto && "randomUUID" in window.crypto) return (window.crypto as Crypto).randomUUID();
  return `s_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}
