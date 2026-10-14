import { NextResponse } from "next/server";
import {
  checkEarthEngineReady,
  earthEngineConfigured,
  earthEngineProjectId,
} from "@/lib/geo/earthEngine";
import {
  getNangkaEeDemMeta,
  hasNangkaEeDem,
} from "@/lib/geo/nangkaEeDem";
import cebuDem from "@/data/cebu-ee-dem.json";

export const runtime = "nodejs";

/**
 * Readiness for Earth Engine auth/config + whether the offline DEM cache exists.
 * Does not run a DEM sample (use `npm run ee:dem` for that).
 */
export async function GET() {
  const projectId = earthEngineProjectId();
  const dem = getNangkaEeDemMeta();
  const cebuSamples = Array.isArray(cebuDem.samples)
    ? cebuDem.samples.length
    : 0;
  const cache = {
    present: hasNangkaEeDem() || cebuSamples > 0,
    provider: dem.provider ?? cebuDem.provider ?? null,
    fetchedAt: dem.fetchedAt ?? cebuDem.fetchedAt ?? null,
    projectId: dem.projectId ?? cebuDem.projectId ?? null,
    cebuSamples,
    nangkaReady: hasNangkaEeDem(),
  };

  if (!earthEngineConfigured()) {
    return NextResponse.json({
      ready: false,
      projectId: null,
      cache,
      error: "EARTH_ENGINE_PROJECT_ID not set",
    });
  }

  const probe = await checkEarthEngineReady();
  return NextResponse.json({
    ready: probe.ready,
    projectId: probe.projectId ?? projectId,
    cache,
    error: probe.error,
  });
}
