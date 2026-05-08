/**
 * Forensic calibration: browser-safe pure helpers + Node persistence.
 * For Vite/browser-only bundles, import from `@elphie-syntax/core/lib/forensics/calibration/pure`.
 */

export type {
  CalibrationResult,
  KeystrokeFingerprint,
  TenantScope,
} from "./calibration-pure.js";
export { buildCalibrationResult } from "./calibration-pure.js";

export type { ProcessCalibrationOptions } from "./calibration-node.js";
export { processCalibration, schoolEncryptionKeyFromEnv } from "./calibration-node.js";
