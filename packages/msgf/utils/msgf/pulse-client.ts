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
 * Distribution Build ID: MSGF-463028d-20260519T150411Z-internal
 */
import type { KeystrokeEvent } from "@/packages/core/src/P4";

type PulseClientOptions = {
  /** Idle threshold in ms before auto-flush (default: 3000). */
  idleMs?: number;
  /** Max character volume before auto-flush (default: 500). */
  maxChars?: number;
  /** Optional hook for debugging / telemetry. */
  onFlushStart?: (payload: { keystrokes: KeystrokeEvent[] }) => void;
  onFlushSuccess?: (response: unknown) => void;
  onFlushError?: (error: unknown) => void;
};

/**
 * MSGF Pulse client: buffers keystrokes and POSTs to /api/msgf/pulse
 * only when:
 *  - user is idle for 3s
 *  - buffer reaches ~500 characters
 *  - user hits Enter after a long paragraph
 */
export class MsgfPulseClient {
  private buffer: KeystrokeEvent[] = [];
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly idleMs: number;
  private readonly maxChars: number;
  private readonly opts: PulseClientOptions;

  constructor(options: PulseClientOptions = {}) {
    this.idleMs = options.idleMs ?? 3000;
    this.maxChars = options.maxChars ?? 500;
    this.opts = options;
  }

  /**
   * Attach to a text input / textarea / contenteditable to auto-record keys.
   * You can also call `recordKey()` manually from your own handlers instead.
   */
  attach(el: HTMLElement) {
    const handler = (ev: KeyboardEvent) => {
      const key = ev.key;
      const targetId =
        (ev.target as HTMLElement | null)?.id ||
        (ev.target as HTMLElement | null)?.getAttribute("data-msgf-target") ||
        undefined;

      this.recordKey(key, {
        type: "keydown",
        target: targetId,
      });
    };

    el.addEventListener("keydown", handler);
    return () => {
      el.removeEventListener("keydown", handler);
    };
  }

  /**
   * Record a single logical key into the buffer.
   * Call this from your editor or input handlers.
   */
  recordKey(
    key: string,
    options: { type?: KeystrokeEvent["type"]; target?: string } = {}
  ) {
    const now = Date.now();

    const event: KeystrokeEvent = {
      ts: now,
      key,
      type: options.type ?? "keydown",
      target: options.target,
    };

    this.buffer.push(event);
    this.scheduleIdleFlush();

    const volume = this.estimateVolume();
    const isEnter = key === "Enter";
    const longParagraph =
      isEnter &&
      this.countCharsSinceLastBreak() >= this.maxChars * 0.6; // 60% of volume feels like a "paragraph"

    // Volume trigger
    if (volume >= this.maxChars) {
      void this.flush();
      return;
    }

    // Logic break trigger: user hits Enter after a long paragraph
    if (longParagraph) {
      void this.flush();
      return;
    }
  }

  /**
   * Estimate total character-like volume in current buffer.
   */
  private estimateVolume(): number {
    return this.buffer.reduce((sum, e) => {
      return sum + (e.key.length === 1 ? 1 : Math.min(e.key.length, 24));
    }, 0);
  }

  /**
   * Count characters since last clear break (Enter).
   */
  private countCharsSinceLastBreak(): number {
    let count = 0;
    for (let i = this.buffer.length - 1; i >= 0; i--) {
      const e = this.buffer[i];
      if (e.key === "Enter") break;
      count += e.key.length === 1 ? 1 : Math.min(e.key.length, 24);
    }
    return count;
  }

  private scheduleIdleFlush() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    this.idleTimer = setTimeout(() => {
      void this.flush();
    }, this.idleMs);
  }

  /**
   * Flush current buffer to the MSGF Pulse API route.
   */
  async flush() {
    if (!this.buffer.length) return;
    const payload = { keystrokes: this.buffer.slice() };

    this.buffer = [];
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    this.opts.onFlushStart?.(payload);

    try {
      const res = await fetch("/api/msgf/pulse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const err = new Error(
          data?.error || `Pulse request failed with status ${res.status}`
        );
        this.opts.onFlushError?.(err);
        return;
      }

      this.opts.onFlushSuccess?.(data);
    } catch (error) {
      this.opts.onFlushError?.(error);
    }
  }
}

