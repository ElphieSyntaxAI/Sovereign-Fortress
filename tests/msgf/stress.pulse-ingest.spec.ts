import { expect, test } from "@playwright/test";

import {
  assertStressAuth,
  authHeaders,
  beginStressLog,
  collectedResults,
  fireIngest,
  firePulse,
  invalidIngestBody,
  paidLicense,
  printExecutionReport,
  runConcurrentWave,
} from "./helpers/msgf-stress";

test.describe("MSGF Pulse + Ingest stress", () => {
  test.beforeAll(() => {
    beginStressLog();
    assertStressAuth();
  });

  test.afterAll(() => {
    printExecutionReport();
  });

  test("standard/soft-RC concurrent Pulse and Ingest", async ({ request }) => {
    const wave = await runConcurrentWave(request, "standard");
    const unexpected = wave.filter((r) => !r.expected);
    expect(
      unexpected,
      unexpected
        .map((r) => `${r.endpoint} HTTP ${r.status} ${r.errorCode ?? ""}`)
        .join("; ") || "unexpected failures"
    ).toHaveLength(0);
  });

  test("paid/entitled concurrent Pulse and Ingest", async ({ request }) => {
    test.skip(
      !paidLicense(),
      "Set MSGF_PAID_LICENSE_KEY for the entitled Pro/Startup profile"
    );
    const wave = await runConcurrentWave(request, "paid");
    const denied = wave.filter((r) => r.status === 402);
    expect(denied, "entitled profile must not receive 402").toHaveLength(0);
    const unexpected = wave.filter((r) => !r.expected);
    expect(unexpected).toHaveLength(0);
  });

  test("unentitled Pulse is denied with 401/402/403/429", async ({ request }) => {
    const result = await firePulse(request, "unentitled", authHeaders("none"));
    expect([401, 402, 403, 429]).toContain(result.status);
  });

  test("intentional ingest validation failure is Hall-logged", async ({ request }) => {
    const result = await fireIngest(
      request,
      "invalid",
      authHeaders("standard"),
      invalidIngestBody()
    );
    expect([400, 422]).toContain(result.status);
    expect(collectedResults().some((r) => r.profile === "invalid")).toBeTruthy();
  });
});
