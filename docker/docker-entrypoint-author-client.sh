#!/bin/sh
set -eu

UPSTREAM="${AUTHOR_BFF_UPSTREAM:-https://author-bff-bkracxai6q-uc.a.run.app}"
UPSTREAM="${UPSTREAM%/}"
export AUTHOR_BFF_UPSTREAM="${UPSTREAM}"

# Host header the BFF expects (Cloud Run default hostname).
case "${UPSTREAM}" in
  https://*) export AUTHOR_BFF_PROXY_HOST="${UPSTREAM#https://}" ;;
  http://*) export AUTHOR_BFF_PROXY_HOST="${UPSTREAM#http://}" ;;
  *) export AUTHOR_BFF_PROXY_HOST="${UPSTREAM}" ;;
esac

envsubst '${AUTHOR_BFF_UPSTREAM} ${AUTHOR_BFF_PROXY_HOST}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
