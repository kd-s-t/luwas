import { BigQuery } from "@google-cloud/bigquery";
import { bigQueryConfig, bigQueryTableId } from "@/lib/bigquery/config";
import { gcsPutObject, mediaStorageBucket } from "@/lib/storage/gcsAdmin";

export type VertexIngestExportResult = {
  ok: true;
  skipped?: string;
  rowCount: number;
  bucket: string;
  datedUri: string;
  latestUri: string;
  runDate: string;
} | {
  ok: false;
  error: string;
};

function runDateUtc(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function ingestPrefix(): string {
  return (
    process.env.VERTEX_INGEST_GCS_PREFIX?.trim().replace(/\/+$/, "") ||
    "luwas-vision-ingest"
  );
}

/**
 * Pull post-verdict photo rows from BigQuery and write Vertex import CSVs to GCS.
 * Format per line: gs://bucket/path/to.jpg,label
 */
export async function exportVertexIngestCsvFromBigQuery(opts?: {
  runDate?: string;
}): Promise<VertexIngestExportResult> {
  const cfg = bigQueryConfig();
  if (!cfg) {
    return { ok: true, skipped: "bigquery_not_configured", rowCount: 0, bucket: "", datedUri: "", latestUri: "", runDate: runDateUtc() };
  }

  const bucket =
    process.env.VERTEX_INGEST_BUCKET?.trim() ||
    process.env.FIREBASE_STORAGE_BUCKET?.trim() ||
    mediaStorageBucket();
  if (!bucket || bucket.includes("demo-dro")) {
    return {
      ok: false,
      error:
        "Set FIREBASE_STORAGE_BUCKET or VERTEX_INGEST_BUCKET (not the emulator demo bucket).",
    };
  }

  const date = opts?.runDate?.trim() || runDateUtc();
  const prefix = ingestPrefix();
  const table = bigQueryTableId(cfg);

  try {
    const bq = new BigQuery({ projectId: cfg.projectId });
    const [rows] = await bq.query({
      query: `
SELECT
  gcs_uri AS gcs_uri,
  label AS label
FROM \`${table}\`
WHERE gcs_uri IS NOT NULL
  AND TRIM(gcs_uri) != ''
  AND STARTS_WITH(gcs_uri, 'gs://')
  AND LOWER(IFNULL(media_type, 'photo')) = 'photo'
  AND status IN ('legit', 'rejected')
  AND label IS NOT NULL
  AND TRIM(label) != ''
ORDER BY COALESCE(validated_at, synced_at, created_at) DESC
`,
    });

    const lines: string[] = [];
    const seen = new Set<string>();
    for (const row of rows as { gcs_uri?: string; label?: string }[]) {
      const uri = String(row.gcs_uri ?? "").trim();
      const label = String(row.label ?? "").trim();
      if (!uri || !label) continue;
      const key = `${uri}\t${label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(`${uri},${label}`);
    }

    const body = lines.length ? `${lines.join("\n")}\n` : "";
    const bytes = Buffer.from(body, "utf8");
    const datedPath = `${prefix}/${date}/labels.csv`;
    const latestPath = `${prefix}/latest/labels.csv`;

    await gcsPutObject({
      bucket,
      objectPath: datedPath,
      bytes,
      contentType: "text/csv; charset=utf-8",
    });
    await gcsPutObject({
      bucket,
      objectPath: latestPath,
      bytes,
      contentType: "text/csv; charset=utf-8",
    });

    return {
      ok: true,
      rowCount: lines.length,
      bucket,
      datedUri: `gs://${bucket}/${datedPath}`,
      latestUri: `gs://${bucket}/${latestPath}`,
      runDate: date,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Vertex ingest export failed";
    console.error("[bigquery] exportVertexIngestCsvFromBigQuery", message);
    return { ok: false, error: message };
  }
}
