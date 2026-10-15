#!/usr/bin/env bash
# Create/update Cloud Scheduler → BigQuery Vertex labels export.
# Requires: CRON_SECRET, gcloud auth, Cloud Scheduler API enabled.
set -euo pipefail

PROJECT="${GCP_PROJECT:-nice-pen-181017}"
LOCATION="${SCHEDULER_LOCATION:-asia-southeast1}"
JOB_NAME="${SCHEDULER_JOB:-luwas-vertex-ingest-export}"
# 02:00 Asia/Manila on the 1st of each month
SCHEDULE="${SCHEDULER_CRON:-0 2 1 * *}"
TIME_ZONE="${SCHEDULER_TZ:-Asia/Manila}"
URI="${SCHEDULER_URI:-https://luwasph.com/api/cron/vertex-ingest-export}"

if [[ -z "${CRON_SECRET:-}" ]]; then
  echo "Set CRON_SECRET (same value as Cloud Run / App Hosting)." >&2
  exit 1
fi

gcloud services enable cloudscheduler.googleapis.com --project="$PROJECT"

if gcloud scheduler jobs describe "$JOB_NAME" --location="$LOCATION" --project="$PROJECT" >/dev/null 2>&1; then
  gcloud scheduler jobs update http "$JOB_NAME" \
    --project="$PROJECT" \
    --location="$LOCATION" \
    --schedule="$SCHEDULE" \
    --time-zone="$TIME_ZONE" \
    --uri="$URI" \
    --http-method=POST \
    --headers="Authorization=Bearer ${CRON_SECRET},Content-Type=application/json" \
    --attempt-deadline=180s
  echo "Updated scheduler job: $JOB_NAME"
else
  gcloud scheduler jobs create http "$JOB_NAME" \
    --project="$PROJECT" \
    --location="$LOCATION" \
    --schedule="$SCHEDULE" \
    --time-zone="$TIME_ZONE" \
    --uri="$URI" \
    --http-method=POST \
    --headers="Authorization=Bearer ${CRON_SECRET},Content-Type=application/json" \
    --attempt-deadline=180s
  echo "Created scheduler job: $JOB_NAME"
fi

echo "URI: $URI"
echo "Schedule: $SCHEDULE ($TIME_ZONE)"
