import type { LatLng } from "@/lib/geo/cebu";
import { NANGKA_ELEVATION_GRID } from "@/lib/geo/nangkaElevationGrid";

/** Half-step of the cached Nangka elevation grid. */
const D_LAT = 0.00043;
const D_LNG = 0.00052;

/**
 * Flood-prone cells at or below `maxElevM` as individual quads.
 * Avoids a convex hull that would paint high ground between valleys.
 */
export function elevFloodCellPolygons(maxElevM: number): LatLng[][] {
  const rings: LatLng[][] = [];
  for (const s of NANGKA_ELEVATION_GRID) {
    if (s.elevM > maxElevM) continue;
    rings.push([
      { lat: s.lat - D_LAT, lng: s.lng - D_LNG },
      { lat: s.lat - D_LAT, lng: s.lng + D_LNG },
      { lat: s.lat + D_LAT, lng: s.lng + D_LNG },
      { lat: s.lat + D_LAT, lng: s.lng - D_LNG },
      { lat: s.lat - D_LAT, lng: s.lng - D_LNG },
    ]);
  }
  return rings;
}

/** Lowest elevation sample near a point (for flood pin placement). */
export function nearestLowSpot(
  near: LatLng,
  maxElevM: number,
): (LatLng & { elevM: number }) | null {
  let best: (LatLng & { elevM: number }) | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const s of NANGKA_ELEVATION_GRID) {
    if (s.elevM > maxElevM) continue;
    const dLat = s.lat - near.lat;
    const dLng = (s.lng - near.lng) * Math.cos((near.lat * Math.PI) / 180);
    const d2 = dLat * dLat + dLng * dLng;
    if (d2 < bestD) {
      bestD = d2;
      best = { lat: s.lat, lng: s.lng, elevM: s.elevM };
    }
  }
  return best;
}
