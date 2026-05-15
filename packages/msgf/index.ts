/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Distribution Build ID: MSGF-7175065-20260515T200509Z-internal
 */
/**
 * **Production runtime** (Node / GCP Cloud Run), separate from the browser-safe SDK in `lib/index.ts`.
 *
 * - **PORT**: Use {@link resolveListenPort} for custom servers; `next start` and Next **standalone**
 *   already bind to `process.env.PORT` (set by Cloud Run).
 * - **Graceful shutdown**: {@link installShutdownHandlers} runs from `instrumentation.ts` on boot.
 *   Register flush work with {@link registerShutdownTask} (cap: {@link MSGF_SHUTDOWN_TASK_CAP}).
 *
 * Public SDK imports remain: `import { MsgfClient } from "msgf"` → `./lib/index.ts` (dist).
 */

export {
  MSGF_SHUTDOWN_TASK_CAP,
  installShutdownHandlers,
  isShuttingDown,
  registerHttpServerForShutdown,
  registerShutdownTask,
  runShutdownSequence,
} from "./lib/runtime/shutdown-coordinator";

export { resolveListenPort } from "./lib/runtime/listen-port";
