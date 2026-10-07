#!/usr/bin/env bash
# Push local firestore.rules into a running Firestore emulator (no restart).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="${FIREBASE_PROJECT:-demo-dro}"
HOST="${FIRESTORE_EMULATOR_HOST:-127.0.0.1:8080}"

python3 - <<PY
import json, pathlib, urllib.request
rules = pathlib.Path("$ROOT/firestore.rules").read_text()
body = json.dumps({"rules": {"files": [{"content": rules}]}}).encode()
req = urllib.request.Request(
    f"http://$HOST/emulator/v1/projects/$PROJECT:securityRules",
    data=body,
    headers={"Content-Type": "application/json"},
    method="PUT",
)
with urllib.request.urlopen(req) as res:
    print(res.read().decode() or "ok")
print("Reloaded firestore.rules → $HOST ($PROJECT)")
PY
