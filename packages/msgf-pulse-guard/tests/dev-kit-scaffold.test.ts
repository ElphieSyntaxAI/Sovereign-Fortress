import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  REQUIRED_DEV_KIT_PATHS,
  syncDevKitFromBundle,
  validateDevKit,
} from "../src/workspace/devKitSync.ts";

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bundleRoot = path.join(pkgRoot, "resources", "dev-kit");

describe("dev-kit-scaffold", () => {
  it("bundle contains required template paths", () => {
    for (const rel of REQUIRED_DEV_KIT_PATHS) {
      assert.ok(fs.existsSync(path.join(bundleRoot, rel)), `missing bundle file: ${rel}`);
    }
  });

  it("syncDevKitFromBundle copies into a fresh workspace .msgf/", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "msgf-dev-kit-"));
    const target = path.join(tmp, ".msgf");

    const result = syncDevKitFromBundle(bundleRoot, target);
    assert.ok(result.copied > 0);

    const missing = validateDevKit(target);
    assert.deepEqual(missing, []);

    const version = JSON.parse(
      fs.readFileSync(path.join(target, "KIT_VERSION.json"), "utf8")
    ) as { version: string };
    assert.equal(version.version, "1.0.0");
  });

  it("skips existing README on second sync unless force", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "msgf-dev-kit-2-"));
    const target = path.join(tmp, ".msgf");

    syncDevKitFromBundle(bundleRoot, target);
    const readme = path.join(target, "README.md");
    fs.writeFileSync(readme, "# custom\n", "utf8");

    const second = syncDevKitFromBundle(bundleRoot, target);
    assert.ok(second.skipped >= 1);
    assert.equal(fs.readFileSync(readme, "utf8"), "# custom\n");

    syncDevKitFromBundle(bundleRoot, target, { force: true });
    assert.ok(fs.readFileSync(readme, "utf8").includes("MSGF workspace kit"));
  });
});
