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
 * Distribution Build ID: MSGF-753c05a-20260519T051006Z-internal
 */
import fs from 'fs';
import path from 'path';
import { VertexAI } from '@google-cloud/vertexai';

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export const SERVICE_ACCOUNT_PATH = path.join(
  process.cwd(),
  'service-account.json'
);

export function assertServiceAccountPresent(): void {
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    throw new Error(
      `MSGF: service-account.json not found at ${SERVICE_ACCOUNT_PATH}. Run \`node msgf-init.cjs\` or add the file before starting.`
    );
  }
}

export function getGcpProjectId(): string {
  if (process.env.GCP_PROJECT_ID) return process.env.GCP_PROJECT_ID;
  const raw = fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8');
  const { project_id } = JSON.parse(raw) as { project_id?: string };
  if (!project_id) {
    throw new Error('MSGF: service-account.json must include project_id.');
  }
  return project_id;
}

let vertexAI: VertexAI | null = null;

function getVertexAI(): VertexAI {
  assertServiceAccountPresent();
  if (!vertexAI) {
    const location = process.env.GCP_LOCATION || 'us-central1';
    vertexAI = new VertexAI({
      project: getGcpProjectId(),
      location,
      googleAuthOptions: {
        keyFile: SERVICE_ACCOUNT_PATH,
      },
    });
  }
  return vertexAI;
}

export function getVertexGenerativeModelForId(modelId: string) {
  return getVertexAI().getGenerativeModel({ model: modelId });
}

export function getVertexGenerativeModel() {
  return getVertexGenerativeModelForId(process.env.MSGF_VERTEX_MODEL || DEFAULT_GEMINI_MODEL);
}
