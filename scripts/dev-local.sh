#!/usr/bin/env bash
# One-shot local run: Firebase emulators + Next.js
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

EMU_PID=""
WEB_PID=""
cleanup() {
  [[ -n "$EMU_PID" ]] && kill "$EMU_PID" 2>/dev/null || true
  [[ -n "$WEB_PID" ]] && kill "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

npm run emulators &
EMU_PID=$!

# Wait until Emulator UI answers (or give up after ~60s)
for _ in $(seq 1 60); do
  if curl -sf -o /dev/null "http://127.0.0.1:4000/"; then
    break
  fi
  sleep 1
done

npm run dev &
WEB_PID=$!

wait "$EMU_PID" "$WEB_PID"
