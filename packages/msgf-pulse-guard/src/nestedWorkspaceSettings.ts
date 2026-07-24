import * as fs from "fs";
import * as path from "path";

import { sanitizeMsgfSettingValue } from "./config";
import type { MsgfGuardSettings } from "./settingsTypes";
import { MONOREPO_PRODUCT_PRESETS } from "./monorepoProducts";

function parseSettingsJsonFile(filePath: string): Record<string, unknown> | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function msgfKeysFromRecord(raw: Record<string, unknown>): Partial<MsgfGuardSettings> {
  const out: Partial<MsgfGuardSettings> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!key.startsWith("msgf.")) continue;
    const short = key.replace(/^msgf\./, "") as keyof MsgfGuardSettings;
    if (short === "enabled" && typeof value === "boolean") {
      out.enabled = value;
    } else if (short === "devSession" && typeof value === "boolean") {
      out.devSession = value;
    } else if (short === "asyncPreflight" && typeof value === "boolean") {
      out.asyncPreflight = value;
    } else if (short === "skipMsgf" && typeof value === "boolean") {
      out.skipMsgf = value;
    } else if (typeof value === "string") {
      (out as Record<string, string | boolean>)[short] = sanitizeMsgfSettingValue(value);
    }
  }
  return out;
}

/** Repo-root `.vscode/settings.json` msgf.* keys (if present). */
export function readRepoRootMsgfSettings(repoRoot: string): Partial<MsgfGuardSettings> {
  const file = path.join(repoRoot, ".vscode", "settings.json");
  const raw = parseSettingsJsonFile(file);
  return raw ? msgfKeysFromRecord(raw) : {};
}

/** Product folder `.vscode/settings.json` (e.g. apps/author-ecosystem). */
export function readProductFolderMsgfSettings(
  repoRoot: string,
  productPath: string
): Partial<MsgfGuardSettings> {
  const normalized = productPath.trim().replace(/\\/g, "/").replace(/\/$/, "");
  if (!normalized) return {};
  const file = path.join(repoRoot, normalized, ".vscode", "settings.json");
  const raw = parseSettingsJsonFile(file);
  return raw ? msgfKeysFromRecord(raw) : {};
}

/**
 * When the editor workspace is the git root, merge msgf.* from the active product folder
 * so tokens in `apps/<app>/.vscode` still apply.
 */
export function mergeMonorepoMsgfSettings(
  base: MsgfGuardSettings,
  repoRoot: string | null
): MsgfGuardSettings {
  if (!repoRoot) return base;
  // Never pull sibling-app tokens into a workspace that has not opted in.
  if (!base.enabled) return base;

  const rootLayer = readRepoRootMsgfSettings(repoRoot);
  let merged: MsgfGuardSettings = { ...base, ...rootLayer };

  const productPath =
    merged.productPath.trim() ||
    rootLayer.productPath?.trim() ||
    "";

  if (productPath) {
    const productLayer = readProductFolderMsgfSettings(repoRoot, productPath);
    merged = { ...merged, ...productLayer, productPath };
  } else if (!merged.authToken.trim() || !merged.tenantKey.trim()) {
    for (const preset of MONOREPO_PRODUCT_PRESETS) {
      const layer = readProductFolderMsgfSettings(repoRoot, preset.productPath);
      if (layer.authToken?.trim() || layer.tenantKey?.trim()) {
        merged = {
          ...merged,
          ...layer,
          productPath: merged.productPath || preset.productPath,
          tenantKey: merged.tenantKey || layer.tenantKey || preset.projectOrigin,
        };
        break;
      }
    }
  }

  if (!merged.productPath.trim() && merged.tenantKey.includes("/")) {
    const preset = MONOREPO_PRODUCT_PRESETS.find((p) => p.projectOrigin === merged.tenantKey.trim());
    if (preset) merged.productPath = preset.productPath;
  }

  if (!merged.authToken.trim()) {
    const pathHint = merged.productPath.trim();
    if (pathHint) {
      const layer = readProductFolderMsgfSettings(repoRoot, pathHint);
      if (layer.authToken?.trim()) merged.authToken = layer.authToken.trim();
    }
    if (!merged.authToken.trim()) {
      for (const preset of MONOREPO_PRODUCT_PRESETS) {
        const layer = readProductFolderMsgfSettings(repoRoot, preset.productPath);
        if (layer.authToken?.trim()) {
          merged.authToken = layer.authToken.trim();
          if (!merged.productPath.trim()) merged.productPath = preset.productPath;
          if (!merged.tenantKey.trim()) merged.tenantKey = layer.tenantKey || preset.projectOrigin;
          break;
        }
      }
    }
  }

  return merged;
}
