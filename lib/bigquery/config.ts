/** BigQuery warehouse for post-verdict hazard reports. Skips when unset. */
export type BigQueryConfig = {
  projectId: string;
  dataset: string;
  table: string;
};

export function bigQueryConfig(): BigQueryConfig | null {
  const projectId =
    process.env.BIGQUERY_PROJECT_ID?.trim() ||
    process.env.VERTEX_PROJECT_ID?.trim() ||
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    process.env.GCLOUD_PROJECT?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ||
    "";
  if (!projectId || projectId === "demo-dro") return null;
  return {
    projectId,
    dataset: process.env.BIGQUERY_DATASET?.trim() || "luwas",
    table: process.env.BIGQUERY_TABLE?.trim() || "hazard_reports",
  };
}

export function bigQueryTableId(cfg: BigQueryConfig): string {
  return `${cfg.projectId}.${cfg.dataset}.${cfg.table}`;
}
