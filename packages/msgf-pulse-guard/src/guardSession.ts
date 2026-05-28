import * as vscode from "vscode";

import {
  readMsgfSettings,
  resolveEntityId,
  resolveTenantId,
  settingsReady,
  type MsgfGuardSettings,
} from "./config";
import type { IdeStatusBarSnapshot } from "./ide-types";
import { MSGF_RBAC_FORBIDDEN_WARNING } from "./constants";
import { HalFrictionTracker } from "./halFrictionNotice";
import { parseTextDocumentEvent } from "./keystrokeCapture";
import { LocalStateCacheWriter } from "./localStateCache";
import { TelemetryBuffer } from "./telemetryBuffer";
import { initializeMsgfWorkspace } from "./workspace/msgfWorkspace";

const LOG_PREFIX = "[MSGF Guard]";

export type GuardSessionCallbacks = {
  onSnapshot: (snapshot: IdeStatusBarSnapshot, settings: MsgfGuardSettings) => void;
};

export class GuardSession {
  private settings: MsgfGuardSettings = readMsgfSettings();
  private tenantId = "";
  private entityId = "";
  private buffer: TelemetryBuffer | null = null;
  private localCache: LocalStateCacheWriter | null = null;
  private readonly halFriction = new HalFrictionTracker();
  private readonly disposables: vscode.Disposable[] = [];
  private lastSnapshot: IdeStatusBarSnapshot = {
    logicDriftScore: null,
    logicDriftLabel: "—",
    escalationThreshold: null,
    routing: "idle",
    defendTier: null,
    baselineRequired: false,
    humanTiebreakerRequired: false,
    bufferedEventCount: 0,
    updatedAt: null,
  };

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly callbacks: GuardSessionCallbacks
  ) {}

  async start(): Promise<void> {
    await initializeMsgfWorkspace();
    await this.reloadFromSettings();
    this.wireDocumentListener();
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables.length = 0;
    this.buffer?.dispose();
    this.buffer = null;
  }

  async reloadFromSettings(): Promise<void> {
    this.buffer?.dispose();
    this.buffer = null;
    this.localCache?.dispose();
    this.localCache = null;

    this.settings = readMsgfSettings();
    this.tenantId = resolveTenantId(this.settings);
    this.entityId = await resolveEntityId(this.context, this.settings);

    const ready = settingsReady(this.settings);
    if (!ready.ok) {
      console.warn(`${LOG_PREFIX} Not armed — missing: ${ready.missing.join(", ")}`);
      this.emitIdle(`Configure ${ready.missing.join(", ")}`);
      return;
    }

    if (!this.settings.tenantKey.trim()) {
      void vscode.window.showInformationMessage(
        `${LOG_PREFIX} msgf.tenantKey unset — using workspace folder name "${this.tenantId}".`
      );
    }

    this.buffer = new TelemetryBuffer({
      settings: this.settings,
      tenantId: this.tenantId,
      entityId: this.entityId,
      localCache: this.localCache,
      onRbacForbidden: () => {
        void vscode.window.showWarningMessage(MSGF_RBAC_FORBIDDEN_WARNING);
      },
      onFlushComplete: (result, pending) => {
        this.lastSnapshot = {
          ...result.snapshot,
          bufferedEventCount: pending,
          routing: this.buffer?.isPaused
            ? "error"
            : pending > 0
              ? "buffering"
              : result.snapshot.routing,
        };
        this.pushSnapshot(this.lastSnapshot);
      },
    });
    this.localCache = new LocalStateCacheWriter(
      this.tenantId,
      this.entityId,
      this.settings
    );

    this.buffer.start();
    console.info(
      `${LOG_PREFIX} Telemetry buffer armed · tenant=${this.tenantId} · api=${this.settings.apiUrl} · smallBrain=${this.settings.smallBrainProvider}`
    );
    this.pushSnapshot({ ...this.lastSnapshot, routing: "idle", bufferedEventCount: 0 });
  }

  private wireDocumentListener(): void {
    const sub = vscode.workspace.onDidChangeTextDocument((event) => {
      if (!this.buffer || this.buffer.isPaused) return;
      if (event.document.uri.scheme === "output") return;

      const telemetry = parseTextDocumentEvent(event);
      if (!telemetry.length) return;

      this.buffer.push(telemetry);
      this.halFriction.recordEditEvents(telemetry.length);
      this.localCache?.recordDocumentChanges(telemetry);
      this.pushSnapshot({
        ...this.lastSnapshot,
        routing: "buffering",
        bufferedEventCount: this.buffer.pendingCount,
        updatedAt: Date.now(),
      });
    });
    this.disposables.push(sub);
  }

  private pushSnapshot(snapshot: IdeStatusBarSnapshot): void {
    this.callbacks.onSnapshot(snapshot, {
      ...this.settings,
      tenantKey: this.tenantId,
      entityId: this.entityId,
    });
  }

  private emitIdle(error?: string): void {
    this.pushSnapshot({
      logicDriftScore: null,
      logicDriftLabel: "—",
      escalationThreshold: null,
      routing: error ? "error" : "idle",
      defendTier: null,
      baselineRequired: false,
      humanTiebreakerRequired: false,
      bufferedEventCount: 0,
      updatedAt: Date.now(),
      error,
    });
  }

  async flushNow(): Promise<void> {
    if (!this.buffer) {
      void vscode.window.showWarningMessage(`${LOG_PREFIX} Buffer not armed — check settings.`);
      return;
    }
    const result = await this.buffer.flushNow();
    if (!result.ok && result.snapshot.error) {
      void vscode.window.showErrorMessage(`${LOG_PREFIX} ${result.snapshot.error}`);
    }
  }
}
