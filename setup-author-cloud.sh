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

# Align Author BFF Cloud Run env with local SSOT names (Vite build-args vs BFF runtime).
_normalize_bff_run_env() {
  if [[ -z "${RUN_ENV[NEXT_PUBLIC_SUPABASE_URL]:-}" && -n "${RUN_ENV[VITE_SUPABASE_URL]:-}" ]]; then
    RUN_ENV[NEXT_PUBLIC_SUPABASE_URL]="${RUN_ENV[VITE_SUPABASE_URL]}"
  fi
  if [[ -z "${RUN_ENV[SUPABASE_URL]:-}" && -n "${RUN_ENV[NEXT_PUBLIC_SUPABASE_URL]:-}" ]]; then
    RUN_ENV[SUPABASE_URL]="${RUN_ENV[NEXT_PUBLIC_SUPABASE_URL]}"
  fi
  if [[ -z "${RUN_ENV[NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY]:-}" && -n "${RUN_ENV[VITE_SUPABASE_ANON_KEY]:-}" ]]; then
    RUN_ENV[NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY]="${RUN_ENV[VITE_SUPABASE_ANON_KEY]}"
  fi
  if [[ -z "${RUN_ENV[AUTHOR_CLIENT_ORIGIN]:-}" ]]; then
    RUN_ENV[AUTHOR_CLIENT_ORIGIN]="${RUN_ENV[AUTHOR_APP_URL]:-${RUN_ENV[VITE_AUTHOR_APP_URL]:-}}"
  fi
  if [[ -z "${RUN_ENV[GOOGLE_OAUTH_REDIRECT_URI]:-}" ]]; then
    local author_app="${RUN_ENV[AUTHOR_APP_URL]:-${RUN_ENV[VITE_AUTHOR_APP_URL]:-https://authorecosystem.elphiesyntax.com}}"
    author_app="${author_app%/}"
    RUN_ENV[GOOGLE_OAUTH_REDIRECT_URI]="${author_app}/api/google/oauth/callback"
  elif [[ -n "${RUN_ENV[AUTHOR_APP_URL]:-${RUN_ENV[VITE_AUTHOR_APP_URL]:-}}" ]]; then
    local author_app="${RUN_ENV[AUTHOR_APP_URL]:-${RUN_ENV[VITE_AUTHOR_APP_URL]}}"
    author_app="${author_app%/}"
    local redirect="${RUN_ENV[GOOGLE_OAUTH_REDIRECT_URI]}"
    if [[ "${redirect}" == *127.0.0.1* || "${redirect}" == *localhost* || "${redirect}" == *".run.app"* ]]; then
      RUN_ENV[GOOGLE_OAUTH_REDIRECT_URI]="${author_app}/api/google/oauth/callback"
    fi
  fi
}
_normalize_bff_run_env

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
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  SUPABASE_JWT_SECRET
  MSGF_AUTH_COOKIE_DOMAIN
  NEXT_PUBLIC_MSGF_AUTH_COOKIE_DOMAIN
  MSGF_AUTH_COOKIE_SECURE
  NEXT_PUBLIC_MSGF_AUTH_COOKIE_SECURE
  MSGF_OPERATOR_HANDOFF_SECRET
  MSGF_APP_URL
  MSGF_AUTHOR_TENANT_ID
  MSGF_AUTHOR_PULSE_LICENSE_KEY
  MSGF_AUTHOR_HAL_PULSE_ENABLED
  MSGF_AUTHOR_DEV_SESSION
  BFF_ALLOWED_ORIGINS
  BFF_ALLOWED_ORIGIN_REGEX
  MSGF_PRODUCTION_AUTHOR_ALLOWED_ORIGINS
  GEMINI_API_KEY
  GOOGLE_API_KEY
  OPENAI_API_KEY
  GCP_API_KEY
  GCP_MODEL_ID
  GOOGLE_OAUTH_CLIENT_ID
  GOOGLE_OAUTH_CLIENT_SECRET
  GOOGLE_OAUTH_REDIRECT_URI
  AUTHOR_CLIENT_ORIGIN
  AUTHOR_APP_URL
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
    --config="${config_path}" || return 1
}

_yaml_sanitize() {
  local v="$1"
  v="$(printf '%s' "${v}" | sed -E 's/\x1B\[[0-9;]*[mK]//g')"
  v="$(printf '%s' "${v}" | tr -d '\000-\010\013\014\016-\037')"
  printf '%s' "${v}"
}

_docker_build_arg() {
  local key="$1"
  local val
  val="$(_yaml_sanitize "$2")"
  val="${val//\\/\\\\}"
  printf '%s=%s' "${key}" "${val}"
}

_docker_build_flag() {
  _yaml_double_quote "--build-arg=$(_docker_build_arg "$1" "$2")"
}

# Cloud Build YAML breaks on unquoted https:// in docker --build-arg lines.
_yaml_double_quote() {
  local v
  v="$(_yaml_sanitize "$1")"
  v="${v//\\/\\\\}"
  v="${v//\"/\\\"}"
  printf '"%s"' "${v}"
}

_assert_bff_cloudrun_env() {
  local missing=()
  [[ -n "${RUN_ENV[SUPABASE_SERVICE_ROLE_KEY]:-}" ]] || missing+=("SUPABASE_SERVICE_ROLE_KEY")
  local url="${RUN_ENV[NEXT_PUBLIC_SUPABASE_URL]:-${RUN_ENV[SUPABASE_URL]:-${RUN_ENV[VITE_SUPABASE_URL]:-}}}"
  [[ -n "${url}" ]] || missing+=("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL or VITE_SUPABASE_URL")
  local pub="${RUN_ENV[NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY]:-${RUN_ENV[VITE_SUPABASE_ANON_KEY]:-}}"
  [[ -n "${pub}" ]] || missing+=("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY")
  if [[ ${#missing[@]} -gt 0 ]]; then
    echo "Error: Author BFF deploy requires in ${CLOUDRUN_ENV_FILE}: ${missing[*]}" >&2
    exit 1
  fi
  if [[ "${url}" == *"YOUR_PROJECT"* || "${url}" == *"your-project.supabase.co"* ]]; then
    echo "Error: ${CLOUDRUN_ENV_FILE} still has placeholder Supabase URL (${url})." >&2
    echo "  Copy NEXT_PUBLIC_SUPABASE_URL from packages/msgf/.env.local (real *.supabase.co host)." >&2
    exit 1
  fi
  if [[ "${pub}" == *"eyJ..."* || "${pub}" == "change_me" ]]; then
    echo "Error: ${CLOUDRUN_ENV_FILE} has placeholder publishable key — set real VITE_SUPABASE_ANON_KEY from .env.local." >&2
    exit 1
  fi
}

_deploy_bff() {
  _assert_bff_cloudrun_env
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
  # Empty = same-origin `/api` (nginx proxies to BFF). Cross-origin only when explicitly enabled.
  local vite_bff=""
  local bff_upstream="${bff_url:-}"
  if [[ -n "${RUN_ENV[AUTHOR_USE_CROSS_ORIGIN_BFF]:-}" ]]; then
    vite_bff="${RUN_ENV[VITE_AUTHOR_BFF_URL]:-${bff_upstream}}"
  fi
  if [[ -z "${bff_upstream}" ]]; then
    bff_upstream="${RUN_ENV[AUTHOR_BFF_UPSTREAM]:-}"
  fi
  if [[ -z "${supa}" || -z "${anon}" ]]; then
    echo "Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or NEXT_PUBLIC_*) required in ${CLOUDRUN_ENV_FILE}." >&2
    exit 1
  fi
  if [[ -z "${bff_upstream}" ]]; then
    echo "Error: Deploy BFF first (need upstream URL for nginx /api proxy)." >&2
    exit 1
  fi
  bff_upstream="${bff_upstream%/}"
  echo "Author client: VITE_AUTHOR_BFF_URL=${vite_bff:-<same-origin /api>}  nginx→${bff_upstream}"

  local uri="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${GCP_ARTIFACT_REPOSITORY}/${AUTHOR_CLIENT_IMAGE}:${IMAGE_TAG}"
  echo ""
  echo "=== Building Author client (vite BFF=${vite_bff:-same-origin}): ${uri} ==="
  local cb_tmp
  cb_tmp="$(mktemp "${TMPDIR:-/tmp}/author-client-cloudbuild.XXXXXX.yaml")"
  trap 'rm -f "${cb_tmp:-}"' RETURN
  # Direct docker build (no bash wrapper) — Cloud Build step 127 when entrypoint=bash could not find docker.
  cat >"${cb_tmp}" <<EOF
steps:
  - name: gcr.io/cloud-builders/docker
    args:
      - build
      - -f
      - docker/Dockerfile.author-client
      - -t
      - ${uri}
      - $(_docker_build_flag VITE_SUPABASE_URL "${supa}")
      - $(_docker_build_flag VITE_SUPABASE_ANON_KEY "${anon}")
      - $(_docker_build_flag VITE_AUTHOR_BFF_URL "${vite_bff}")
      - $(_docker_build_flag VITE_AUTHOR_APP_URL "${author_app}")
      - $(_docker_build_flag VITE_MSGF_APP_URL "${msgf_app}")
      - $(_docker_build_flag VITE_EDUCATION_APP_URL "${edu}")
      - $(_docker_build_flag AUTHOR_BFF_UPSTREAM "${bff_upstream}")
      - .
images:
  - ${uri}
EOF
  _run_cloud_build "${cb_tmp}" || {
    echo "Error: Author client image build failed." >&2
    return 1
  }

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
    if [[ -z "${RUN_ENV[AUTHOR_BFF_UPSTREAM]:-}" ]]; then
      BFF_URL="$(gcloud run services describe "${AUTHOR_BFF_SERVICE}" \
        --project="${GCP_PROJECT_ID}" \
        --region="${GCP_REGION}" \
        --format='value(status.url)' 2>/dev/null || true)"
    else
      BFF_URL="${RUN_ENV[AUTHOR_BFF_UPSTREAM]}"
    fi
    _deploy_client "${BFF_URL}"
    ;;
  both|*)
    BFF_URL="$(_deploy_bff)"
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
