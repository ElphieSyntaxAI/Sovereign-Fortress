/**
 * Canonical report-issue URL helpers.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  coerceReportIssueUrl,
  MSGF_REPORT_ISSUE_PATH,
  resolveMsgfReportIssueUrl,
} from "../lib/msgf-report-url.js";

describe("msgf-report-url", () => {
  test("resolveMsgfReportIssueUrl with base", () => {
    const url = resolveMsgfReportIssueUrl("https://elphiesgatedai.elphiesyntax.com");
    assert.equal(url, `https://elphiesgatedai.elphiesyntax.com${MSGF_REPORT_ISSUE_PATH}`);
  });

  test("coerce legacy incidents path", () => {
    const url = coerceReportIssueUrl(
      "https://example.com/api/msgf/incidents/report"
    );
    assert.equal(url, `https://example.com${MSGF_REPORT_ISSUE_PATH}`);
  });
});
