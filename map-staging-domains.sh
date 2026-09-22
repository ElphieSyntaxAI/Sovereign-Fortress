#!/usr/bin/env bash
set -euo pipefail

# Map staging subdomains only. Never remap production apex.
# Fully managed Cloud Run mappings use the domains.cloudrun.com REST API
# (`gcloud run domain-mappings` without beta is Anthos-only).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

GCP_PROJECT_ID="${GCP_PROJECT_ID:-}"
GCP_REGION="${GCP_REGION:-us-central1}"
CLOUDRUN_ENV_FILE="${CLOUDRUN_ENV_FILE:-.env.cloudrun.staging}"
DNS_ZONE_SUFFIX="${DNS_ZONE_SUFFIX:-.elphiesyntax.com}"

MSGF_SERVICE="${MSGF_SERVICE:-msgf-api-staging}"
AUTHOR_BFF_SERVICE="${AUTHOR_BFF_SERVICE:-author-bff-staging}"
AUTHOR_CLIENT_SERVICE="${AUTHOR_CLIENT_SERVICE:-author-client-staging}"

MSGF_DOMAIN="${MSGF_DOMAIN:-staging.elphiesgatedai.elphiesyntax.com}"
AUTHOR_CLIENT_DOMAIN="${AUTHOR_CLIENT_DOMAIN:-staging.authorecosystem.elphiesyntax.com}"
AUTHOR_BFF_DOMAIN="${AUTHOR_BFF_DOMAIN:-staging-api.authorecosystem.elphiesyntax.com}"

if [[ -f "${CLOUDRUN_ENV_FILE}" ]]; then
  while IFS= read -r line || [[ -n "${line}" ]]; do
    line="${line//$'\r'/}"
    [[ "${line}" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] || continue
    k="${line%%=*}"
    v="${line#*=}"
    case "${k}" in
      GCP_PROJECT_ID|GCP_REGION|MSGF_SERVICE|AUTHOR_BFF_SERVICE|AUTHOR_CLIENT_SERVICE|MSGF_DOMAIN|AUTHOR_CLIENT_DOMAIN|AUTHOR_BFF_DOMAIN)
        printf -v "${k}" '%s' "${v}"
        ;;
    esac
  done <"${CLOUDRUN_ENV_FILE}"
fi

[[ -n "${GCP_PROJECT_ID}" ]] || GCP_PROJECT_ID="$(gcloud config get-value project 2>/dev/null || true)"
[[ -n "${GCP_PROJECT_ID}" && "${GCP_PROJECT_ID}" != "(unset)" ]] || {
  echo "Set GCP_PROJECT_ID or gcloud config project." >&2
  exit 1
}

_dm_url() {
  local path="${1:-}"
  echo "https://${GCP_REGION}-run.googleapis.com/apis/domains.cloudrun.com/v1/namespaces/${GCP_PROJECT_ID}/domainmappings${path}"
}

_dm_get() {
  local domain="$1"
  curl -sS -H "Authorization: Bearer ${TOKEN}" \
    "$(_dm_url "/${domain}")"
}

_dns_host() {
  local domain="$1"
  local suffix="${DNS_ZONE_SUFFIX}"
  if [[ "${domain}" == *"${suffix}" ]]; then
    echo "${domain%"${suffix}"}"
  else
    echo "${domain}"
  fi
}

_map_one() {
  local domain="$1"
  local service="$2"
  echo ""
  echo "Mapping ${domain} → ${service} (${GCP_REGION})"
  if [[ "${domain}" == "elphiesyntax.com" || "${domain}" == "www.elphiesyntax.com" || "${domain}" == "elphiesgatedai.elphiesyntax.com" || "${domain}" == "authorecosystem.elphiesyntax.com" ]]; then
    echo "  REFUSED: that host is production. Staging mapper will not touch it." >&2
    exit 1
  fi

  local existing
  existing="$(_dm_get "${domain}" || true)"
  if echo "${existing}" | grep -q '"kind": "DomainMapping"'; then
    echo "  Already mapped."
    return 0
  fi

  local code
  code="$(curl -sS -o /tmp/elphie-dm-create.json -w '%{http_code}' \
    -X POST \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    "$(_dm_url "")" \
    -d "{\"apiVersion\":\"domains.cloudrun.com/v1\",\"kind\":\"DomainMapping\",\"metadata\":{\"name\":\"${domain}\"},\"spec\":{\"routeName\":\"${service}\",\"certificateMode\":\"AUTOMATIC\"}}")"
  if [[ "${code}" != "200" && "${code}" != "201" ]]; then
    echo "  Create failed HTTP ${code}:" >&2
    cat /tmp/elphie-dm-create.json >&2
    exit 1
  fi
  echo "  Created."
}

if ! TOKEN="$(gcloud auth print-access-token 2>/dev/null)"; then
  echo "gcloud auth is expired. Run: gcloud auth login" >&2
  exit 1
fi

echo "=== Staging Cloud Run domain mappings ==="
echo "Project: ${GCP_PROJECT_ID}"

_map_one "${MSGF_DOMAIN}" "${MSGF_SERVICE}"
_map_one "${AUTHOR_CLIENT_DOMAIN}" "${AUTHOR_CLIENT_SERVICE}"
_map_one "${AUTHOR_BFF_DOMAIN}" "${AUTHOR_BFF_SERVICE}"

echo ""
echo "=== DNS (Squarespace / zone elphiesyntax.com) ==="
echo "  Host                              Type   Value"
echo "  $(_dns_host "${MSGF_DOMAIN}")     CNAME  ghs.googlehosted.com."
echo "  $(_dns_host "${AUTHOR_CLIENT_DOMAIN}")  CNAME  ghs.googlehosted.com."
echo "  $(_dns_host "${AUTHOR_BFF_DOMAIN}") CNAME  ghs.googlehosted.com."
echo ""
echo "Staging Supabase → Authentication → URL configuration:"
echo "  Site URL: https://${MSGF_DOMAIN}"
echo "  Redirects: https://${MSGF_DOMAIN}/auth/callback"
echo "             https://${AUTHOR_CLIENT_DOMAIN}/auth/callback"
echo ""
echo "Until those CNAMEs exist, use the Cloud Run URL:"
echo "  https://msgf-api-staging-504003558298.us-central1.run.app"
