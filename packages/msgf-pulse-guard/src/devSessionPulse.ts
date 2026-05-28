import {
  MSGF_ACTIVE_FILE_HEADER,
  MSGF_BUILD_ACTIVE_HEADER,
  MSGF_DEV_SESSION_HEADER,
  MSGF_FLUSH_REASON_HEADER,
} from "./constants";

/** Matches server {@link IdeFlushReason} in dev-session-profile. */
export type IdeFlushReason = "save" | "debounce" | "build_end" | "manual";

export type PulseFlushContext = {
  devSession: boolean;
  flushReason?: IdeFlushReason;
  activeFilePath?: string | null;
  buildActive?: boolean;
};

export function isSavePrimaryPulseMode(settings: { devSession: boolean }): boolean {
  return settings.devSession === true;
}

/** Adds x-msgf-dev-session* headers when dev session is active (testable without vscode). */
export function appendDevSessionPulseHeaders(
  headers: Record<string, string>,
  settings: { devSession: boolean },
  ctx?: PulseFlushContext
): void {
  const devSession = ctx?.devSession === true || settings.devSession;
  if (!devSession) return;

  headers[MSGF_DEV_SESSION_HEADER] = "1";
  headers[MSGF_FLUSH_REASON_HEADER] = ctx?.flushReason ?? "debounce";
  if (ctx?.buildActive) {
    headers[MSGF_BUILD_ACTIVE_HEADER] = "1";
  }
  const active = ctx?.activeFilePath?.trim().replace(/\\/g, "/");
  if (active) {
    headers[MSGF_ACTIVE_FILE_HEADER] = encodeURIComponent(active.slice(0, 512));
  }
}
