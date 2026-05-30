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
 * Distribution Build ID: MSGF-48a02b8-20260530T050749Z-internal
 */
import fs from 'fs';
import path from 'path';
import { VertexAI } from '@google-cloud/vertexai';

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export const SERVICE_ACCOUNT_PATH = path.join(
  process.cwd(),
  'service-account.json'
);

function trimEnv(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v === '' ? undefined : v;
}

/** Cloud Run / GCE / Cloud Functions expose ADC via the metadata server (no key file). */
function usesCloudRuntimeAdc(): boolean {
  return Boolean(
    trimEnv('K_SERVICE') ||
      trimEnv('GOOGLE_CLOUD_PROJECT') ||
      trimEnv('GAE_SERVICE') ||
      trimEnv('FUNCTION_TARGET')
  );
}

function serviceAccountKeyFileExists(): boolean {
  return fs.existsSync(SERVICE_ACCOUNT_PATH);
}

function googleApplicationCredentialsPath(): string | undefined {
  const creds = trimEnv('GOOGLE_APPLICATION_CREDENTIALS');
  if (!creds) return undefined;
  return fs.existsSync(creds) ? creds : undefined;
}

export function hasVertexCredentials(): boolean {
  if (serviceAccountKeyFileExists()) return true;
  if (googleApplicationCredentialsPath()) return true;
  if (trimEnv('GCP_PROJECT_ID') && usesCloudRuntimeAdc()) return true;
  return false;
}

export function assertServiceAccountPresent(): void {
  if (hasVertexCredentials()) return;
  throw new Error(
    `MSGF: Vertex credentials not configured. Local dev: add service-account.json at ${SERVICE_ACCOUNT_PATH} (run \`node msgf-init.cjs\`). Cloud Run: set GCP_PROJECT_ID and attach a service account with Vertex AI access (ADC via metadata server).`
  );
}

export function getGcpProjectId(): string {
  const fromEnv = trimEnv('GCP_PROJECT_ID');
  if (fromEnv) return fromEnv;

  const credsProject = trimEnv('GOOGLE_CLOUD_PROJECT');
  if (credsProject) return credsProject;

  if (serviceAccountKeyFileExists()) {
    const raw = fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8');
    const { project_id } = JSON.parse(raw) as { project_id?: string };
    if (!project_id) {
      throw new Error('MSGF: service-account.json must include project_id.');
    }
    return project_id;
  }

  throw new Error(
    'MSGF: GCP project id not configured. Set GCP_PROJECT_ID or provide service-account.json.'
  );
}

let vertexAI: VertexAI | null = null;

/** Invalid GAC env breaks ADC on Cloud Run even when we omit keyFile. */
function clearBrokenGoogleApplicationCredentialsEnv(): void {
  const creds = trimEnv('GOOGLE_APPLICATION_CREDENTIALS');
  if (!creds) return;
  if (!fs.existsSync(creds)) {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }
}

function getVertexAI(): VertexAI {
  assertServiceAccountPresent();
  if (!vertexAI) {
    clearBrokenGoogleApplicationCredentialsEnv();
    const location =
      trimEnv('GCP_LOCATION') || trimEnv('GCP_REGION') || 'us-central1';
    const keyFile =
      googleApplicationCredentialsPath() ??
      (serviceAccountKeyFileExists() ? SERVICE_ACCOUNT_PATH : undefined);
    vertexAI = new VertexAI({
      project: getGcpProjectId(),
      location,
      ...(keyFile
        ? { googleAuthOptions: { keyFile } }
        : {}),
    });
  }
  return vertexAI;
}

export function getVertexGenerativeModelForId(modelId: string) {
  return getVertexAI().getGenerativeModel({ model: modelId });
}

export function resolveVertexGeminiModelId(): string {
  return (
    process.env.GCP_MODEL_ID?.trim() ||
    process.env.MSGF_VERTEX_MODEL?.trim() ||
    DEFAULT_GEMINI_MODEL
  );
}

export function getVertexGenerativeModel() {
  return getVertexGenerativeModelForId(resolveVertexGeminiModelId());
}
