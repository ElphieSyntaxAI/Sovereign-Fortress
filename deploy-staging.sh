#!/usr/bin/env bash
set -euo pipefail

# Deploy all product surfaces to STAGING Cloud Run services (no production domain remap).
# See docs/STAGING_AND_RELEASE.md

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

STAGING_ENV="${CLOUDRUN_ENV_FILE:-.env.cloudrun.staging}"

if [[ ! -f "${STAGING_ENV}" ]]; then
  echo "Missing ${STAGING_ENV} — run: npm run staging:prepare" >&2
  echo "(after packages/msgf/.env.staging.local has a real staging Supabase project, not YOUR_STAGING_REF)" >&2
  exit 1
fi

node scripts/staging-preflight.mjs --env-file "${STAGING_ENV}"

export DEPLOY_ENV=staging
export CLOUDRUN_ENV_FILE="${STAGING_ENV}"

# Parallel Cloud Run service names (override before calling if you use different ids)
export CLOUD_RUN_SERVICE="${CLOUD_RUN_SERVICE:-msgf-api-staging}"
export AUTHOR_BFF_SERVICE="${AUTHOR_BFF_SERVICE:-author-bff-staging}"
export AUTHOR_CLIENT_SERVICE="${AUTHOR_CLIENT_SERVICE:-author-client-staging}"

IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD 2>/dev/null || echo "manual-$(date +%s)")}"
export IMAGE_TAG
export GIT_SHA="${GIT_SHA:-${IMAGE_TAG}}"
export DEPLOYED_AT="${DEPLOYED_AT:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"

echo "=== Staging deploy ==="
echo "  env file:     ${CLOUDRUN_ENV_FILE}"
echo "  release id:   ${IMAGE_TAG}"
echo "  MSGF service: ${CLOUD_RUN_SERVICE}"
echo "  Author BFF:   ${AUTHOR_BFF_SERVICE}"
echo "  Author client:${AUTHOR_CLIENT_SERVICE}"
echo ""

if [[ "${SKIP_VALIDATE:-0}" != "1" ]]; then
  npm run validate:deployment
fi

echo ""
echo "=== MSGF staging ==="
./setup-cloud.sh

echo ""
echo "=== Author staging (BFF + client) ==="
./setup-author-cloud.sh

echo ""
echo "=== Staging URLs (after deploy) ==="
gcloud run services describe "${CLOUD_RUN_SERVICE}" \
  --project="${GCP_PROJECT_ID:-msgf-shield}" \
  --region="${GCP_REGION:-us-central1}" \
  --format='value(status.url)' 2>/dev/null | sed 's/^/  MSGF:   /' || true
gcloud run services describe "${AUTHOR_CLIENT_SERVICE}" \
  --project="${GCP_PROJECT_ID:-msgf-shield}" \
  --region="${GCP_REGION:-us-central1}" \
  --format='value(status.url)' 2>/dev/null | sed 's/^/  Author: /' || true
gcloud run services describe "${AUTHOR_BFF_SERVICE}" \
  --project="${GCP_PROJECT_ID:-msgf-shield}" \
  --region="${GCP_REGION:-us-central1}" \
  --format='value(status.url)' 2>/dev/null | sed 's/^/  BFF:    /' || true

echo ""
echo "Smoke:"
echo "  curl -s \"\$(gcloud run services describe ${CLOUD_RUN_SERVICE} --region=${GCP_REGION:-us-central1} --format='value(status.url)')/health\" | jq .release"
echo ""
echo "When staging passes, promote to production with the same IMAGE_TAG:"
echo "  IMAGE_TAG=${IMAGE_TAG} SKIP_CLOUD_BUILD=1 ./deploy-product-domains.sh"
