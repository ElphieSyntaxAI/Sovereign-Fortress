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
