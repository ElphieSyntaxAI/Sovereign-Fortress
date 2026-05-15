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
 * Distribution Build ID: MSGF-7175065-20260515T200509Z-internal
 */
const fs = require("fs");
const path = require("path");

const SERVICE_ACCOUNT_FILENAME = "service-account.json";
/** Default Vertex Gemini model (verified for project msgf-shield). */
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

function getServiceAccountPath() {
  return path.join(__dirname, SERVICE_ACCOUNT_FILENAME);
}

function assertServiceAccountPresent() {
  const p = getServiceAccountPath();
  if (!fs.existsSync(p)) {
    throw new Error(
      `MSGF: missing ${SERVICE_ACCOUNT_FILENAME} at ${p}. Place your Google Cloud service account JSON in the project root before starting the app.`
    );
  }
  const stat = fs.statSync(p);
  if (stat.size === 0) {
    throw new Error(`MSGF: ${SERVICE_ACCOUNT_FILENAME} is empty.`);
  }
  const parsed = JSON.parse(fs.readFileSync(p, "utf8"));
  if (!parsed.project_id) {
    throw new Error(`MSGF: ${SERVICE_ACCOUNT_FILENAME} must include project_id.`);
  }
}

module.exports = {
  DEFAULT_GEMINI_MODEL,
  getServiceAccountPath,
  assertServiceAccountPresent,
};

if (require.main === module) {
  try {
    assertServiceAccountPresent();
    console.log(
      `MSGF init OK: ${SERVICE_ACCOUNT_FILENAME} found (default model: ${DEFAULT_GEMINI_MODEL}).`
    );
    process.exit(0);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
