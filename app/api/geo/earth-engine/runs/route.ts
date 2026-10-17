import { NextResponse } from "next/server";
import {
  checkEarthEngineReady,
  earthEngineConfigured,
  earthEngineProjectId,
} from "@/lib/geo/earthEngine";
import {
  listActiveEeCacheFiles,
  listEeRuns,
} from "@/lib/geo/eeRunHistory";
import type { EeRunJob } from "@/lib/geo/eeRunTypes";
import { isEeRunBusy, runEarthEngineJob } from "@/lib/geo/eeRunJobs";
import { mediaStorageBucket } from "@/lib/storage/gcsAdmin";

export const runtime = "nodejs";
export const maxDuration = 300;

const JOBS = new Set<EeRunJob>(["dem", "hazards", "both"]);

/** List run history + Firestore ee_datasets + readiness. */
export async function GET() {
  const projectId = earthEngineProjectId();
  let ready = false;
  let error: string | null = null;
  if (!earthEngineConfigured()) {
    error = "EARTH_ENGINE_PROJECT_ID not set";
  } else {
    const probe = await checkEarthEngineReady();
    ready = probe.ready;
    error = probe.error ?? null;
  }

  const [activeFiles, runs] = await Promise.all([
    listActiveEeCacheFiles(),
    listEeRuns(),
  ]);

  return NextResponse.json({
    ready,
    busy: isEeRunBusy(),
    projectId,
    error,
    storageBucket: mediaStorageBucket(),
    activeFiles,
    datasets: activeFiles,
    runs,
  });
}

/** Manually start DEM / hazards / both (not automated). */
export async function POST(req: Request) {
  if (isEeRunBusy()) {
    return NextResponse.json(
      { error: "An Earth Engine run is already in progress." },
      { status: 409 },
    );
  }

  let body: { job?: string; triggeredBy?: string } = {};
  try {
    body = (await req.json()) as { job?: string; triggeredBy?: string };
  } catch {
    body = {};
  }

  const job = (body.job ?? "both") as EeRunJob;
  if (!JOBS.has(job)) {
    return NextResponse.json(
      { error: "job must be dem, hazards, or both" },
      { status: 400 },
    );
  }

  if (!earthEngineConfigured()) {
    return NextResponse.json(
      { error: "EARTH_ENGINE_PROJECT_ID not set" },
      { status: 503 },
    );
  }

  const run = await runEarthEngineJob({
    job,
    triggeredBy: body.triggeredBy?.trim() || null,
  });

  if (run.status === "failed") {
    return NextResponse.json({ run }, { status: 500 });
  }

  return NextResponse.json({ run });
}
