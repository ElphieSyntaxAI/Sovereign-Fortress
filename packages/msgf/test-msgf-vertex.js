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
 * Distribution Build ID: MSGF-51d39b5-20260516T031044Z-internal
 */
const { testMSGFVertex } = require("./test-msgf-aiplatform");

const modelCandidates = ["gemini-2.5-flash"];

async function runModelChecks() {
  for (const model of modelCandidates) {
    try {
      console.log(`\nTesting model: ${model}`);
      await testMSGFVertex("Reply with: MSGF credentials are valid.", { model });
      console.log(`MSGF vertex test call succeeded with model: ${model}`);
      return;
    } catch (err) {
      console.error(`Model ${model} failed:`, err.message);
    }
  }

  console.error("All configured Vertex model checks failed.");
  process.exit(1);
}

runModelChecks();
