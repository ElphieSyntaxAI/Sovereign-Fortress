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
 * Distribution Build ID: MSGF-853c3b6-20260519T054901Z-internal
 */
const fs = require("fs");
const path = require("path");
const { v1beta1 } = require("@google-cloud/aiplatform");
const { VertexAI } = require("@google-cloud/vertexai");

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "service-account.json");
const DEFAULT_LOCATION = process.env.GCP_LOCATION || "us-central1";

function getProjectIdFromServiceAccount() {
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    throw new Error(
      `Missing service account file at: ${SERVICE_ACCOUNT_PATH}`
    );
  }

  const raw = fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8");
  const parsed = JSON.parse(raw);

  if (!parsed.project_id) {
    throw new Error("service-account.json is missing project_id");
  }

  return parsed.project_id;
}

async function testMSGF(prompt = "Reply with: MSGF credentials are valid.") {
  const projectId = process.env.GCP_PROJECT_ID || getProjectIdFromServiceAccount();
  const location = DEFAULT_LOCATION;

  const client = new v1beta1.PredictionServiceClient({
    keyFilename: SERVICE_ACCOUNT_PATH,
    apiEndpoint: `${location}-aiplatform.googleapis.com`,
  });

  const model = `projects/${projectId}/locations/${location}/publishers/google/models/gemini-2.5-flash`;

  const request = {
    model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 128,
    },
  };

  const [response] = await client.generateContent(request);
  const text = response?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("No text returned from Gemini. Credentials may be valid, but response was empty.");
  }

  console.log("Gemini response:", text);
  return text;
}

async function testMSGFVertex(
  prompt = "Reply with: MSGF credentials are valid.",
  options = {}
) {
  const projectId = process.env.GCP_PROJECT_ID || getProjectIdFromServiceAccount();
  const location = DEFAULT_LOCATION;
  const modelId = options.model || "gemini-2.5-flash";

  // Force ADC to use the root service account file.
  process.env.GOOGLE_APPLICATION_CREDENTIALS = SERVICE_ACCOUNT_PATH;

  const vertexAI = new VertexAI({
    project: projectId,
    location,
    googleAuthOptions: {
      keyFile: SERVICE_ACCOUNT_PATH,
    },
  });
  const model = vertexAI.getGenerativeModel({ model: modelId });

  const response = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 128,
    },
  });

  const text =
    response?.response?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("No text returned from Gemini Vertex call.");
  }

  console.log("Gemini response (Vertex SDK):", text);
  return text;
}

module.exports = { testMSGF, testMSGFVertex };

if (require.main === module) {
  testMSGF()
    .then(() => {
      console.log("MSGF test call succeeded (aiplatform).");
    })
    .catch((err) => {
      console.error("Aiplatform call failed:", err.message);
      console.log("Trying Vertex SDK fallback...");
      testMSGFVertex()
        .then(() => {
          console.log("MSGF test call succeeded (vertexai fallback).");
        })
        .catch((fallbackErr) => {
          console.error("Vertex fallback failed:", fallbackErr.message);
          process.exit(1);
        });
    });
}
