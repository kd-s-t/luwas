import type { HazardReport } from "@/lib/reports/types";

const FINAL = new Set(["legit", "rejected", "needs_review"]);

/**
 * Fire-and-forget client sync after Firestore validation write.
 * Server upserts into BigQuery when configured; never blocks the UI.
 */
export function syncHazardReportToBigQuery(
  report: Pick<
    HazardReport,
    | "id"
    | "status"
    | "aiVerdict"
    | "hazardHint"
    | "barangay"
    | "lgu"
    | "citizenPurok"
    | "lat"
    | "lng"
    | "trustScore"
    | "vertexClass"
    | "vertexConfidence"
    | "aiConfidence"
    | "aiSource"
    | "aiModel"
    | "mediaUrl"
    | "mediaPath"
    | "mediaType"
    | "title"
    | "validatedAt"
    | "createdAt"
    | "citizenName"
    | "citizenUid"
    | "notes"
  >,
): void {
  if (!FINAL.has(report.status)) return;
  void fetch("/api/reports/bigquery-sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ report }),
  }).catch((err) => {
    console.warn("[bigquery-sync] client request failed", err);
  });
}
