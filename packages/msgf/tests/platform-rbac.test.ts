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
 * Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  filterNavLinksForPermissions,
  isAlwaysVisibleNavLink,
  resolveSessionPermissions,
} from "../lib/platform-rbac.js";

describe("platform-rbac", () => {
  it("elevates GLOBAL_ADMIN to full governance nav regardless of team dev role", () => {
    const permissions = resolveSessionPermissions({
      isIndependentSandbox: false,
      teamPlatformRole: "dev",
      msgfAccessRole: "GLOBAL_ADMIN",
    });
    assert.equal(permissions.canAccessGovernanceDashboard, true);
    assert.ok(permissions.roles.includes("admin"));
  });

  it("dev-only team role keeps workspace plus always-visible marketing links", () => {
    const permissions = resolveSessionPermissions({
      isIndependentSandbox: false,
      teamPlatformRole: "dev",
    });
    const links = filterNavLinksForPermissions(
      [
        { label: "Platform hub", href: "/" },
        { label: "Dashboard", href: "/dashboard" },
        { label: "Workspace", href: "/workspace" },
      ],
      permissions
    );
    assert.deepEqual(
      links.map((l) => l.label),
      ["Platform hub", "Dashboard", "Workspace"]
    );
  });

  it("isAlwaysVisibleNavLink includes platform hub", () => {
    assert.equal(isAlwaysVisibleNavLink("/"), true);
    assert.equal(isAlwaysVisibleNavLink("/other-products"), true);
    assert.equal(isAlwaysVisibleNavLink("/dashboard"), false);
  });
});
