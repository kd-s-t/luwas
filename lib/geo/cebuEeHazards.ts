import type { FireSample } from "@/lib/hazards/fireSamples";
import type { FloodSample } from "@/lib/hazards/floodSamples";
import type { LandslideSample } from "@/lib/hazards/landslideSamples";
import type { ElevSample } from "@/lib/geo/nangkaElevationGrid";
import { distKm } from "@/lib/geo/bearing";
import type { MapArea } from "@/lib/geo/mapAreas";
import cebuHazards from "@/data/cebu-ee-hazards.json";

export type CebuEeHazardsFile = {
  provider: string | null;
  fetchedAt: string | null;
  projectId: string | null;
  floods: FloodSample[];
  landslides: LandslideSample[];
  fires: FireSample[];
};

const cached = cebuHazards as CebuEeHazardsFile;

export function hasCebuEeHazards(): boolean {
  return (
    (cached.floods?.length ?? 0) +
      (cached.landslides?.length ?? 0) +
      (cached.fires?.length ?? 0) >
    0
  );
}

export function getCebuEeHazardsMeta(): Omit<
  CebuEeHazardsFile,
  "floods" | "landslides" | "fires"
> {
  return {
    provider: cached.provider ?? null,
    fetchedAt: cached.fetchedAt ?? null,
    projectId: cached.projectId ?? null,
  };
}

export function getCebuEeHazards(): CebuEeHazardsFile {
  return {
    provider: cached.provider ?? null,
    fetchedAt: cached.fetchedAt ?? null,
    projectId: cached.projectId ?? null,
    floods: cached.floods ?? [],
    landslides: cached.landslides ?? [],
    fires: cached.fires ?? [],
  };
}

/** Hazards within `maxKm` of the barangay map center. */
export function cebuEeHazardsNear(
  area: MapArea,
  maxKm = 8,
): Pick<CebuEeHazardsFile, "floods" | "landslides" | "fires"> {
  if (!hasCebuEeHazards()) {
    return { floods: [], landslides: [], fires: [] };
  }
  const near = <T extends { lat: number; lng: number }>(rows: T[]) =>
    rows.filter((r) => distKm(area.center, r) <= maxKm);
  return {
    floods: near(cached.floods ?? []),
    landslides: near(cached.landslides ?? []),
    fires: near(cached.fires ?? []),
  };
}

/**
 * Build flood + landslide pins from the offline Cebu DEM cache (no EE call).
 * Thinned so the map stays usable.
 */
export function hazardsFromCebuDem(samples: ElevSample[]): {
  floods: FloodSample[];
  landslides: LandslideSample[];
} {
  if (samples.length < 4) return { floods: [], landslides: [] };

  const byKey = new Map<string, ElevSample>();
  const round = (n: number) => Math.round(n * 100) / 100;
  for (const s of samples) {
    byKey.set(`${round(s.lat)},${round(s.lng)}`, s);
  }

  const elevs = samples.map((s) => s.elevM).sort((a, b) => a - b);
  const p25 = elevs[Math.floor(elevs.length * 0.25)] ?? 20;
  const floodCut = Math.min(25, Math.max(8, p25));

  const floodCandidates: (ElevSample & { severity: FloodSample["severity"] })[] =
    [];
  for (const s of samples) {
    if (s.elevM > floodCut) continue;
    const severity: FloodSample["severity"] =
      s.elevM <= floodCut * 0.35
        ? "critical"
        : s.elevM <= floodCut * 0.65
          ? "warning"
          : "watch";
    floodCandidates.push({ ...s, severity });
  }
  floodCandidates.sort((a, b) => a.elevM - b.elevM);
  const floods = thinByMinKm(floodCandidates, 3.5)
    .slice(0, 180)
    .map((s, i) => ({
      id: `ee-fl-cebu-${i}`,
      name: `Flood-prone · ${s.elevM.toFixed(0)} m elev`,
      place: "SRTM low ground (Earth Engine cache)",
      purokHint: "Cebu",
      severity: s.severity,
      lat: s.lat,
      lng: s.lng,
      depthCm:
        s.severity === "critical" ? 80 : s.severity === "warning" ? 40 : 15,
      reportedAt: new Date().toISOString(),
      notes: `Offline DEM: elev ${s.elevM} m ≤ flood cut ${floodCut.toFixed(0)} m.`,
      radiusM: 900,
    }));

  const slideCandidates: (ElevSample & {
    slope: number;
    severity: LandslideSample["severity"];
  })[] = [];
  const step = 0.02;
  for (const s of samples) {
    let maxDh = 0;
    for (const dLat of [-step, 0, step]) {
      for (const dLng of [-step, 0, step]) {
        if (dLat === 0 && dLng === 0) continue;
        const n = byKey.get(`${round(s.lat + dLat)},${round(s.lng + dLng)}`);
        if (!n) continue;
        maxDh = Math.max(maxDh, Math.abs(n.elevM - s.elevM));
      }
    }
    // ~2.2 km cell → rough rise (m). Steep if rise is large vs neighbors.
    const slope = maxDh;
    if (slope < 45) continue;
    const severity: LandslideSample["severity"] =
      slope >= 120 ? "critical" : slope >= 75 ? "warning" : "watch";
    slideCandidates.push({ ...s, slope, severity });
  }
  slideCandidates.sort((a, b) => b.slope - a.slope);
  const landslides = thinByMinKm(slideCandidates, 4)
    .slice(0, 120)
    .map((s, i) => ({
      id: `ee-ls-cebu-${i}`,
      name: `Slope risk · Δ${s.slope.toFixed(0)} m`,
      place: "SRTM neighbor relief (Earth Engine cache)",
      purokHint: "Cebu",
      severity: s.severity,
      lat: s.lat,
      lng: s.lng,
      reportedAt: new Date().toISOString(),
      notes: `Offline DEM relief vs neighbors ≈ ${s.slope.toFixed(0)} m over ~2 km.`,
    }));

  return { floods, landslides };
}

function thinByMinKm<T extends { lat: number; lng: number }>(
  rows: T[],
  minKm: number,
): T[] {
  const kept: T[] = [];
  for (const row of rows) {
    if (kept.some((k) => distKm(k, row) < minKm)) continue;
    kept.push(row);
  }
  return kept;
}
