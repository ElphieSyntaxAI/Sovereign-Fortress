#!/usr/bin/env bash
set -euo pipefail

# Full production path: validate → MSGF → Author → domain mappings.
# Requires: .env.cloudrun (copy from env.cloudrun.example), gcloud auth, Supabase keys.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

SKIP_VALIDATE="${SKIP_VALIDATE:-0}"
SKIP_MSGF="${SKIP_MSGF:-0}"
SKIP_AUTHOR="${SKIP_AUTHOR:-0}"
SKIP_DOMAINS="${SKIP_DOMAINS:-0}"

if [[ ! -f ".env.cloudrun" ]]; then
  echo "Missing .env.cloudrun — copy env.cloudrun.example and fill secrets." >&2
  exit 1
fi

if [[ "${SKIP_VALIDATE}" != "1" ]]; then
  echo "=== Pre-deploy validation ==="
  npm run validate:deployment
  npm run test:author
fi

if [[ "${SKIP_MSGF}" != "1" ]]; then
  echo ""
  echo "=== Deploy MSGF (elphiesgatedai) ==="
  ./setup-cloud.sh
fi

if [[ "${SKIP_AUTHOR}" != "1" ]]; then
  echo ""
  echo "=== Deploy Author (authorecosystem + BFF) ==="
  ./setup-author-cloud.sh
fi

if [[ "${SKIP_DOMAINS}" != "1" ]]; then
  echo ""
  echo "=== Map custom domains ==="
  ./map-product-domains.sh
fi

echo ""
echo "=== Post-deploy smoke ==="
echo "  curl -sI https://elphiesgatedai.elphiesyntax.com/api/health"
echo "  curl -sI https://authorecosystem.elphiesyntax.com"
echo "  curl -sI https://api.authorecosystem.elphiesyntax.com/api/ping"
echo "  npm run verify:bff-env --prefix apps/author-ecosystem/server  # against production .env if configured"
