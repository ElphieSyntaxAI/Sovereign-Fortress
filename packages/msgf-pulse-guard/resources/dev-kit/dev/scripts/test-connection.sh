#!/usr/bin/env bash
# MSGF connectivity probe — MSGF_API_URL, MSGF_AUTH_TOKEN, MSGF_TENANT_KEY or dev/env.local.json
set -euo pipefail

KIT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$KIT_ROOT/dev/env.local.json"

if [[ -f "$ENV_FILE" ]]; then
  MSGF_API_URL="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$ENV_FILE','utf8')).MSGF_API_URL||'')")"
  MSGF_AUTH_TOKEN="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$ENV_FILE','utf8')).MSGF_AUTH_TOKEN||'')")"
  MSGF_TENANT_KEY="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$ENV_FILE','utf8')).MSGF_TENANT_KEY||'')")"
  export MSGF_API_URL MSGF_AUTH_TOKEN MSGF_TENANT_KEY
fi

BASE="${MSGF_API_URL%/}"
TOKEN="${MSGF_AUTH_TOKEN:-}"
TENANT="${MSGF_TENANT_KEY:-}"

if [[ -z "$BASE" || -z "$TOKEN" || -z "$TENANT" ]]; then
  echo "[MSGF] Set MSGF_API_URL, MSGF_AUTH_TOKEN, MSGF_TENANT_KEY or create dev/env.local.json"
  exit 1
fi

URL="$BASE/api/msgf/ide/connectivity-check"
echo "[MSGF] GET $URL"
curl -sS -w "\n[MSGF] HTTP %{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-MSGF-Tenant-Key: $TENANT" \
  -H "x-msgf-tenant-id: $TENANT" \
  "$URL"
