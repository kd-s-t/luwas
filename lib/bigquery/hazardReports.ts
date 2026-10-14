import { BigQuery } from "@google-cloud/bigquery";
import {
  bigQueryConfig,
  bigQueryTableId,
  type BigQueryConfig,
} from "@/lib/bigquery/config";
import {
  hazardToVertexClass,
  type VertexVisionClass,
} from "@/lib/reports/vertexExport";
import type { HazardReport, ReportStatus } from "@/lib/reports/types";

const FINAL_STATUSES = new Set<ReportStatus>([
  "legit",
  "rejected",
  "needs_review",
]);

export type HazardReportBqRow = {
  report_id: string;
  gcs_uri: string | null;
  label: VertexVisionClass | string;
  status: string;
  ai_verdict: string | null;
  hazard_hint: string;
  barangay: string;
  lgu: string;
  citizen_purok: string;
  lat: number | null;
  lng: number | null;
  trust_score: number | null;
  vertex_class: string | null;
  vertex_confidence: number | null;
  ai_confidence: number | null;
  ai_source: string | null;
  ai_model: string | null;
  media_url: string;
  media_path: string;
  media_type: string;
  title: string;
  validated_at: string | null;
  created_at: string;
  synced_at: string;
};

let client: BigQuery | null = null;
let ensurePromise: Promise<void> | null = null;

function getClient(cfg: BigQueryConfig): BigQuery {
  if (!client) {
    client = new BigQuery({ projectId: cfg.projectId });
  }
  return client;
}

export function isFinalVerdictStatus(status: ReportStatus): boolean {
  return FINAL_STATUSES.has(status);
}

/** Firebase Storage object path → gs:// URI for Vertex CSV. */
export function reportGcsUri(report: Pick<HazardReport, "mediaPath">): string | null {
  const path = (report.mediaPath || "").trim();
  if (!path) return null;
  if (path.startsWith("gs://")) return path;
  // Emulator / public demo paths are not GCS training assets.
  if (path.startsWith("/") || path.startsWith("http://") || path.startsWith("https://")) {
    return null;
  }
  const bucket =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ||
    process.env.FIREBASE_STORAGE_BUCKET?.trim() ||
    "";
  if (!bucket || bucket.includes("demo-dro")) return null;
  return `gs://${bucket}/${path.replace(/^\//, "")}`;
}

export function trainingLabel(report: HazardReport): string {
  if (report.vertexClass?.trim()) return report.vertexClass.trim();
  if (report.status === "rejected" || report.aiVerdict === "rejected") {
    return "unrelated";
  }
  return hazardToVertexClass(report.hazardHint);
}

export function hazardReportToBqRow(report: HazardReport): HazardReportBqRow {
  const now = new Date().toISOString();
  return {
    report_id: report.id,
    gcs_uri: reportGcsUri(report),
    label: trainingLabel(report),
    status: report.status,
    ai_verdict: report.aiVerdict,
    hazard_hint: report.hazardHint,
    barangay: report.barangay,
    lgu: report.lgu,
    citizen_purok: report.citizenPurok,
    lat: report.lat,
    lng: report.lng,
    trust_score: report.trustScore,
    vertex_class: report.vertexClass,
    vertex_confidence: report.vertexConfidence,
    ai_confidence: report.aiConfidence,
    ai_source: report.aiSource,
    ai_model: report.aiModel,
    media_url: report.mediaUrl,
    media_path: report.mediaPath,
    media_type: report.mediaType,
    title: report.title,
    validated_at: report.validatedAt,
    created_at: report.createdAt || now,
    synced_at: now,
  };
}

async function ensureTable(cfg: BigQueryConfig): Promise<void> {
  if (ensurePromise) return ensurePromise;
  ensurePromise = (async () => {
    const bq = getClient(cfg);
    const [datasets] = await bq.getDatasets();
    const exists = datasets.some((d) => d.id === cfg.dataset);
    if (!exists) {
      await bq.createDataset(cfg.dataset, { location: "US" });
    }
    const dataset = bq.dataset(cfg.dataset);
    const table = dataset.table(cfg.table);
    const [tableExists] = await table.exists();
    if (tableExists) return;
    await dataset.createTable(cfg.table, {
      schema: {
        fields: [
          { name: "report_id", type: "STRING", mode: "REQUIRED" },
          { name: "gcs_uri", type: "STRING", mode: "NULLABLE" },
          { name: "label", type: "STRING", mode: "REQUIRED" },
          { name: "status", type: "STRING", mode: "REQUIRED" },
          { name: "ai_verdict", type: "STRING", mode: "NULLABLE" },
          { name: "hazard_hint", type: "STRING", mode: "REQUIRED" },
          { name: "barangay", type: "STRING", mode: "NULLABLE" },
          { name: "lgu", type: "STRING", mode: "NULLABLE" },
          { name: "citizen_purok", type: "STRING", mode: "NULLABLE" },
          { name: "lat", type: "FLOAT", mode: "NULLABLE" },
          { name: "lng", type: "FLOAT", mode: "NULLABLE" },
          { name: "trust_score", type: "FLOAT", mode: "NULLABLE" },
          { name: "vertex_class", type: "STRING", mode: "NULLABLE" },
          { name: "vertex_confidence", type: "FLOAT", mode: "NULLABLE" },
          { name: "ai_confidence", type: "FLOAT", mode: "NULLABLE" },
          { name: "ai_source", type: "STRING", mode: "NULLABLE" },
          { name: "ai_model", type: "STRING", mode: "NULLABLE" },
          { name: "media_url", type: "STRING", mode: "NULLABLE" },
          { name: "media_path", type: "STRING", mode: "NULLABLE" },
          { name: "media_type", type: "STRING", mode: "NULLABLE" },
          { name: "title", type: "STRING", mode: "NULLABLE" },
          { name: "validated_at", type: "TIMESTAMP", mode: "NULLABLE" },
          { name: "created_at", type: "TIMESTAMP", mode: "NULLABLE" },
          { name: "synced_at", type: "TIMESTAMP", mode: "REQUIRED" },
        ],
      },
    });
  })().catch((err) => {
    ensurePromise = null;
    throw err;
  });
  return ensurePromise;
}

/**
 * Upsert one post-verdict incident into BigQuery.
 * No-op when BigQuery env is unset or status is still queued/validating.
 */
export async function upsertHazardReportToBigQuery(
  report: HazardReport,
): Promise<{ ok: true; skipped?: string } | { ok: false; error: string }> {
  if (!isFinalVerdictStatus(report.status)) {
    return { ok: true, skipped: `status=${report.status}` };
  }
  const cfg = bigQueryConfig();
  if (!cfg) {
    return { ok: true, skipped: "bigquery_not_configured" };
  }

  try {
    await ensureTable(cfg);
    const row = hazardReportToBqRow(report);
    const table = bigQueryTableId(cfg);
    const query = `
MERGE \`${table}\` T
USING (
  SELECT
    @report_id AS report_id,
    @gcs_uri AS gcs_uri,
    @label AS label,
    @status AS status,
    @ai_verdict AS ai_verdict,
    @hazard_hint AS hazard_hint,
    @barangay AS barangay,
    @lgu AS lgu,
    @citizen_purok AS citizen_purok,
    @lat AS lat,
    @lng AS lng,
    @trust_score AS trust_score,
    @vertex_class AS vertex_class,
    @vertex_confidence AS vertex_confidence,
    @ai_confidence AS ai_confidence,
    @ai_source AS ai_source,
    @ai_model AS ai_model,
    @media_url AS media_url,
    @media_path AS media_path,
    @media_type AS media_type,
    @title AS title,
    @validated_at AS validated_at,
    @created_at AS created_at,
    @synced_at AS synced_at
) S
ON T.report_id = S.report_id
WHEN MATCHED THEN UPDATE SET
  gcs_uri = S.gcs_uri,
  label = S.label,
  status = S.status,
  ai_verdict = S.ai_verdict,
  hazard_hint = S.hazard_hint,
  barangay = S.barangay,
  lgu = S.lgu,
  citizen_purok = S.citizen_purok,
  lat = S.lat,
  lng = S.lng,
  trust_score = S.trust_score,
  vertex_class = S.vertex_class,
  vertex_confidence = S.vertex_confidence,
  ai_confidence = S.ai_confidence,
  ai_source = S.ai_source,
  ai_model = S.ai_model,
  media_url = S.media_url,
  media_path = S.media_path,
  media_type = S.media_type,
  title = S.title,
  validated_at = S.validated_at,
  created_at = S.created_at,
  synced_at = S.synced_at
WHEN NOT MATCHED THEN INSERT (
  report_id, gcs_uri, label, status, ai_verdict, hazard_hint, barangay, lgu,
  citizen_purok, lat, lng, trust_score, vertex_class, vertex_confidence,
  ai_confidence, ai_source, ai_model, media_url, media_path, media_type, title,
  validated_at, created_at, synced_at
) VALUES (
  S.report_id, S.gcs_uri, S.label, S.status, S.ai_verdict, S.hazard_hint,
  S.barangay, S.lgu, S.citizen_purok, S.lat, S.lng, S.trust_score,
  S.vertex_class, S.vertex_confidence, S.ai_confidence, S.ai_source, S.ai_model,
  S.media_url, S.media_path, S.media_type, S.title, S.validated_at,
  S.created_at, S.synced_at
)`;

    const toTs = (iso: string | null) =>
      iso ? new Date(iso) : null;

    await getClient(cfg).query({
      query,
      params: {
        report_id: row.report_id,
        gcs_uri: row.gcs_uri,
        label: row.label,
        status: row.status,
        ai_verdict: row.ai_verdict,
        hazard_hint: row.hazard_hint,
        barangay: row.barangay,
        lgu: row.lgu,
        citizen_purok: row.citizen_purok,
        lat: row.lat,
        lng: row.lng,
        trust_score: row.trust_score,
        vertex_class: row.vertex_class,
        vertex_confidence: row.vertex_confidence,
        ai_confidence: row.ai_confidence,
        ai_source: row.ai_source,
        ai_model: row.ai_model,
        media_url: row.media_url,
        media_path: row.media_path,
        media_type: row.media_type,
        title: row.title,
        validated_at: toTs(row.validated_at),
        created_at: toTs(row.created_at),
        synced_at: toTs(row.synced_at),
      },
      types: {
        report_id: "STRING",
        gcs_uri: "STRING",
        label: "STRING",
        status: "STRING",
        ai_verdict: "STRING",
        hazard_hint: "STRING",
        barangay: "STRING",
        lgu: "STRING",
        citizen_purok: "STRING",
        lat: "FLOAT64",
        lng: "FLOAT64",
        trust_score: "FLOAT64",
        vertex_class: "STRING",
        vertex_confidence: "FLOAT64",
        ai_confidence: "FLOAT64",
        ai_source: "STRING",
        ai_model: "STRING",
        media_url: "STRING",
        media_path: "STRING",
        media_type: "STRING",
        title: "STRING",
        validated_at: "TIMESTAMP",
        created_at: "TIMESTAMP",
        synced_at: "TIMESTAMP",
      },
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "BigQuery upsert failed";
    console.error("[bigquery] upsertHazardReportToBigQuery", message);
    return { ok: false, error: message };
  }
}
