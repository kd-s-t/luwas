/**
 * One-shot BigQuery → GCS Vertex labels export.
 * Usage: npm run bq:vertex-ingest
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { exportVertexIngestCsvFromBigQuery } from "../lib/bigquery/vertexIngestExport";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(name: string) {
  const p = join(root, name);
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env.production");

if (!process.env.FIREBASE_STORAGE_BUCKET?.trim()) {
  process.env.FIREBASE_STORAGE_BUCKET =
    process.env.VERTEX_INGEST_BUCKET?.trim() ||
    "luwas-media-nice-pen-181017";
}
if (!process.env.VERTEX_PROJECT_ID?.trim()) {
  process.env.VERTEX_PROJECT_ID = "nice-pen-181017";
}

async function main() {
  const result = await exportVertexIngestCsvFromBigQuery();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
