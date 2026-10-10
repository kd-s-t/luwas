#!/usr/bin/env bash
# Provision Luwas Firebase / Firestore via Terraform (Spark-friendly).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# Prefer workspace gcloud if present
if [[ -x "$ROOT/.tools/google-cloud-sdk/bin/gcloud" ]]; then
  export PATH="$ROOT/.tools/google-cloud-sdk/bin:$PATH"
  export CLOUDSDK_CONFIG="${CLOUDSDK_CONFIG:-$ROOT/.tools/gcloud-config}"
fi

if ! command -v terraform >/dev/null; then
  echo "terraform not found — install from https://developer.hashicorp.com/terraform/install"
  exit 1
fi

if ! command -v gcloud >/dev/null; then
  echo "gcloud not found — install Google Cloud SDK, then re-run."
  exit 1
fi

if [[ ! -f terraform.tfvars ]]; then
  cp terraform.tfvars.example terraform.tfvars
  echo "Created terraform.tfvars — edit project_id if needed, then re-run."
  exit 1
fi

echo "==> Checking Google auth"
if ! gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | grep -q .; then
  echo "No active gcloud account. Opening browser login…"
  gcloud auth login
fi

if [[ ! -f "${CLOUDSDK_CONFIG:-$HOME/.config/gcloud}/application_default_credentials.json" ]] \
  && [[ ! -f "$HOME/.config/gcloud/application_default_credentials.json" ]]; then
  echo "Application Default Credentials missing (needed by Terraform)…"
  gcloud auth application-default login
fi

echo "==> terraform init"
terraform init -upgrade

echo "==> terraform plan"
terraform plan -out=tfplan

echo "==> terraform apply"
terraform apply tfplan
rm -f tfplan

echo
echo "==> Done. Next.js env hint:"
terraform output -raw next_env_hint
echo
echo "Then enable Email/Password in Firebase Auth console, and deploy rules:"
echo "  firebase deploy --only firestore"
