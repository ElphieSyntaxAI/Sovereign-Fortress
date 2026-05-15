#!/usr/bin/env bash
set -e
set -u
set -o pipefail

if [[ "${BASH_VERSINFO[0]:-0}" -lt 4 ]]; then
  echo "setup-cloud.sh requires Bash 4+ (associative arrays for runtime env merging)." >&2
  exit 1
fi

# =============================================================================
# Configuration — override any variable by exporting before ./setup-cloud.sh
# =============================================================================
GCP_PROJECT_ID="${GCP_PROJECT_ID:-}"
GCP_REGION="${GCP_REGION:-us-central1}"
IMAGE_NAME="${IMAGE_NAME:-msgf-api}"

# Artifact Registry Docker repo id (not the image name).
GCP_ARTIFACT_REPOSITORY="${GCP_ARTIFACT_REPOSITORY:-msgf}"

# Cloud Run service id (defaults to IMAGE_NAME).
CLOUD_RUN_SERVICE="${CLOUD_RUN_SERVICE:-${IMAGE_NAME}}"

# Optional: comma-free KEY=VALUE lines (and comments) merged into Cloud Run env.
CLOUDRUN_ENV_FILE="${CLOUDRUN_ENV_FILE:-.env.cloudrun}"

# Dockerfile path relative to repo root.
DOCKERFILE_PATH="${DOCKERFILE_PATH:-Dockerfile}"

# Image tag (defaults to short git SHA or timestamp).
IMAGE_TAG="${IMAGE_TAG:-}"

# Cloud Run sizing (override as needed).
CLOUD_RUN_CPU="${CLOUD_RUN_CPU:-2}"
CLOUD_RUN_MEMORY="${CLOUD_RUN_MEMORY:-2Gi}"
CLOUD_RUN_CONCURRENCY="${CLOUD_RUN_CONCURRENCY:-80}"
CLOUD_RUN_MIN_INSTANCES="${CLOUD_RUN_MIN_INSTANCES:-0}"
CLOUD_RUN_MAX_INSTANCES="${CLOUD_RUN_MAX_INSTANCES:-100}"

# Serverless VPC Access — Cloud Run reaches private DB / Redis via this connector.
# Range must be /28 (or larger), unused, and must not overlap VPC subnets.
VPC_NETWORK="${VPC_NETWORK:-default}"
VPC_CONNECTOR_NAME="${VPC_CONNECTOR_NAME:-msgf-connector}"
VPC_CONNECTOR_RANGE="${VPC_CONNECTOR_RANGE:-10.8.0.0/28}"
# Route RFC1918 / Google private destinations through the VPC; public APIs stay on default path.
# Override with "all-traffic" only if you intend to steer all egress via VPC (usually needs Cloud NAT).
CLOUD_RUN_VPC_EGRESS="${CLOUD_RUN_VPC_EGRESS:-private-ranges-only}"

# Secret Manager resource ids (short names) for Cloud Run --set-secrets.
SECRET_GEMINI_KEY_RESOURCE="${SECRET_GEMINI_KEY_RESOURCE:-gemini-key}"
SECRET_ANTHROPIC_KEY_RESOURCE="${SECRET_ANTHROPIC_KEY_RESOURCE:-anthropic-key}"

# =============================================================================
# Repo root
# =============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

# -----------------------------------------------------------------------------
# Windows Git Bash / MSYS: the bundled gcloud script does `exec python ...`.
# If only python3 or the Windows "py" launcher is on PATH, gcloud fails with:
#   exec: python: not found
# Fix: point CLOUDSDK_PYTHON at a real interpreter (override anytime: export CLOUDSDK_PYTHON=...).
# -----------------------------------------------------------------------------
if [[ -z "${CLOUDSDK_PYTHON:-}" ]]; then
  if command -v python >/dev/null 2>&1; then
    CLOUDSDK_PYTHON="$(command -v python)"
    export CLOUDSDK_PYTHON
  elif command -v python3 >/dev/null 2>&1; then
    CLOUDSDK_PYTHON="$(command -v python3)"
    export CLOUDSDK_PYTHON
  elif command -v py >/dev/null 2>&1; then
    CLOUDSDK_PYTHON="$(command -v py)"
    export CLOUDSDK_PYTHON
  elif [[ -x "/c/Windows/py.exe" ]]; then
    export CLOUDSDK_PYTHON="/c/Windows/py.exe"
  fi
fi
if [[ -n "${CLOUDSDK_PYTHON:-}" ]]; then
  echo "Using Python for Google Cloud CLI: ${CLOUDSDK_PYTHON}"
fi
if [[ -z "${CLOUDSDK_PYTHON:-}" ]]; then
  echo "gcloud requires Python, but none was found for CLOUDSDK_PYTHON." >&2
  echo "Install Python (https://www.python.org/downloads/) and enable 'Add python.exe to PATH'," >&2
  echo "or set explicitly before re-running, e.g. in Git Bash:" >&2
  echo "  export CLOUDSDK_PYTHON=/c/Path/To/python.exe" >&2
  echo "Alternatively run this script from PowerShell:  bash ./setup-cloud.sh" >&2
  exit 1
fi

echo ""
echo "=== MSGF — Cloud Build + Cloud Run deploy ==="
echo ""

# --- Project -----------------------------------------------------------------
if [[ -z "${GCP_PROJECT_ID// }" ]]; then
  read -r -p "Enter GCP_PROJECT_ID: " GCP_PROJECT_ID
  GCP_PROJECT_ID="${GCP_PROJECT_ID//[[:space:]]/}"
fi
if [[ -z "${GCP_PROJECT_ID}" ]]; then
  echo "Error: GCP_PROJECT_ID is required." >&2
  exit 1
fi

# --- Auth --------------------------------------------------------------------
if ! gcloud auth print-access-token >/dev/null 2>&1; then
  echo "gcloud: no valid credentials; launching browser login..."
  gcloud auth login
fi

echo "Using project: ${GCP_PROJECT_ID}"
gcloud projects describe "${GCP_PROJECT_ID}" --quiet >/dev/null

echo "Setting active gcloud project..."
gcloud config set project "${GCP_PROJECT_ID}" --quiet

# --- Runtime SA: Secret Manager (bootstrap before infra APIs) ---------------
echo ""
echo "Ensuring default Compute Engine SA can access Secret Manager secrets..."
PROJECT_NUMBER="$(gcloud projects describe "${GCP_PROJECT_ID}" --format='value(projectNumber)')"
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
gcloud projects add-iam-policy-binding "${GCP_PROJECT_ID}" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet 2>/dev/null || true

# --- APIs --------------------------------------------------------------------
echo ""
echo "Enabling required APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  iam.googleapis.com \
  vpcaccess.googleapis.com \
  compute.googleapis.com \
  --project="${GCP_PROJECT_ID}" \
  --quiet

# --- VPC network + Serverless VPC Access connector ----------------------------
echo ""
if ! gcloud compute networks describe "${VPC_NETWORK}" \
  --project="${GCP_PROJECT_ID}" \
  --quiet >/dev/null 2>&1
then
  echo "Error: VPC network '${VPC_NETWORK}' not found in ${GCP_PROJECT_ID}." >&2
  echo "Create it or set VPC_NETWORK to your VPC name." >&2
  exit 1
fi

echo "Ensuring Serverless VPC Access connector '${VPC_CONNECTOR_NAME}' (${GCP_REGION}, ${VPC_CONNECTOR_RANGE})..."
if gcloud compute networks vpc-access connectors describe "${VPC_CONNECTOR_NAME}" \
  --region="${GCP_REGION}" \
  --project="${GCP_PROJECT_ID}" \
  --quiet >/dev/null 2>&1
then
  echo "Connector already exists."
else
  gcloud compute networks vpc-access connectors create "${VPC_CONNECTOR_NAME}" \
    --project="${GCP_PROJECT_ID}" \
    --region="${GCP_REGION}" \
    --network="${VPC_NETWORK}" \
    --range="${VPC_CONNECTOR_RANGE}" \
    --quiet
  echo "Connector created."
fi

# --- Artifact Registry -------------------------------------------------------
echo ""
echo "Ensuring Artifact Registry repo '${GCP_ARTIFACT_REPOSITORY}' (${GCP_REGION})..."
if gcloud artifacts repositories describe "${GCP_ARTIFACT_REPOSITORY}" \
  --location="${GCP_REGION}" \
  --project="${GCP_PROJECT_ID}" \
  --quiet 2>/dev/null
then
  echo "Repository exists."
else
  gcloud artifacts repositories create "${GCP_ARTIFACT_REPOSITORY}" \
    --repository-format=docker \
    --location="${GCP_REGION}" \
    --project="${GCP_PROJECT_ID}" \
    --description="MSGF container images" \
    --quiet
fi

# Cloud Build SA → push images (PROJECT_NUMBER resolved above)
CLOUD_BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
gcloud projects add-iam-policy-binding "${GCP_PROJECT_ID}" \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/artifactregistry.writer" \
  --quiet 2>/dev/null || true

# Default Cloud Run runtime SA (unless you set a custom service account on the service).
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
gcloud projects add-iam-policy-binding "${GCP_PROJECT_ID}" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/vpcaccess.user" \
  --quiet 2>/dev/null || true

# --- Image URI ---------------------------------------------------------------
if [[ -z "${IMAGE_TAG// }" ]]; then
  IMAGE_TAG="$(git rev-parse --short HEAD 2>/dev/null || echo "manual-$(date +%s)')"
fi
IMAGE_URI="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${GCP_ARTIFACT_REPOSITORY}/${IMAGE_NAME}:${IMAGE_TAG}"

# --- Build (Cloud Build: submit context + tag → Artifact Registry) ------------
echo ""
echo "Building and pushing: ${IMAGE_URI}"
echo "Context: ${SCRIPT_DIR}  Dockerfile: ${DOCKERFILE_PATH}"

run_cloud_build_default_dockerfile() {
  gcloud builds submit "${SCRIPT_DIR}" \
    --project="${GCP_PROJECT_ID}" \
    --tag="${IMAGE_URI}"
}

run_cloud_build_custom_dockerfile() {
  local cb_tmp
  cb_tmp="$(mktemp "${TMPDIR:-/tmp}/msgf-cloudbuild.XXXXXX")"
  trap "rm -f '${cb_tmp}'" EXIT
  cat >"${cb_tmp}" <<EOF
steps:
  - name: gcr.io/cloud-builders/docker
    args:
      - build
      - -f
      - ${DOCKERFILE_PATH}
      - -t
      - ${IMAGE_URI}
      - .
images:
  - ${IMAGE_URI}
EOF
  gcloud builds submit "${SCRIPT_DIR}" \
    --project="${GCP_PROJECT_ID}" \
    --config="${cb_tmp}"
  trap - EXIT
  rm -f "${cb_tmp}"
}

if [[ "${DOCKERFILE_PATH}" == "Dockerfile" ]]; then
  run_cloud_build_default_dockerfile
else
  echo "Using non-default Dockerfile via generated Cloud Build config."
  run_cloud_build_custom_dockerfile
fi

# --- Runtime env: defaults + optional file + allowlisted shell exports ---------
declare -A RUN_ENV=()
RUN_ENV[NODE_ENV]="production"
RUN_ENV[NEXT_TELEMETRY_DISABLED]="1"

if [[ -f "${CLOUDRUN_ENV_FILE}" ]]; then
  echo "Loading extra env from ${CLOUDRUN_ENV_FILE}"
  while IFS= read -r line || [[ -n "${line}" ]]; do
    line="${line//$'\r'/}"
    [[ "${line}" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line// }" ]] && continue
    if [[ "${line}" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      k="${line%%=*}"
      v="${line#*=}"
      RUN_ENV["${k}"]="${v}"
    fi
  done <"${CLOUDRUN_ENV_FILE}"
fi

# Non-secret vars taken from the invoking shell when exported (use Secret Manager for keys).
ALLOWLIST_EXPORT_KEYS=(
  NODE_ENV
  NEXT_TELEMETRY_DISABLED
  HOSTNAME
  GCP_LOCATION
  LOG_LEVEL
)
for key in "${ALLOWLIST_EXPORT_KEYS[@]}"; do
  eval "v=\${${key}-}"
  if [[ -n "${v}" ]]; then
    RUN_ENV["${key}"]="${v}"
  fi
done

UPDATE_ENV_FLAGS=()
ENV_STRING=""
sep=""
for k in "${!RUN_ENV[@]}"; do
  ENV_STRING+="${sep}${k}=${RUN_ENV[$k]}"
  sep=","
done
if [[ -n "${ENV_STRING}" ]]; then
  UPDATE_ENV_FLAGS=(--update-env-vars="${ENV_STRING}")
fi

# --- Secrets (MASTER_* env vars ← Secret Manager; strict comma syntax, no spaces) ---
SECRET_FLAGS=()
MISSING=0
for s in "${SECRET_GEMINI_KEY_RESOURCE}" "${SECRET_ANTHROPIC_KEY_RESOURCE}"; do
  if gcloud secrets describe "${s}" --project="${GCP_PROJECT_ID}" --quiet 2>/dev/null; then
    :
  else
    echo "Warning: Secret '${s}' not found — deploy may fail if your app requires it." >&2
    MISSING=1
  fi
done

if [[ "${MISSING}" -eq 0 ]]; then
  SECRET_FLAGS=(
    --set-secrets="MASTER_GEMINI_KEY=${SECRET_GEMINI_KEY_RESOURCE}:latest,MASTER_ANTHROPIC_KEY=${SECRET_ANTHROPIC_KEY_RESOURCE}:latest"
  )
fi

# --- Deploy ------------------------------------------------------------------
echo ""
echo "Deploying Cloud Run service: ${CLOUD_RUN_SERVICE}"

DEPLOY_CMD=(
  gcloud run deploy "${CLOUD_RUN_SERVICE}"
  --project="${GCP_PROJECT_ID}"
  --region="${GCP_REGION}"
  --platform=managed
  --image="${IMAGE_URI}"
  --port=8080
  --cpu="${CLOUD_RUN_CPU}"
  --memory="${CLOUD_RUN_MEMORY}"
  --concurrency="${CLOUD_RUN_CONCURRENCY}"
  --min-instances="${CLOUD_RUN_MIN_INSTANCES}"
  --max-instances="${CLOUD_RUN_MAX_INSTANCES}"
  --no-cpu-throttling
  --allow-unauthenticated
  --vpc-connector="${VPC_CONNECTOR_NAME}"
  --vpc-egress="${CLOUD_RUN_VPC_EGRESS}"
)

if [[ "${#UPDATE_ENV_FLAGS[@]}" -gt 0 ]]; then
  DEPLOY_CMD+=("${UPDATE_ENV_FLAGS[@]}")
fi
if [[ "${#SECRET_FLAGS[@]}" -gt 0 ]]; then
  DEPLOY_CMD+=("${SECRET_FLAGS[@]}")
fi

"${DEPLOY_CMD[@]}"

SERVICE_URL="$(
  gcloud run services describe "${CLOUD_RUN_SERVICE}" \
    --project="${GCP_PROJECT_ID}" \
    --region="${GCP_REGION}" \
    --format='value(status.url)'
)"

echo ""
echo "=== Done ==="
echo "Service URL: ${SERVICE_URL}"
echo ""
echo "Tip: set GCP_PROJECT_ID / GCP_REGION / IMAGE_NAME at the top or export before running."
echo "     VPC: VPC_NETWORK=${VPC_NETWORK} VPC_CONNECTOR_NAME=${VPC_CONNECTOR_NAME} VPC_CONNECTOR_RANGE=${VPC_CONNECTOR_RANGE}"
echo "     Optional env file: ${CLOUDRUN_ENV_FILE} (KEY=VALUE lines)."
echo ""
