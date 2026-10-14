import type { LatLng } from "@/lib/geo/cebu";
import { getNangkaElevGrid } from "@/lib/geo/nangkaEeDem";

/** Half-step of the cached Nangka elevation grid (slight overlap, not a solid slab). */
const D_LAT = 0.0005;
const D_LNG = 0.0006;

/**
 * Ray-cast point-in-polygon for a closed lat/lng ring.
 * Rings from elevFloodCellPolygons are axis-aligned quads.
 */
export function pointInLatLngRing(
  pt: LatLng,
  ring: LatLng[],
): boolean {
  if (ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = ring[i]!.lat;
    const xi = ring[i]!.lng;
    const yj = ring[j]!.lat;
    const xj = ring[j]!.lng;
    const intersect =
      yi > pt.lat !== yj > pt.lat &&
      pt.lng <
        ((xj - xi) * (pt.lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** True when the point sits inside any inundation footprint ring. */
export function pointInFloodFootprints(
  pt: LatLng,
  footprints: LatLng[][] | undefined | null,
): boolean {
  if (!footprints?.length) return false;
  for (const ring of footprints) {
    if (pointInLatLngRing(pt, ring)) return true;
  }
  return false;
}

/**
 * Flood-prone cells at or below `maxElevM` as individual quads.
 * Avoids a convex hull that would paint high ground between valleys.
 */
export function elevFloodCellPolygons(maxElevM: number): LatLng[][] {
  const rings: LatLng[][] = [];
  for (const s of getNangkaElevGrid()) {
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
  for (const s of getNangkaElevGrid()) {
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
