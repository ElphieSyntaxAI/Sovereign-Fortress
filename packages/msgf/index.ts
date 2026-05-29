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
 * Distribution Build ID: MSGF-3a4c1de-20260529T200349Z-internal
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
