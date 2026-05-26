#!/usr/bin/env bash
set -euo pipefail

if [[ "${BASH_VERSINFO[0]:-0}" -lt 4 ]]; then
  echo "setup-author-cloud.sh requires Bash 4+." >&2
  exit 1
fi

# =============================================================================
# Author Ecosystem — Cloud Build + Cloud Run (BFF then static client)
# =============================================================================
GCP_PROJECT_ID="${GCP_PROJECT_ID:-}"
GCP_REGION="${GCP_REGION:-us-central1}"
GCP_ARTIFACT_REPOSITORY="${GCP_ARTIFACT_REPOSITORY:-msgf}"

AUTHOR_BFF_SERVICE="${AUTHOR_BFF_SERVICE:-author-bff}"
AUTHOR_CLIENT_SERVICE="${AUTHOR_CLIENT_SERVICE:-author-client}"
AUTHOR_BFF_IMAGE="${AUTHOR_BFF_IMAGE:-author-bff}"
AUTHOR_CLIENT_IMAGE="${AUTHOR_CLIENT_IMAGE:-author-client}"

CLOUDRUN_ENV_FILE="${CLOUDRUN_ENV_FILE:-.env.cloudrun}"
IMAGE_TAG="${IMAGE_TAG:-}"

CLOUD_RUN_CPU="${CLOUD_RUN_CPU:-1}"
CLOUD_RUN_MEMORY="${CLOUD_RUN_MEMORY:-1Gi}"
CLOUD_RUN_CONCURRENCY="${CLOUD_RUN_CONCURRENCY:-80}"
CLOUD_RUN_MIN_INSTANCES="${CLOUD_RUN_MIN_INSTANCES:-0}"
CLOUD_RUN_MAX_INSTANCES="${CLOUD_RUN_MAX_INSTANCES:-20}"

# Deploy only BFF or only client: export AUTHOR_DEPLOY_TARGET=bff|client|both
AUTHOR_DEPLOY_TARGET="${AUTHOR_DEPLOY_TARGET:-both}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

declare -A RUN_ENV=()
RUN_ENV[NODE_ENV]="production"

_load_cloudrun_env() {
  [[ -f "${CLOUDRUN_ENV_FILE}" ]] || return 0
  echo "Loading env from ${CLOUDRUN_ENV_FILE}"
  while IFS= read -r line || [[ -n "${line}" ]]; do
    line="${line//$'\r'/}"
    [[ "${line}" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line// /}" ]] && continue
    if [[ "${line}" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      k="${line%%=*}"
      v="${line#*=}"
      v="${v%%[[:space:]]#*}"
      v="${v%"${v##*[![:space:]]}"}"
      RUN_ENV["${k}"]="${v}"
    fi
  done <"${CLOUDRUN_ENV_FILE}"
}

_load_cloudrun_env

if [[ -z "${GCP_PROJECT_ID// /}" ]]; then
  GCP_PROJECT_ID="${RUN_ENV[GCP_PROJECT_ID]:-}"
fi
if [[ -z "${GCP_PROJECT_ID// /}" ]]; then
  read -r -p "Enter GCP_PROJECT_ID: " GCP_PROJECT_ID
  GCP_PROJECT_ID="${GCP_PROJECT_ID//[[:space:]]/}"
fi
[[ -n "${GCP_PROJECT_ID}" ]] || { echo "GCP_PROJECT_ID required." >&2; exit 1; }

if ! gcloud auth print-access-token >/dev/null 2>&1; then
  echo "gcloud: launching browser login..."
  gcloud auth login
fi

gcloud config set project "${GCP_PROJECT_ID}" --quiet
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com \
  --project="${GCP_PROJECT_ID}" --quiet

if ! gcloud artifacts repositories describe "${GCP_ARTIFACT_REPOSITORY}" \
  --location="${GCP_REGION}" --project="${GCP_PROJECT_ID}" --quiet 2>/dev/null; then
  gcloud artifacts repositories create "${GCP_ARTIFACT_REPOSITORY}" \
    --repository-format=docker \
    --location="${GCP_REGION}" \
    --project="${GCP_PROJECT_ID}" \
    --description="Elphie Syntax container images" \
    --quiet
fi

if [[ -z "${IMAGE_TAG// /}" ]]; then
  IMAGE_TAG="$(git rev-parse --short HEAD 2>/dev/null || echo "manual-$(date +%s)")"
fi

# Comma-separated --update-env-vars breaks on BFF_ALLOWED_ORIGINS (multiple URLs).
# Write a YAML env file for gcloud run deploy --env-vars-file.
BFF_ENV_KEYS=(
  NODE_ENV
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  SUPABASE_JWT_SECRET
  MSGF_APP_URL
  MSGF_AUTHOR_TENANT_ID
  MSGF_AUTHOR_PULSE_LICENSE_KEY
  MSGF_AUTHOR_HAL_PULSE_ENABLED
  MSGF_AUTHOR_DEV_SESSION
  BFF_ALLOWED_ORIGINS
  BFF_ALLOWED_ORIGIN_REGEX
  MSGF_PRODUCTION_AUTHOR_ALLOWED_ORIGINS
  OPENAI_API_KEY
  GCP_API_KEY
  GCP_MODEL_ID
)

_write_env_vars_file() {
  local out="$1"
  shift
  local keys=("$@")
  local k v
  : >"${out}"
  for k in "${keys[@]}"; do
    v="${RUN_ENV[$k]:-}"
    [[ -n "${v}" ]] || continue
    v="${v//\\/\\\\}"
    v="${v//\"/\\\"}"
    printf '%s: "%s"\n' "${k}" "${v}" >>"${out}"
  done
}

_run_cloud_build() {
  local config_path="$1"
  gcloud builds submit "${SCRIPT_DIR}" \
    --project="${GCP_PROJECT_ID}" \
    --quiet \
    --config="${config_path}"
}

_deploy_bff() {
  local uri="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${GCP_ARTIFACT_REPOSITORY}/${AUTHOR_BFF_IMAGE}:${IMAGE_TAG}"
  echo ""
  echo "=== Building Author BFF: ${uri} ==="
  local cb_tmp
  cb_tmp="$(mktemp "${TMPDIR:-/tmp}/author-bff-cloudbuild.XXXXXX.yaml")"
  cat >"${cb_tmp}" <<EOF
steps:
  - name: gcr.io/cloud-builders/docker
    args: [build, -f, docker/Dockerfile.author-bff, -t, ${uri}, .]
images:
  - ${uri}
EOF
  _run_cloud_build "${cb_tmp}"

  local env_tmp
  env_tmp="$(mktemp "${TMPDIR:-/tmp}/author-bff-env.XXXXXX.yaml")"
  trap 'rm -f "${cb_tmp:-}" "${env_tmp:-}"' RETURN
  _write_env_vars_file "${env_tmp}" "${BFF_ENV_KEYS[@]}"

  local deploy=(gcloud run deploy "${AUTHOR_BFF_SERVICE}"
    --project="${GCP_PROJECT_ID}"
    --region="${GCP_REGION}"
    --platform=managed
    --image="${uri}"
    --port=8080
    --cpu="${CLOUD_RUN_CPU}"
    --memory="${CLOUD_RUN_MEMORY}"
    --concurrency="${CLOUD_RUN_CONCURRENCY}"
    --min-instances="${CLOUD_RUN_MIN_INSTANCES}"
    --max-instances="${CLOUD_RUN_MAX_INSTANCES}"
    --allow-unauthenticated
  )
  if [[ -s "${env_tmp}" ]]; then
    deploy+=(--env-vars-file="${env_tmp}")
  fi
  echo ""
  echo "=== Deploying Author BFF: ${AUTHOR_BFF_SERVICE} ==="
  "${deploy[@]}"

  gcloud run services describe "${AUTHOR_BFF_SERVICE}" \
    --project="${GCP_PROJECT_ID}" \
    --region="${GCP_REGION}" \
    --format='value(status.url)'
}

_deploy_client() {
  local bff_url="${1:-}"
  local supa="${RUN_ENV[VITE_SUPABASE_URL]:-${RUN_ENV[NEXT_PUBLIC_SUPABASE_URL]:-}}"
  local anon="${RUN_ENV[VITE_SUPABASE_ANON_KEY]:-${RUN_ENV[NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY]:-}}"
  local author_app="${RUN_ENV[VITE_AUTHOR_APP_URL]:-${RUN_ENV[NEXT_PUBLIC_AUTHOR_APP_URL]:-https://authorecosystem.elphiesyntax.com}}"
  local msgf_app="${RUN_ENV[VITE_MSGF_APP_URL]:-${RUN_ENV[NEXT_PUBLIC_MSGF_APP_URL]:-https://elphiesgatedai.elphiesyntax.com}}"
  local edu="${RUN_ENV[VITE_EDUCATION_APP_URL]:-${RUN_ENV[NEXT_PUBLIC_EDUCATION_APP_URL]:-https://syntaxeducates.elphiesyntax.com}}"
  local vite_bff="${RUN_ENV[VITE_AUTHOR_BFF_URL]:-}"

  if [[ -z "${vite_bff}" && -n "${bff_url}" ]]; then
    vite_bff="${bff_url%/}"
  fi
  if [[ -z "${supa}" || -z "${anon}" ]]; then
    echo "Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or NEXT_PUBLIC_*) required in ${CLOUDRUN_ENV_FILE}." >&2
    exit 1
  fi
  if [[ -z "${vite_bff}" ]]; then
    echo "Error: VITE_AUTHOR_BFF_URL unset and BFF URL unknown. Deploy BFF first or set VITE_AUTHOR_BFF_URL." >&2
    exit 1
  fi

  local uri="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${GCP_ARTIFACT_REPOSITORY}/${AUTHOR_CLIENT_IMAGE}:${IMAGE_TAG}"
  echo ""
  echo "=== Building Author client (BFF=${vite_bff}): ${uri} ==="
  local cb_tmp
  cb_tmp="$(mktemp "${TMPDIR:-/tmp}/author-client-cloudbuild.XXXXXX.yaml")"
  trap 'rm -f "${cb_tmp:-}"' RETURN
  cat >"${cb_tmp}" <<EOF
steps:
  - name: gcr.io/cloud-builders/docker
    args:
      - build
      - -f
      - docker/Dockerfile.author-client
      - -t
      - ${uri}
      - --build-arg
      - VITE_SUPABASE_URL=${supa}
      - --build-arg
      - VITE_SUPABASE_ANON_KEY=${anon}
      - --build-arg
      - VITE_AUTHOR_BFF_URL=${vite_bff}
      - --build-arg
      - VITE_AUTHOR_APP_URL=${author_app}
      - --build-arg
      - VITE_MSGF_APP_URL=${msgf_app}
      - --build-arg
      - VITE_EDUCATION_APP_URL=${edu}
      - .
images:
  - ${uri}
EOF
  _run_cloud_build "${cb_tmp}"

  echo ""
  echo "=== Deploying Author client: ${AUTHOR_CLIENT_SERVICE} ==="
  gcloud run deploy "${AUTHOR_CLIENT_SERVICE}" \
    --project="${GCP_PROJECT_ID}" \
    --region="${GCP_REGION}" \
    --platform=managed \
    --image="${uri}" \
    --port=8080 \
    --cpu=1 \
    --memory=512Mi \
    --concurrency=200 \
    --min-instances="${CLOUD_RUN_MIN_INSTANCES}" \
    --max-instances="${CLOUD_RUN_MAX_INSTANCES}" \
    --allow-unauthenticated

  gcloud run services describe "${AUTHOR_CLIENT_SERVICE}" \
    --project="${GCP_PROJECT_ID}" \
    --region="${GCP_REGION}" \
    --format='value(status.url)'
}

echo ""
echo "=== Author Ecosystem — Cloud Run deploy ==="
echo "Project: ${GCP_PROJECT_ID}  Region: ${GCP_REGION}"
echo ""

BFF_URL=""
case "${AUTHOR_DEPLOY_TARGET}" in
  bff)
    BFF_URL="$(_deploy_bff)"
    ;;
  client)
    _deploy_client ""
    ;;
  both|*)
    BFF_URL="$(_deploy_bff)"
    RUN_ENV[VITE_AUTHOR_BFF_URL]="${BFF_URL%/}"
    CLIENT_URL="$(_deploy_client "${BFF_URL}")"
    echo ""
    echo "=== Done ==="
    echo "Author BFF:    ${BFF_URL}"
    echo "Author client: ${CLIENT_URL}"
    echo ""
    echo "Next: map custom domains — ./map-product-domains.sh"
    echo "      Update Supabase redirect URLs for authorecosystem + elphiesgatedai."
    ;;
esac

if [[ "${AUTHOR_DEPLOY_TARGET}" == "bff" ]]; then
  echo ""
  echo "=== BFF only ==="
  echo "Author BFF URL: ${BFF_URL}"
  echo "Add to ${CLOUDRUN_ENV_FILE}: VITE_AUTHOR_BFF_URL=${BFF_URL%/}"
  echo "Then: AUTHOR_DEPLOY_TARGET=client ./setup-author-cloud.sh"
fi
