import type { ElevSample } from "@/lib/geo/nangkaElevationGrid";
import {
  NANGKA_ELEVATION_GRID,
  NANGKA_ELEV_RANGE,
} from "@/lib/geo/nangkaElevationGrid";
import eeDem from "@/data/nangka-ee-dem.json";

export type NangkaEeDemFile = {
  provider: string | null;
  fetchedAt: string | null;
  projectId: string | null;
  samples: ElevSample[];
};

const cached = eeDem as NangkaEeDemFile;

/** True when `npm run ee:dem` has written real Earth Engine samples. */
export function hasNangkaEeDem(): boolean {
  return Array.isArray(cached.samples) && cached.samples.length > 0;
}

export function getNangkaEeDemMeta(): Omit<NangkaEeDemFile, "samples"> {
  return {
    provider: cached.provider ?? null,
    fetchedAt: cached.fetchedAt ?? null,
    projectId: cached.projectId ?? null,
  };
}

/**
 * Active Nangka elevation grid: Earth Engine cache when present, else static
 * Google Elevation samples.
 */
export function getNangkaElevGrid(): ElevSample[] {
  if (hasNangkaEeDem()) return cached.samples as ElevSample[];
  return NANGKA_ELEVATION_GRID;
}

/** Min/max for color scale; recomputed when EE samples are active. */
export function getNangkaElevRange(): { minM: number; maxM: number } {
  const grid = getNangkaElevGrid();
  if (!hasNangkaEeDem() || grid.length === 0) {
    return { minM: NANGKA_ELEV_RANGE.minM, maxM: NANGKA_ELEV_RANGE.maxM };
  }
  let minM = Number.POSITIVE_INFINITY;
  let maxM = Number.NEGATIVE_INFINITY;
  for (const s of grid) {
    if (s.elevM < minM) minM = s.elevM;
    if (s.elevM > maxM) maxM = s.elevM;
  }
  if (!Number.isFinite(minM) || !Number.isFinite(maxM)) {
    return { minM: NANGKA_ELEV_RANGE.minM, maxM: NANGKA_ELEV_RANGE.maxM };
  }
  return { minM, maxM };
}
