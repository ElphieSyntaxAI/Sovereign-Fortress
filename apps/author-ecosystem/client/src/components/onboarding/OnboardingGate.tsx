import { useCallback, useEffect, useState, type ReactNode } from "react";

import { getPreferredBffBearer } from "../../lib/authAccessToken";
import { bffAuthHeaders, bffCredentials, bffUrl } from "../../lib/bffFetch";
import { dispatchDocumentIngestCommitted } from "../../lib/documentIngestEvents";
import { formatBffFetchError } from "../../lib/bffFetch";
import { fetchOnboardingStatus } from "../../lib/onboardingApi";
import { useAuthorRole } from "../../context/AuthorRoleContext";
import { useNarrative } from "../../context/NarrativeContext";
import { HalStartupModal } from "./HalStartupModal";
import { WikiIngestReviewModal } from "./WikiIngestReviewModal";
import type { ClarifyingQuestion, IngestConflict, ProposedWiki } from "../../lib/onboardingApi";

/**
 * After Vault Pact: show HAL startup modal on dashboard, then resume normal app.
 * Re-opens document review modal if a session was left in `review` state.
 */
export function OnboardingGate(props: { children: ReactNode }) {
  const { selection } = useNarrative();
  const { user } = useAuthorRole();
  const tenantId = selection?.tenantId ?? user?.id ?? "";
  const [loading, setLoading] = useState(true);
  const [halOpen, setHalOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [targetSeconds, setTargetSeconds] = useState(300);
  const [minWords, setMinWords] = useState(120);
  const [docReview, setDocReview] = useState<{
    session_id: string;
    slot_label: string;
    status?: string;
    proposed_wiki: ProposedWiki[];
    outline_beats: Array<{ synopsis: string; order: number }>;
    ingest_conflicts: IngestConflict[];
    clarifying_questions: ClarifyingQuestion[];
  } | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [forceCommit, setForceCommit] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const status = await fetchOnboardingStatus(getPreferredBffBearer);
      setPrompt(status.hal_startup_prompt);
      setTargetSeconds(status.hal_startup_target_seconds);
      setMinWords(status.hal_startup_min_words);
      const isAuthor =
        user?.persona === "author" ||
        user?.role === "author" ||
        user?.activated_personas?.includes("author");
      setHalOpen(isAuthor && !status.hal_startup_completed);
      if (status.document_review) {
        setDocReview({
          session_id: status.document_review.session_id,
          slot_label: status.document_review.slot_label,
          proposed_wiki: status.document_review.proposed_wiki ?? [],
          outline_beats: status.document_review.outline_beats ?? [],
          ingest_conflicts: status.document_review.ingest_conflicts ?? [],
          clarifying_questions: status.document_review.clarifying_questions ?? [],
        });
      } else {
        setDocReview(null);
      }
    } catch {
      setHalOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const commitReview = async (
    action: "submit" | "cancel",
    proposed: ProposedWiki[],
    opts?: { force_commit?: boolean }
  ) => {
    if (!docReview) return;
    setReviewBusy(true);
    setReviewError(null);
    try {
      const token = await getPreferredBffBearer();
      const res = await fetch(bffUrl("/api/onboarding/document/commit"), {
        method: "POST",
        ...bffCredentials,
        headers: { ...bffAuthHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: docReview.session_id,
          action,
          proposed_wiki: proposed,
          outline_beats: docReview.outline_beats,
          sync_msgf_brain: true,
          ...(opts?.force_commit ? { force_commit: true } : {}),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        hint?: string;
        planning?: { plot_beats?: Array<{ synopsis: string; order: number; title?: string }> };
      };
      if (res.status === 409 && action === "submit") {
        setForceCommit(true);
        throw new Error(
          `${json.message ?? json.error ?? res.statusText}${json.hint ? ` ${json.hint}` : ""}`
        );
      }
      if (!res.ok) throw new Error(json.message ?? json.error ?? res.statusText);
      if (action === "submit" && selection?.manuscriptId) {
        const beats = json.planning?.plot_beats ?? docReview.outline_beats;
        dispatchDocumentIngestCommitted({
          manuscriptId: selection.manuscriptId,
          wikiCount: proposed.length,
          beatCount: beats.length,
        });
      }
      setForceCommit(false);
      setDocReview(null);
      void reload();
    } catch (e) {
      const msg =
        e instanceof TypeError
          ? formatBffFetchError(e, "/api/onboarding/document/commit")
          : e instanceof Error
            ? e.message
            : String(e);
      setReviewError(msg);
      console.error("[onboarding/review-commit]", e);
    } finally {
      setReviewBusy(false);
    }
  };

  if (loading) return props.children;

  return (
    <>
      {props.children}
      <HalStartupModal
        open={halOpen}
        prompt={prompt}
        targetSeconds={targetSeconds}
        minWords={minWords}
        manuscriptId={selection?.manuscriptId ?? null}
        tenantId={tenantId}
        getAccessToken={getPreferredBffBearer}
        onComplete={() => {
          setHalOpen(false);
          void reload();
        }}
      />
      {docReview ? (
        <WikiIngestReviewModal
          open
          slotLabel={docReview.slot_label}
          proposed={docReview.proposed_wiki}
          outlineBeats={docReview.outline_beats}
          onEdit={(next) => setDocReview({ ...docReview, proposed_wiki: next })}
          onRemoveWiki={(idx) =>
            setDocReview({
              ...docReview,
              proposed_wiki: docReview.proposed_wiki.filter((_, i) => i !== idx),
            })
          }
          onRemoveBeat={(idx) =>
            setDocReview({
              ...docReview,
              outline_beats: docReview.outline_beats.filter((_, i) => i !== idx),
            })
          }
          onSubmit={() => void commitReview("submit", docReview.proposed_wiki)}
          onSubmitAnyway={() =>
            void commitReview("submit", docReview.proposed_wiki, { force_commit: true })
          }
          onCancel={() => void commitReview("cancel", docReview.proposed_wiki)}
          busy={reviewBusy}
          error={reviewError}
          showSubmitAnyway={forceCommit}
        />
      ) : null}
    </>
  );
}
