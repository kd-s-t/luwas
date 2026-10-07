#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${JAVA_HOME:-}" || ! -x "${JAVA_HOME}/bin/java" ]]; then
  if [[ -x "$ROOT/.tools/jdk-21/bin/java" ]]; then
    export JAVA_HOME="$ROOT/.tools/jdk-21"
  fi
fi

if [[ -z "${JAVA_HOME:-}" || ! -x "${JAVA_HOME}/bin/java" ]]; then
  echo "Java 21+ required for Firebase emulators."
  echo "Expected: $ROOT/.tools/jdk-21  (or set JAVA_HOME)"
  echo "Without emulators, the app returns auth/network-request-failed."
  exit 1
fi

export PATH="$JAVA_HOME/bin:$PATH"
echo "Using JAVA_HOME=$JAVA_HOME"
echo "Auth emulator: http://127.0.0.1:9099"
echo "Emulator UI:   http://127.0.0.1:4000"
exec npx firebase emulators:start --project demo-dro "$@"
