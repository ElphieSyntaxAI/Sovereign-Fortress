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
# Default max scale must stay within per-region Serverless CPU quota (e.g. 2 vCPU × 100 instances
# exceeds typical defaults). Raise quota or override: export CLOUD_RUN_MAX_INSTANCES=…
CLOUD_RUN_MAX_INSTANCES="${CLOUD_RUN_MAX_INSTANCES:-28}"

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
# Prefer a real interpreter: PATH often has Microsoft Store *stubs* under
# .../WindowsApps/python (and python3) that print "install from the Store" and break gcloud.
# We probe with `python -c "import sys"` and skip WindowsApps paths first-class.
# Override anytime: export CLOUDSDK_PYTHON=/c/Path/To/python.exe
# -----------------------------------------------------------------------------
_gcloud_python_usable() {
  local py="$1"
  [[ -z "${py}" ]] && return 1
  case "${py}" in
    *[/\\]WindowsApps[/\\]*) return 1 ;;
  esac
  "${py}" -c "import sys" >/dev/null 2>&1
}

# After a python.org install, `py` often works even when `python` on PATH is the Store stub.
# This asks the launcher which interpreter it would use for Python 3.
_python_via_py_launcher() {
  command -v py >/dev/null 2>&1 || return 1
  local raw out
  raw="$(py -3 -c "import sys; print(sys.executable)" 2>/dev/null || true)"
  raw="${raw//$'\r'/}"
  raw="$(printf '%s' "${raw}" | tr -d '\r')"
  [[ -z "${raw}" ]] && return 1
  case "${raw}" in
    *[/\\]WindowsApps[/\\]*) return 1 ;;
  esac
  if [[ "${raw}" =~ ^[A-Za-z]: ]]; then
    if command -v cygpath >/dev/null 2>&1; then
      out="$(cygpath -u "${raw}" 2>/dev/null || true)"
    else
      local d r
      d="${raw:0:1}"
      r="${raw:2}"
      r="${r//\\//}"
      out="/${d,,}/${r}"
    fi
  else
    out="${raw}"
  fi
  [[ -n "${out}" ]] && _gcloud_python_usable "${out}" && printf '%s' "${out}"
}

_pick_cloudsdk_python() {
  local cands=()
  command -v python3 >/dev/null 2>&1 && cands+=("$(command -v python3)")
  command -v py >/dev/null 2>&1 && cands+=("$(command -v py)")
  [[ -x "/c/Windows/py.exe" ]] && cands+=("/c/Windows/py.exe")
  command -v python >/dev/null 2>&1 && cands+=("$(command -v python)")
  local c
  for c in "${cands[@]}"; do
    if _gcloud_python_usable "${c}"; then
      printf '%s' "${c}"
      return 0
    fi
  done
  return 1
}

# Git Bash often does not put python.org installs on PATH; probe default layout.
_probe_windows_python_org() {
  local py
  shopt -s nullglob
  local matches=(
    "${HOME}/AppData/Local/Programs/Python"/Python*/python.exe
  )
  # USERPROFILE is often set (sometimes C:\Users\... — normalize if cygpath exists).
  if [[ -n "${USERPROFILE:-}" ]]; then
    local up
    up="$(cygpath -u "${USERPROFILE}" 2>/dev/null)" || true
    [[ -n "${up}" ]] && matches+=("${up}/AppData/Local/Programs/Python"/Python*/python.exe)
  fi
  if [[ -n "${LOCALAPPDATA:-}" ]] && command -v cygpath >/dev/null 2>&1; then
    local la
    la="$(cygpath -u "${LOCALAPPDATA}" 2>/dev/null)" || true
    [[ -n "${la}" ]] && matches+=("${la}/Programs/Python"/Python*/python.exe)
  fi
  matches+=(
    "/c/Program Files"/Python*/python.exe
    "/c/Program Files (x86)"/Python*/python.exe
  )
  for py in "${matches[@]}"; do
    if [[ -f "${py}" ]] && _gcloud_python_usable "${py}"; then
      printf '%s' "${py}"
      shopt -u nullglob
      return 0
    fi
  done
  shopt -u nullglob
  return 1
}

if [[ -z "${CLOUDSDK_PYTHON:-}" ]]; then
  if picked="$(_python_via_py_launcher)"; then
    export CLOUDSDK_PYTHON="${picked}"
  fi
fi
if [[ -z "${CLOUDSDK_PYTHON:-}" ]]; then
  if picked="$(_pick_cloudsdk_python)"; then
    export CLOUDSDK_PYTHON="${picked}"
  fi
fi
if [[ -z "${CLOUDSDK_PYTHON:-}" ]]; then
  if picked="$(_probe_windows_python_org)"; then
    export CLOUDSDK_PYTHON="${picked}"
  fi
fi
if [[ -n "${CLOUDSDK_PYTHON:-}" ]]; then
  echo "Using Python for Google Cloud CLI: ${CLOUDSDK_PYTHON}"
fi
if [[ -z "${CLOUDSDK_PYTHON:-}" ]]; then
  echo "gcloud requires a working Python 3, but none passed a quick import test." >&2
  echo "The Microsoft Store stub under .../WindowsApps/ is ignored (not a real Python)." >&2
  echo "Install https://www.python.org/downloads/ (check 'Add python.exe to PATH')." >&2
  echo "Typical install (even if not on PATH): ~/AppData/Local/Programs/Python/Python3xx/python.exe" >&2
  echo "Or disable Store aliases: Settings → Apps → App execution aliases." >&2
  echo "Then:  export CLOUDSDK_PYTHON=/c/Users/YOU/AppData/Local/Programs/Python/Python312/python.exe" >&2
  exit 1
fi

echo ""
echo "=== MSGF — Cloud Build + Cloud Run deploy ==="
echo ""

# --- Project -----------------------------------------------------------------
if [[ -z "${GCP_PROJECT_ID// /}" ]]; then
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
if [[ -z "${IMAGE_TAG// /}" ]]; then
  IMAGE_TAG="$(git rev-parse --short HEAD 2>/dev/null || echo "manual-$(date +%s)")"
fi
IMAGE_URI="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${GCP_ARTIFACT_REPOSITORY}/${IMAGE_NAME}:${IMAGE_TAG}"

# --- Runtime env file (loaded BEFORE Cloud Build: Next.js inlines NEXT_PUBLIC_* at build time) ---
declare -A RUN_ENV=()
RUN_ENV[NODE_ENV]="production"
RUN_ENV[NEXT_TELEMETRY_DISABLED]="1"

if [[ -f "${CLOUDRUN_ENV_FILE}" ]]; then
  echo "Loading Cloud Run / build env from ${CLOUDRUN_ENV_FILE}"
  while IFS= read -r line || [[ -n "${line}" ]]; do
    line="${line//$'\r'/}"
    [[ "${line}" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line// /}" ]] && continue
    if [[ "${line}" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      k="${line%%=*}"
      v="${line#*=}"
      # Strip inline trailing comments: KEY=value  # note
      v="${v%%[[:space:]]#*}"
      v="${v%"${v##*[![:space:]]}"}"
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
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  NEXT_PUBLIC_AUTHOR_APP_URL
  NEXT_PUBLIC_EDUCATION_APP_URL
  NEXT_PUBLIC_MSGF_APP_URL
)
for key in "${ALLOWLIST_EXPORT_KEYS[@]}"; do
  eval "v=\${${key}-}"
  if [[ -n "${v}" ]]; then
    RUN_ENV["${key}"]="${v}"
  fi
done

# --- Build (Cloud Build: submit context + tag → Artifact Registry) ------------
echo ""
echo "Building and pushing: ${IMAGE_URI}"
echo "Context: ${SCRIPT_DIR}  Dockerfile: ${DOCKERFILE_PATH}"

run_cloud_build_default_dockerfile() {
  local supa_url="${RUN_ENV[NEXT_PUBLIC_SUPABASE_URL]:-}"
  local supa_key="${RUN_ENV[NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY]:-}"
  local author_url="${RUN_ENV[NEXT_PUBLIC_AUTHOR_APP_URL]:-}"
  local education_url="${RUN_ENV[NEXT_PUBLIC_EDUCATION_APP_URL]:-}"
  local msgf_url="${RUN_ENV[NEXT_PUBLIC_MSGF_APP_URL]:-}"
  if [[ -z "${supa_url}" || -z "${supa_key}" ]]; then
    echo "" >&2
    echo "Error: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set" >&2
    echo "  in ${CLOUDRUN_ENV_FILE} (or exported in the shell) before ./setup-cloud.sh runs." >&2
    echo "  Next.js bakes these into the browser bundle at \`npm run build\` time — setting them" >&2
    echo "  only on Cloud Run at runtime is not enough; the Docker build must receive them as" >&2
    echo "  \`--build-arg\` (this script does that automatically when the keys exist in ${CLOUDRUN_ENV_FILE})." >&2
    echo "  Dashboard: https://supabase.com/dashboard/project/_/settings/api" >&2
    echo "" >&2
    exit 1
  fi

  local cb_tmp
  cb_tmp="$(mktemp "${TMPDIR:-/tmp}/msgf-cloudbuild.XXXXXX")"
  trap "rm -f '${cb_tmp}'" EXIT
  cat >"${cb_tmp}" <<EOF
steps:
  - name: gcr.io/cloud-builders/docker
    args:
      - build
      - -f
      - Dockerfile
      - -t
      - ${IMAGE_URI}
      - --build-arg
      - NEXT_PUBLIC_SUPABASE_URL=${supa_url}
      - --build-arg
      - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${supa_key}
      - --build-arg
      - NEXT_PUBLIC_AUTHOR_APP_URL=${author_url}
      - --build-arg
      - NEXT_PUBLIC_EDUCATION_APP_URL=${education_url}
      - --build-arg
      - NEXT_PUBLIC_MSGF_APP_URL=${msgf_url}
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

run_cloud_build_custom_dockerfile() {
  local cb_tmp
  local supa_url="${RUN_ENV[NEXT_PUBLIC_SUPABASE_URL]:-}"
  local supa_key="${RUN_ENV[NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY]:-}"
  local author_url="${RUN_ENV[NEXT_PUBLIC_AUTHOR_APP_URL]:-}"
  local education_url="${RUN_ENV[NEXT_PUBLIC_EDUCATION_APP_URL]:-}"
  local msgf_url="${RUN_ENV[NEXT_PUBLIC_MSGF_APP_URL]:-}"
  cb_tmp="$(mktemp "${TMPDIR:-/tmp}/msgf-cloudbuild.XXXXXX")"
  trap "rm -f '${cb_tmp}'" EXIT
  if [[ -n "${supa_url}" && -n "${supa_key}" ]]; then
    cat >"${cb_tmp}" <<EOF
steps:
  - name: gcr.io/cloud-builders/docker
    args:
      - build
      - -f
      - ${DOCKERFILE_PATH}
      - -t
      - ${IMAGE_URI}
      - --build-arg
      - NEXT_PUBLIC_SUPABASE_URL=${supa_url}
      - --build-arg
      - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${supa_key}
      - --build-arg
      - NEXT_PUBLIC_AUTHOR_APP_URL=${author_url}
      - --build-arg
      - NEXT_PUBLIC_EDUCATION_APP_URL=${education_url}
      - --build-arg
      - NEXT_PUBLIC_MSGF_APP_URL=${msgf_url}
      - .
images:
  - ${IMAGE_URI}
EOF
  else
    echo "Warning: NEXT_PUBLIC_SUPABASE_* not set — custom Dockerfile build may produce a broken browser bundle." >&2
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
  fi
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

# --- Cloud Run deploy env string (RUN_ENV already populated above) ------------
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
