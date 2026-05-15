#!/usr/bin/env bash
#
# setup-cloud.sh — First-time Google Cloud setup + build + deploy for MSGF (Cloud Run).
#
# Before you run this:
#   1. Install Google Cloud CLI: https://cloud.google.com/sdk/docs/install
#   2. Run:  gcloud auth login
#   3. Create a GCP project in https://console.cloud.google.com/ (note the Project ID)
#   4. Enable billing on that project (Cloud Run & Cloud Build need it)
#   5. Your Google account needs permission on that project (e.g. “Owner” or “Editor”,
#      or a custom role with Cloud Run Admin, Cloud Build Editor, Secret Manager Admin,
#      Artifact Registry Admin — exact roles depend on your org).
#   6. From this repo root:  chmod +x setup-cloud.sh && ./setup-cloud.sh
#
# What this script does (high level):
#   • Asks for your Project ID and region
#   • Turns on the Google APIs you need (Cloud Run, Artifact Registry, Secret Manager, Cloud Build)
#   • Creates a Docker “bucket” (Artifact Registry repository) for your images
#   • Helps you create secrets (OpenAI / Stripe) — never pasted into this file
#   • Builds your Dockerfile in the cloud (saves your laptop CPU)
#   • Deploys the image to Cloud Run
#   • Calls GET /health on your new URL to verify the service responds
#

set -euo pipefail
# set -e  → exit immediately if any command fails (so you don’t deploy half-broken state).
# set -u  → error if you use an undefined variable (catches typos).
# set -o pipefail → if a command in a pipeline fails, the whole pipeline counts as failed.

# ---------------------------------------------------------------------------
# Resolve repo root (directory where this script lives). We build from here
# because the Dockerfile expects the whole monorepo context.
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

echo ""
echo "=== MSGF — Google Cloud first-time setup ==="
echo ""

# ---------------------------------------------------------------------------
# Ask for PROJECT_ID. This is the short id (e.g. my-company-prod), not the
# long project name. You see it in the GCP console project picker.
# ---------------------------------------------------------------------------
read -r -p "Enter your GCP PROJECT_ID (e.g. my-msgf-prod): " PROJECT_ID
# read -r        → read raw input (don’t treat backslashes specially).
# -p "..."       → prompt text before the cursor.

# Trim accidental spaces; empty input is not allowed.
PROJECT_ID="${PROJECT_ID//[[:space:]]/}"
if [[ -z "${PROJECT_ID}" ]]; then
  echo "Error: PROJECT_ID cannot be empty." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Verify the project exists and you have access. Exits non‑zero if wrong id
# or no permission (teaches you early if auth is wrong).
# ---------------------------------------------------------------------------
echo ""
echo "Checking that project '${PROJECT_ID}' exists and is reachable..."
gcloud projects describe "${PROJECT_ID}" --quiet
# gcloud projects describe → metadata API call; fails if project id is invalid.

# ---------------------------------------------------------------------------
# Make all following gcloud commands default to this project (less repetition).
# This updates your local gcloud config (~/.config/gcloud), not the cloud.
# ---------------------------------------------------------------------------
echo "Setting active gcloud project to ${PROJECT_ID}..."
gcloud config set project "${PROJECT_ID}" --quiet

# ---------------------------------------------------------------------------
# REGION: where your Artifact Registry repo and Cloud Run service live.
# us-central1 is a common default; you can choose europe-west1, etc.
# ---------------------------------------------------------------------------
read -r -p "Region for Artifact Registry + Cloud Run [press Enter for us-central1]: " REGION
REGION="${REGION:-us-central1}"
# ${REGION:-us-central1} → if REGION is empty, use the default after :-

# These names match deploy.sh / cloudbuild so everything stays consistent.
AR_REPOSITORY="${AR_REPOSITORY:-msgf}"
IMAGE_NAME="${IMAGE_NAME:-msgf-core}"
SERVICE_NAME="${SERVICE_NAME:-msgf-core}"

SECRET_OPENAI="${SECRET_OPENAI:-msgf-openai-api-key}"
SECRET_STRIPE_SECRET="${SECRET_STRIPE_SECRET:-msgf-stripe-secret-key}"
SECRET_STRIPE_WEBHOOK="${SECRET_STRIPE_WEBHOOK:-msgf-stripe-webhook-secret}"

CLOUD_RUN_CPU="${CLOUD_RUN_CPU:-2}"
CLOUD_RUN_MEMORY="${CLOUD_RUN_MEMORY:-2Gi}"
CLOUD_RUN_MIN_INSTANCES="${CLOUD_RUN_MIN_INSTANCES:-0}"
CLOUD_RUN_MAX_INSTANCES="${CLOUD_RUN_MAX_INSTANCES:-100}"

# ---------------------------------------------------------------------------
# Enable required Google Cloud APIs.
# “services enable” is idempotent: safe to run again; already-on APIs stay on.
# - run.googleapis.com          → Cloud Run (hosts your container as an HTTPS URL).
# - artifactregistry.googleapis.com → stores Docker images (like a private Docker Hub).
# - secretmanager.googleapis.com    → stores API keys; Cloud Run injects them at runtime.
# - cloudbuild.googleapis.com       → builds your image in Google’s datacenters.
# - iam.googleapis.com              → IAM; useful when other tools manage service accounts.
# ---------------------------------------------------------------------------
echo ""
echo "Enabling required Google APIs (may take a minute the first time)..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  iam.googleapis.com \
  --project="${PROJECT_ID}" \
  --quiet

# ---------------------------------------------------------------------------
# Artifact Registry: create a *repository* (a folder for Docker images).
# We skip creation if it already exists (so the script is re-runnable).
#describe → non‑zero exit if missing; we ignore that with || true and branch.
# ---------------------------------------------------------------------------
echo ""
echo "Ensuring Artifact Registry repository '${AR_REPOSITORY}' (${REGION}) exists..."
if gcloud artifacts repositories describe "${AR_REPOSITORY}" \
  --location="${REGION}" \
  --project="${PROJECT_ID}" \
  --quiet 2>/dev/null
then
  echo "Repository already exists — skipping create."
else
  echo "Creating repository (format=docker)..."
  gcloud artifacts repositories create "${AR_REPOSITORY}" \
    --repository-format=docker \
    --location="${REGION}" \
    --project="${PROJECT_ID}" \
    --description="MSGF Docker images" \
    --quiet
fi

# ---------------------------------------------------------------------------
# Cloud Build’s robot account must push images to Artifact Registry.
# PROJECT_NUMBER is a numeric id; the Cloud Build SA email is built from it.
# We grant roles/artifactregistry.writer so `gcloud builds submit` can push.
# add-iam-policy-binding is additive; re-running may add duplicate bindings
# in some setups — usually harmless; org policy may restrict this.
# ---------------------------------------------------------------------------
echo ""
echo "Granting Cloud Build service account permission to push to Artifact Registry..."
PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
# projectNumber → stable numeric id used in default service account emails.
CLOUD_BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/artifactregistry.writer" \
  --quiet 2>/dev/null || {
    echo "Note: Could not add artifactregistry.writer (you may lack iam.policyBinding, or it’s already set)."
}

# ---------------------------------------------------------------------------
# Secret Manager: your app expects three secrets (see deploy.sh).
# If a secret is missing, we optionally create it from a hidden terminal line.
# Values never appear in this script file — only piped to gcloud.
# ---------------------------------------------------------------------------
echo ""
echo "=== Secret Manager ==="
echo "Cloud Run will mount these as environment variables (no keys in git)."
echo ""

ensure_secret() {
  local id="$1"
  local human="$2"
  if gcloud secrets describe "${id}" --project="${PROJECT_ID}" --quiet 2>/dev/null; then
    echo "Secret '${id}' already exists."
    return 0
  fi
  echo "Secret '${id}' (${human}) does not exist yet."
  read -r -p "Create it now? [y/N]: " yn
  if [[ "${yn:-}" =~ ^[Yy]$ ]]; then
    # -s = hide typing (password-style). Important for API keys.
    read -r -s -p "Paste the secret value (input hidden), then Enter: " secret_val
    echo ""
    if [[ -z "${secret_val}" ]]; then
      echo "Skipped empty value — create '${id}' later in console or with gcloud."
      return 0
    fi
    # secrets create --data-file=- reads the value from stdin (not from argv).
    printf '%s' "${secret_val}" | gcloud secrets create "${id}" \
      --data-file=- \
      --project="${PROJECT_ID}" \
      --replication-policy=automatic \
      --quiet
    echo "Created secret '${id}'."
  else
    echo "Skipped. Before deploy works you must create '${id}' (Secret Manager)."
  fi
}

ensure_secret "${SECRET_OPENAI}" "OpenAI API key → env OPENAI_API_KEY"
ensure_secret "${SECRET_STRIPE_SECRET}" "Stripe secret key → env STRIPE_SECRET_KEY"
ensure_secret "${SECRET_STRIPE_WEBHOOK}" "Stripe webhook secret → env STRIPE_WEBHOOK_SECRET"

# ---------------------------------------------------------------------------
# The MSGF /health route checks Supabase (vector table). Without these env vars
# the service may run but return {status:\"unhealthy\"}. Optional prompts.
# Production best practice is Secret Manager for the service role key too;
# this teaches the minimal path; you can move the key to a secret later.
# ---------------------------------------------------------------------------
echo ""
echo "=== Supabase (needed for GET /health to return healthy) ==="
read -r -p "NEXT_PUBLIC_SUPABASE_URL [empty to skip — fix later in Cloud Run console]: " SUPA_URL
SUPA_URL="${SUPA_URL//[[:space:]]/}"
read -r -s -p "SUPABASE_SERVICE_ROLE_KEY [empty to skip]: " SUPA_KEY
echo ""

UPDATE_ENV_FLAGS=()
if [[ -n "${SUPA_URL}" && -n "${SUPA_KEY}" ]]; then
  # update-env-vars merges into existing configuration on the Cloud Run service.
  UPDATE_ENV_FLAGS=(--update-env-vars="NEXT_PUBLIC_SUPABASE_URL=${SUPA_URL},SUPABASE_SERVICE_ROLE_KEY=${SUPA_KEY}")
elif [[ -n "${SUPA_URL}" || -n "${SUPA_KEY}" ]]; then
  echo "Warning: set BOTH URL and service role key for health checks; skipping partial env."
fi

# ---------------------------------------------------------------------------
# Build the Docker image in Cloud Build (uploads source tarball, runs Dockerfile).
# IMAGE_TAG identifies this build; we use git short SHA or a timestamp fallback.
# ---------------------------------------------------------------------------
IMAGE_TAG="$(git rev-parse --short HEAD 2>/dev/null || echo "setup-$(date +%s)")"
GIT_REVISION="$(git rev-parse HEAD 2>/dev/null || echo "unknown")"
IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPOSITORY}/${IMAGE_NAME}:${IMAGE_TAG}"

echo ""
echo "=== Cloud Build: building and pushing image ==="
echo "Image: ${IMAGE_URI}"
gcloud builds submit "${SCRIPT_DIR}" \
  --project="${PROJECT_ID}" \
  --config="${SCRIPT_DIR}/cloudbuild.msgf-image.yaml" \
  --substitutions="_REGION=${REGION},_AR_REPOSITORY=${AR_REPOSITORY},_IMAGE_NAME=${IMAGE_NAME},_IMAGE_TAG=${IMAGE_TAG},_GIT_REVISION=${GIT_REVISION}"

# ---------------------------------------------------------------------------
# Deploy to Cloud Run: creates or updates the service with this image.
# --platform=managed      → fully serverless Cloud Run (no Kubernetes to manage).
# --port=8080             → matches our Dockerfile / Cloud Run default convention.
# --allow-unauthenticated → anyone on the internet can call the URL (good for /health demos;
#                            tighten later with IAM for production APIs).
# --set-secrets           → maps Secret Manager names → environment variables inside the container.
# ---------------------------------------------------------------------------
echo ""
echo "=== Cloud Run: deploy ==="

MISSING_SECRET=0
for s in "${SECRET_OPENAI}" "${SECRET_STRIPE_SECRET}" "${SECRET_STRIPE_WEBHOOK}"; do
  if ! gcloud secrets describe "${s}" --project="${PROJECT_ID}" --quiet 2>/dev/null; then
    echo "Error: Secret '${s}' is missing — create it in Secret Manager or re-run the secret step." >&2
    MISSING_SECRET=1
  fi
done
if [[ "${MISSING_SECRET}" -ne 0 ]]; then
  echo "Aborting deploy because required secrets are missing." >&2
  exit 1
fi

if [[ ${#UPDATE_ENV_FLAGS[@]} -gt 0 ]]; then
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
    --allow-unauthenticated \
    --set-secrets="OPENAI_API_KEY=${SECRET_OPENAI}:latest,STRIPE_SECRET_KEY=${SECRET_STRIPE_SECRET}:latest,STRIPE_WEBHOOK_SECRET=${SECRET_STRIPE_WEBHOOK}:latest" \
    "${UPDATE_ENV_FLAGS[@]}"
else
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
    --allow-unauthenticated \
    --set-secrets="OPENAI_API_KEY=${SECRET_OPENAI}:latest,STRIPE_SECRET_KEY=${SECRET_STRIPE_SECRET}:latest,STRIPE_WEBHOOK_SECRET=${SECRET_STRIPE_WEBHOOK}:latest"
fi

# ---------------------------------------------------------------------------
# Fetch the HTTPS URL Google assigned to this revision.
# status.url is the public endpoint (unless you later restrict IAM).
# ---------------------------------------------------------------------------
SERVICE_URL="$(
  gcloud run services describe "${SERVICE_NAME}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --format='value(status.url)'
)"

echo ""
echo "=== Health check: GET /health ==="
echo "Service URL: ${SERVICE_URL}"

# Temporary file for the JSON body (-o file) so we can print it and still capture the HTTP code (-w).
HEALTH_BODY_FILE="$(mktemp 2>/dev/null || echo "${TMPDIR:-/tmp}/msgf-health-$$.json")"
cleanup_health_tmp() { rm -f "${HEALTH_BODY_FILE}" 2>/dev/null || true; }
trap cleanup_health_tmp EXIT

# curl flags:
#   -sS  → silent but show errors if connection fails
#   -f   → HTTP 4xx/5xx makes curl exit non‑zero (so the script fails visibly)
#   -m 30→ timeout 30 seconds (cold start can be slow the first time)
echo "Requesting ${SERVICE_URL}/health ..."
set +e
HTTP_CODE="$(curl -sS -o "${HEALTH_BODY_FILE}" -w '%{http_code}' -m 90 "${SERVICE_URL}/health")"
CURL_EXIT=$?
set -e

if [[ "${CURL_EXIT}" -ne 0 ]]; then
  echo "curl failed (exit ${CURL_EXIT}). Check network, URL, or Cloud Run logs." >&2
  exit 1
fi

echo "HTTP status: ${HTTP_CODE}"
cat "${HEALTH_BODY_FILE}"
echo ""

if [[ "${HTTP_CODE}" != "200" ]]; then
  echo ""
  echo "The Brain responded but /health did not return 200."
  echo "Common fix: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the service"
  echo "(Console → Cloud Run → your service → Edit & deploy → Variables & secrets)."
  exit 1
fi

echo ""
echo "=== Success ==="
echo "Your MSGF service is live at: ${SERVICE_URL}"
echo "Tip: run ./deploy.sh later for quicker rebuilds (same project/repo defaults)."
echo ""
