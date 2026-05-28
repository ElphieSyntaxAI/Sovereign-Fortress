#!/usr/bin/env bash
set -euo pipefail

# Map custom domains to Cloud Run services (requires domain verified in Google Cloud).
# Loads MSGF_DOMAIN / AUTHOR_* from .env.cloudrun when present.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

GCP_PROJECT_ID="${GCP_PROJECT_ID:-}"
GCP_REGION="${GCP_REGION:-us-central1}"
CLOUDRUN_ENV_FILE="${CLOUDRUN_ENV_FILE:-.env.cloudrun}"

MSGF_SERVICE="${MSGF_SERVICE:-msgf-api}"
AUTHOR_BFF_SERVICE="${AUTHOR_BFF_SERVICE:-author-bff}"
AUTHOR_CLIENT_SERVICE="${AUTHOR_CLIENT_SERVICE:-author-client}"

MSGF_DOMAIN="${MSGF_DOMAIN:-elphiesgatedai.elphiesyntax.com}"
AUTHOR_CLIENT_DOMAIN="${AUTHOR_CLIENT_DOMAIN:-authorecosystem.elphiesyntax.com}"
AUTHOR_BFF_DOMAIN="${AUTHOR_BFF_DOMAIN:-api.authorecosystem.elphiesyntax.com}"
# Platform hub ("What are you looking for?") — same author-client service, apex DNS only.
AUTHOR_APEX_DOMAIN="${AUTHOR_APEX_DOMAIN:-elphiesyntax.com}"
AUTHOR_APEX_WWW_DOMAIN="${AUTHOR_APEX_WWW_DOMAIN:-www.elphiesyntax.com}"

if [[ -f "${CLOUDRUN_ENV_FILE}" ]]; then
  while IFS= read -r line || [[ -n "${line}" ]]; do
    line="${line//$'\r'/}"
    [[ "${line}" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] || continue
    k="${line%%=*}"
    v="${line#*=}"
    v="${v%%[[:space:]]#*}"
    printf -v "${k}" '%s' "${v}"
  done <"${CLOUDRUN_ENV_FILE}"
fi

[[ -n "${GCP_PROJECT_ID}" ]] || GCP_PROJECT_ID="$(gcloud config get-value project 2>/dev/null || true)"
[[ -n "${GCP_PROJECT_ID}" && "${GCP_PROJECT_ID}" != "(unset)" ]] || {
  echo "Set GCP_PROJECT_ID or gcloud config project." >&2
  exit 1
}

_map_one() {
  local domain="$1"
  local service="$2"
  echo ""
  echo "Mapping ${domain} → ${service} (${GCP_REGION})"
  if gcloud run domain-mappings describe --domain="${domain}" \
    --region="${GCP_REGION}" --project="${GCP_PROJECT_ID}" --quiet 2>/dev/null; then
    echo "  Already mapped."
    return 0
  fi
  gcloud run domain-mappings create \
    --domain="${domain}" \
    --service="${service}" \
    --region="${GCP_REGION}" \
    --project="${GCP_PROJECT_ID}" \
    --quiet
  echo "  Created. Add DNS records shown by:"
  echo "  gcloud run domain-mappings describe --domain=${domain} --region=${GCP_REGION}"
}

if ! gcloud auth print-access-token >/dev/null 2>&1; then
  gcloud auth login
fi

echo "=== Cloud Run domain mappings ==="
echo "Project: ${GCP_PROJECT_ID}"

_map_one "${MSGF_DOMAIN}" "${MSGF_SERVICE}"
_map_one "${AUTHOR_CLIENT_DOMAIN}" "${AUTHOR_CLIENT_SERVICE}"
_map_one "${AUTHOR_BFF_DOMAIN}" "${AUTHOR_BFF_SERVICE}"
if [[ -n "${AUTHOR_APEX_DOMAIN}" ]]; then
  _map_one "${AUTHOR_APEX_DOMAIN}" "${AUTHOR_CLIENT_SERVICE}"
fi
if [[ -n "${AUTHOR_APEX_WWW_DOMAIN}" ]]; then
  _map_one "${AUTHOR_APEX_WWW_DOMAIN}" "${AUTHOR_CLIENT_SERVICE}"
fi

echo ""
echo "=== DNS checklist (at your registrar) ==="
echo "For each mapping, run describe and create CNAME/AAAA as instructed."
echo "  ${MSGF_DOMAIN}           → ${MSGF_SERVICE}"
echo "  ${AUTHOR_CLIENT_DOMAIN}  → ${AUTHOR_CLIENT_SERVICE}"
echo "  ${AUTHOR_BFF_DOMAIN}     → ${AUTHOR_BFF_SERVICE}"
if [[ -n "${AUTHOR_APEX_DOMAIN}" ]]; then
  echo "  ${AUTHOR_APEX_DOMAIN}        → ${AUTHOR_CLIENT_SERVICE} (platform hub)"
fi
if [[ -n "${AUTHOR_APEX_WWW_DOMAIN}" ]]; then
  echo "  ${AUTHOR_APEX_WWW_DOMAIN}    → ${AUTHOR_CLIENT_SERVICE} (platform hub)"
fi
echo ""
echo "Apex hub: remove Squarespace parking DNS for ${AUTHOR_APEX_DOMAIN:-elphiesyntax.com}"
echo "before Cloud Run mapping can serve the picker."
echo ""
echo "Supabase → Authentication → URL configuration:"
echo "  Site URL: https://${MSGF_DOMAIN}"
echo "  Redirects: https://${MSGF_DOMAIN}/auth/callback"
echo "             https://${AUTHOR_CLIENT_DOMAIN}/auth/callback"
