import { NextResponse } from "next/server";
import { exportVertexIngestCsvFromBigQuery } from "@/lib/bigquery/vertexIngestExport";

export const runtime = "nodejs";
export const maxDuration = 120;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  if (header === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret;
}

/** Cloud Scheduler / manual: BigQuery hazard_reports → GCS Vertex labels.csv */
export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await exportVertexIngestCsvFromBigQuery();
  if (!result.ok) {
    return NextResponse.json(result, { status: 502 });
  }
  return NextResponse.json(result);
}

export async function GET(req: Request) {
  return POST(req);
}
