#!/usr/bin/env bash
# BFF + Vite + Supabase health orchestration (no legacy Express).
# Usage: ./test-run.sh          # start BFF + Vite, then watch health until Ctrl+C
#        ./test-run.sh --once  # single health pass (no servers), exit non-zero if any check fails
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

ONCE=false
for arg in "$@"; do
  if [[ "$arg" == "--once" ]]; then ONCE=true; fi
done

# Load monorepo env (must be valid shell assignments; quote values with spaces).
load_env() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  set -a
  # shellcheck disable=SC1090
  source "$f"
  set +a
}
load_env "$ROOT/.env"
load_env "$ROOT/.env.local"

BFF_PORT="${PORT:-3002}"
VITE_PORT="${VITE_DEV_PORT:-5173}"
# PostgREST table that should exist after MSGF / credit-guard migrations (empty = skip REST probe).
SUPABASE_MIGRATION_PROBE_TABLE="${SUPABASE_MIGRATION_PROBE_TABLE:-usage_monitor}"

SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-${SUPABASE_URL:-}}"
SUPABASE_ANON="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-${SUPABASE_ANON_KEY:-${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-}}}"

RED=$'\033[0;31m'
BOLD=$'\033[1m'
RST=$'\033[0m'

PIDS=()

alert() {
  printf '%b\n' "${RED}${BOLD}▶ TRINITY ALERT:${RST} $*" >&2
  if command -v notify-send >/dev/null 2>&1; then
    notify-send -u critical "Trinity / Supabase" "$*" 2>/dev/null || true
  fi
}

cleanup() {
  local pid
  for pid in "${PIDS[@]:-}"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
}
trap cleanup EXIT INT TERM

curl_ok() {
  local url="$1"
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 2 --max-time 5 "$url" 2>/dev/null || echo 000)"
  [[ "$code" =~ ^2 ]]
}

check_bff() { curl_ok "http://127.0.0.1:${BFF_PORT}/api/ping"; }
check_vite() { curl_ok "http://127.0.0.1:${VITE_PORT}/"; }

check_supabase_auth_health() {
  [[ -n "$SUPABASE_URL" ]] || return 1
  local base="${SUPABASE_URL%/}"
  curl_ok "${base}/auth/v1/health"
}

check_supabase_migrations() {
  [[ -n "$SUPABASE_URL" ]] || return 1
  [[ -n "$SUPABASE_ANON" ]] || return 1
  [[ -n "$SUPABASE_MIGRATION_PROBE_TABLE" ]] || return 0
  local base="${SUPABASE_URL%/}"
  # usage_monitor uses user_id; override table/column via SUPABASE_MIGRATION_PROBE_SELECT if needed.
  local sel="${SUPABASE_MIGRATION_PROBE_SELECT:-user_id}"
  local url="${base}/rest/v1/${SUPABASE_MIGRATION_PROBE_TABLE}?select=${sel}&limit=0"
  local code
  code="$(
    curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 3 --max-time 10 \
      -H "apikey: ${SUPABASE_ANON}" \
      -H "Authorization: Bearer ${SUPABASE_ANON}" \
      -H "Accept: application/json" \
      "$url" 2>/dev/null || echo 000
  )"
  # 200 = table exists (possibly empty). 404 = unknown relation / migrations not applied.
  [[ "$code" == "200" ]]
}

LAST_FAILURE_MSG=""

run_all_checks() {
  LAST_FAILURE_MSG=""
  local failed=0
  local msgs=()
  if ! check_bff; then msgs+=("BFF :${BFF_PORT}/api/ping"); failed=1; fi
  if ! check_vite; then msgs+=("Vite :${VITE_PORT}/"); failed=1; fi
  if [[ -z "$SUPABASE_URL" ]]; then
    msgs+=("Supabase URL unset")
    failed=1
  else
    if ! check_supabase_auth_health; then
      msgs+=("Supabase Auth /auth/v1/health")
      failed=1
    fi
    if [[ -n "$SUPABASE_MIGRATION_PROBE_TABLE" ]]; then
      if [[ -z "$SUPABASE_ANON" ]]; then
        msgs+=("Supabase anon key unset (cannot probe REST migrations)")
        failed=1
      elif ! check_supabase_migrations; then
        msgs+=("REST table '${SUPABASE_MIGRATION_PROBE_TABLE}' (migrations / RLS / column)")
        failed=1
      fi
    fi
  fi
  if [[ "$failed" -ne 0 ]]; then
    LAST_FAILURE_MSG="${msgs[*]}"
    return 1
  fi
  return 0
}

if [[ "$ONCE" == true ]]; then
  if ! run_all_checks; then
    alert "Trinity / Supabase down — ${LAST_FAILURE_MSG}"
    printf '\a' >&2
    exit 1
  fi
  exit 0
fi

echo "[test-run] Starting BFF on port ${BFF_PORT}..."
(
  cd "$ROOT/apps/author-ecosystem/server"
  export PORT="$BFF_PORT"
  exec npm run dev
) &
PIDS+=("$!")

echo "[test-run] Starting Vite (author-ecosystem client) on port ${VITE_PORT}..."
(
  cd "$ROOT/apps/author-ecosystem/client"
  exec npm run dev -- --port "$VITE_PORT" --strictPort
) &
PIDS+=("$!")

echo "[test-run] Waiting for services to listen..."
sleep 6

INTERVAL="${TRINITY_HEALTH_INTERVAL_SEC:-8}"
echo "[test-run] Health loop every ${INTERVAL}s (Ctrl+C to stop all)."

ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
prev_failed=0
while true; do
  if run_all_checks; then
    if [[ "$prev_failed" -ne 0 ]]; then
      printf '[test-run] %s — recovered (all checks OK)\n' "$(ts)"
    else
      printf '[test-run] %s — BFF, Vite, Supabase: OK\n' "$(ts)"
    fi
    prev_failed=0
  else
    if [[ "$prev_failed" -eq 0 ]]; then
      alert "Trinity / Supabase down — ${LAST_FAILURE_MSG}"
      printf '\a' >&2
    else
      printf '[test-run] %s — still failing (%s)\n' "$(ts)" "${LAST_FAILURE_MSG}" >&2
    fi
    prev_failed=1
  fi
  sleep "$INTERVAL"
done
