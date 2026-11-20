#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
pids=()
cleanup(){ for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done; }
trap cleanup EXIT
export VERCEL_ENV=production UHL_WAVE1_RELEASE_BUILD=1 NEXT_PUBLIC_UHL_WAVE1=1 NEXT_PUBLIC_UHL_PL=1 NEXT_PUBLIC_UHL_IT=1 NEXT_PUBLIC_UHL_ES=1 NEXT_PUBLIC_UHL_CS=1
export NEXT_PUBLIC_SUPABASE_URL=https://build-fixture.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=build-fixture SUPABASE_SERVICE_ROLE_KEY=test-only RESEND_API_KEY=re_placeholder
export NEXT_TELEMETRY_DISABLED=1
if [[ "${UHL_USE_EXISTING_BUILD:-0}" != 1 ]]; then
  UHL_FIXTURE_NETWORK=1 NODE_OPTIONS="--require=$PWD/tests/browser/release-fixture.cjs" npm run build
fi
for spec in '55826 2026' '55827 2027'; do
  read -r port season <<< "$spec"
  UHL_FIXTURE_SERVER=1 UHL_FIXTURE_YEAR="$season" NODE_OPTIONS="--require=$PWD/tests/browser/release-fixture.cjs" \
    node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port "$port" &
  pids+=("$!")
done
for port in 55826 55827; do
  for attempt in {1..20}; do
    if curl --silent --fail "http://127.0.0.1:$port/de" >/dev/null; then break; fi
    sleep 1
  done
  curl --silent --fail "http://127.0.0.1:$port/de" >/dev/null
done
node tests/browser/release-smoke.cjs
