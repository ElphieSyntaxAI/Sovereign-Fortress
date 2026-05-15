#!/usr/bin/env bash
# deploy.sh — Build MSGF in Cloud Build, deploy to Cloud Run with Secret Manager (no keys in env).
#
# Usage:
#   ./deploy.sh
#   PROJECT_ID=my-prod ./deploy.sh
#   REGION=europe-west1 AR_REPOSITORY=msgf-docker SERVICE_NAME=msgf-core ./deploy.sh
#
# Prerequisites: gcloud CLI, Docker-style Artifact Registry repo, secrets in Secret Manager,
# IAM for your user: Cloud Build Editor/submit, Run Admin, Artifact Registry writer (or equivalent).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${ROOT}"

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
  echo "deploy.sh: set PROJECT_ID or run: gcloud config set project YOUR_PROJECT_ID" >&2
  exit 1
fi

REGION="${REGION:-us-central1}"
AR_REPOSITORY="${AR_REPOSITORY:-msgf}"
IMAGE_NAME="${IMAGE_NAME:-msgf-core}"
SERVICE_NAME="${SERVICE_NAME:-msgf-core}"

# Secret Manager resource IDs (same defaults as cloudbuild.yaml)
SECRET_OPENAI="${SECRET_OPENAI:-msgf-openai-api-key}"
SECRET_STRIPE_SECRET="${SECRET_STRIPE_SECRET:-msgf-stripe-secret-key}"
SECRET_STRIPE_WEBHOOK="${SECRET_STRIPE_WEBHOOK:-msgf-stripe-webhook-secret}"

# Optional Cloud Run sizing (adjust as needed)
CLOUD_RUN_CPU="${CLOUD_RUN_CPU:-2}"
CLOUD_RUN_MEMORY="${CLOUD_RUN_MEMORY:-2Gi}"
CLOUD_RUN_MIN_INSTANCES="${CLOUD_RUN_MIN_INSTANCES:-0}"
CLOUD_RUN_MAX_INSTANCES="${CLOUD_RUN_MAX_INSTANCES:-100}"

IMAGE_TAG="$(git rev-parse --short HEAD 2>/dev/null || echo "manual-$(date +%s)")"
GIT_REVISION="$(git rev-parse HEAD 2>/dev/null || echo "unknown")"

IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPOSITORY}/${IMAGE_NAME}:${IMAGE_TAG}"

echo "==> Cloud Build: ${IMAGE_URI}"
gcloud builds submit "${ROOT}" \
  --project="${PROJECT_ID}" \
  --config="${ROOT}/cloudbuild.msgf-image.yaml" \
  --substitutions="_REGION=${REGION},_AR_REPOSITORY=${AR_REPOSITORY},_IMAGE_NAME=${IMAGE_NAME},_IMAGE_TAG=${IMAGE_TAG},_GIT_REVISION=${GIT_REVISION}"

echo "==> Cloud Run deploy: ${SERVICE_NAME} (concurrency=80, secrets from Secret Manager)"
gcloud run deploy "${SERVICE_NAME}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --platform=managed \
  --image="${IMAGE_URI}" \
  --port=8080 \
  --cpu="${CLOUD_RUN_CPU}" \
  --memory="${CLOUD_RUN_MEMORY}" \
  --concurrency=80 \
  --min-instances="${CLOUD_RUN_MIN_INSTANCES}" \
  --max-instances="${CLOUD_RUN_MAX_INSTANCES}" \
  --no-cpu-throttling \
  --set-secrets="OPENAI_API_KEY=${SECRET_OPENAI}:latest,STRIPE_SECRET_KEY=${SECRET_STRIPE_SECRET}:latest,STRIPE_WEBHOOK_SECRET=${SECRET_STRIPE_WEBHOOK}:latest"

echo "==> Done. Service URL:"
gcloud run services describe "${SERVICE_NAME}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --format='value(status.url)'
