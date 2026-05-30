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
 * Distribution Build ID: MSGF-48a02b8-20260530T050749Z-internal
 */
/**
 * Graceful shutdown for GCP (SIGTERM) and local Ctrl+C (SIGINT).
 * Register up to {@link MSGF_SHUTDOWN_TASK_CAP} async hooks so in-flight pipeline
 * state can flush to Supabase before exit.
 */
import type { Server } from "node:http";

export const MSGF_SHUTDOWN_TASK_CAP = 18;

type ShutdownTask = {
  name: string;
  run: () => Promise<void>;
};

const tasks: ShutdownTask[] = [];
let httpServer: Server | null = null;
let handlersInstalled = false;
let shuttingDown = false;
let shutdownPromise: Promise<void> | null = null;

export function isShuttingDown(): boolean {
  return shuttingDown;
}

/** Optional: register the Node HTTP server so shutdown stops accepting new connections first. */
export function registerHttpServerForShutdown(server: Server): void {
  httpServer = server;
}

/**
 * Register a DB flush / teardown task (max {@link MSGF_SHUTDOWN_TASK_CAP}).
 * Call from engines during module init or lazy startup.
 */
export function registerShutdownTask(name: string, run: () => Promise<void>): void {
  if (shuttingDown) {
    throw new Error(`MSGF shutdown already in progress; cannot register "${name}"`);
  }
  if (tasks.length >= MSGF_SHUTDOWN_TASK_CAP) {
    throw new Error(
      `MSGF shutdown registry full (${MSGF_SHUTDOWN_TASK_CAP} tasks max): cannot register "${name}"`
    );
  }
  tasks.push({ name, run });
}

function shutdownBudgetMs(): number {
  const raw = process.env.MSGF_SHUTDOWN_BUDGET_MS?.trim();
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (Number.isFinite(n) && n > 0) return n;
  /** Cloud Run sends SIGTERM ~10s before SIGKILL; stay under default platform budget. */
  return 9000;
}

async function runRegisteredTasks(budgetMs: number): Promise<void> {
  if (tasks.length === 0) return;
  const deadline = Date.now() + budgetMs;
  await Promise.all(
    tasks.map(async (t) => {
      const left = deadline - Date.now();
      if (left <= 0) {
        throw new Error(`MSGF shutdown: no time left for task "${t.name}"`);
      }
      await Promise.race([
        t.run(),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error(`MSGF shutdown: task "${t.name}" timed out`)), left)
        ),
      ]);
    })
  );
}

export async function runShutdownSequence(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) {
    await (shutdownPromise ?? Promise.resolve());
    return;
  }
  shuttingDown = true;

  shutdownPromise = (async () => {
    try {
      if (httpServer) {
        await new Promise<void>((resolve, reject) => {
          httpServer!.close((err) => (err ? reject(err) : resolve()));
        });
      }
      await runRegisteredTasks(shutdownBudgetMs());
    } catch (e) {
      console.error("[msgf-shutdown]", signal, e);
      process.exitCode = 1;
    }
  })();

  await shutdownPromise;
  process.exit(process.exitCode ?? 0);
}

export function installShutdownHandlers(): void {
  if (handlersInstalled) {
    return;
  }
  handlersInstalled = true;

  const onSignal = (signal: NodeJS.Signals) => {
    void runShutdownSequence(signal).catch((e) => {
      console.error("[msgf-shutdown] fatal", e);
      process.exit(1);
    });
  };

  process.on("SIGTERM", () => onSignal("SIGTERM"));
  process.on("SIGINT", () => onSignal("SIGINT"));
}
