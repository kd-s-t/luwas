import { hazardsFromCebuDem } from "@/lib/geo/cebuEeHazards";
import { distKm } from "@/lib/geo/bearing";
import {
  createEeRunStub,
  finalizeEeRun,
  readActiveEeCacheFile,
  writeActiveEeCacheFile,
  writeEeRunFile,
} from "@/lib/geo/eeRunHistory";
import type { EeRunJob, EeRunMeta } from "@/lib/geo/eeRunTypes";
import {
  filterNangkaSamples,
  sampleCebuDem,
  sampleCebuFires,
} from "@/lib/geo/earthEngine";
import type { ElevSample } from "@/lib/geo/nangkaElevationGrid";
import type { FireSample } from "@/lib/hazards/fireSamples";

let busy = false;

export function isEeRunBusy(): boolean {
  return busy;
}

function thinFires(fires: FireSample[], minKm: number): FireSample[] {
  const kept: FireSample[] = [];
  for (const f of fires) {
    if (kept.some((k) => distKm(k, f) < minKm)) continue;
    kept.push(f);
  }
  return kept;
}

async function runDemJob(runId: string): Promise<{
  projectId: string;
  provider: string;
  counts: Record<string, number>;
  files: Awaited<ReturnType<typeof writeEeRunFile>>[];
}> {
  const result = await sampleCebuDem();
  const nangkaSamples = filterNangkaSamples(result.samples);
  if (!nangkaSamples.length) {
    throw new Error(
      "Cebu pull succeeded but no samples fell inside the Nangka bbox.",
    );
  }
  const nangka = {
    provider: result.provider,
    fetchedAt: result.fetchedAt,
    projectId: result.projectId,
    scope: "nangka" as const,
    samples: nangkaSamples,
  };

  await writeActiveEeCacheFile("cebu-ee-dem.json", result);
  await writeActiveEeCacheFile("nangka-ee-dem.json", nangka);

  const files = [
    await writeEeRunFile(runId, "cebu-ee-dem.json", result),
    await writeEeRunFile(runId, "nangka-ee-dem.json", nangka),
  ];

  return {
    projectId: result.projectId,
    provider: result.provider,
    counts: {
      cebuSamples: result.samples.length,
      nangkaSamples: nangkaSamples.length,
    },
    files,
  };
}

async function runHazardsJob(runId: string): Promise<{
  projectId: string | null;
  provider: string;
  counts: Record<string, number>;
  files: Awaited<ReturnType<typeof writeEeRunFile>>[];
}> {
  const demFile = await readActiveEeCacheFile("cebu-ee-dem.json");
  if (!demFile) {
    throw new Error("Missing cebu-ee-dem.json in Storage / data. Run DEM first.");
  }
  const dem = JSON.parse(demFile.body.toString("utf8")) as {
    samples?: ElevSample[];
    projectId?: string;
    provider?: string;
  };
  if (!dem.samples?.length) {
    throw new Error("cebu-ee-dem.json has no samples. Run DEM first.");
  }

  const { floods, landslides } = hazardsFromCebuDem(dem.samples);
  const { projectId, hotspots, window } = await sampleCebuFires(90);
  const firesRaw: FireSample[] = hotspots
    .sort((a, b) => b.t21 - a.t21)
    .map((h, i) => {
      const severity: FireSample["severity"] =
        h.t21 >= 360 ? "critical" : h.t21 >= 340 ? "warning" : "watch";
      return {
        id: `ee-fire-cebu-${i}`,
        name: `FIRMS hotspot · T21 ${h.t21.toFixed(0)}`,
        place: `MODIS FIRMS (Earth Engine, ${window})`,
        purokHint: "Cebu",
        severity,
        lat: h.lat,
        lng: h.lng,
        reportedAt: new Date().toISOString(),
        notes: `Brightness T21=${h.t21.toFixed(1)}${
          h.confidence != null ? ` · confidence ${h.confidence}` : ""
        }.`,
      };
    });
  const fires = thinFires(firesRaw, 2).slice(0, 100);

  const out = {
    provider: `DEM:${dem.provider ?? "USGS/SRTMGL1_003"}+FIRMS`,
    fetchedAt: new Date().toISOString(),
    projectId: projectId || dem.projectId || null,
    floods,
    landslides,
    fires,
  };

  await writeActiveEeCacheFile("cebu-ee-hazards.json", out);
  const files = [await writeEeRunFile(runId, "cebu-ee-hazards.json", out)];

  return {
    projectId: out.projectId,
    provider: out.provider,
    counts: {
      floods: floods.length,
      landslides: landslides.length,
      fires: fires.length,
    },
    files,
  };
}

export async function runEarthEngineJob(input: {
  job: EeRunJob;
  triggeredBy?: string | null;
}): Promise<EeRunMeta> {
  if (busy) {
    throw new Error("An Earth Engine run is already in progress.");
  }
  busy = true;
  const stub = await createEeRunStub({
    job: input.job,
    triggeredBy: input.triggeredBy,
  });

  try {
    const files: Awaited<ReturnType<typeof writeEeRunFile>>[] = [];
    let projectId: string | null = null;
    let provider: string | null = null;
    const counts: Record<string, number> = {};

    if (input.job === "dem" || input.job === "both") {
      const dem = await runDemJob(stub.id);
      files.push(...dem.files);
      projectId = dem.projectId;
      provider = dem.provider;
      Object.assign(counts, dem.counts);
    }

    if (input.job === "hazards" || input.job === "both") {
      const hazards = await runHazardsJob(stub.id);
      files.push(...hazards.files);
      projectId = hazards.projectId ?? projectId;
      provider = hazards.provider ?? provider;
      Object.assign(counts, hazards.counts);
    }

    return finalizeEeRun(stub.id, {
      status: "ok",
      projectId,
      provider,
      error: null,
      files,
      counts,
      finishedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return finalizeEeRun(stub.id, {
      status: "failed",
      error: message,
      finishedAt: new Date().toISOString(),
    });
  } finally {
    busy = false;
  }
}
