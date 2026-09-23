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
import { describe, test } from "node:test";

import { isUsageMonitorWriteEnabled } from "../lib/usage-monitor.js";

describe("usage-monitor", () => {
  test("write enabled by default", () => {
    const prev = process.env.MSGF_USAGE_MONITOR_WRITE;
    delete process.env.MSGF_USAGE_MONITOR_WRITE;
    assert.equal(isUsageMonitorWriteEnabled(), true);
    process.env.MSGF_USAGE_MONITOR_WRITE = "0";
    assert.equal(isUsageMonitorWriteEnabled(), false);
    if (prev === undefined) delete process.env.MSGF_USAGE_MONITOR_WRITE;
    else process.env.MSGF_USAGE_MONITOR_WRITE = prev;
  });
});
