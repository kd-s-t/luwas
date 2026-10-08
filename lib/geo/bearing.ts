import type { LatLng } from "@/lib/geo/cebu";

export function distKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Compass bearing in degrees (0 = north, clockwise). */
export function bearingDegrees(from: LatLng, to: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(from.lat);
  const φ2 = toRad(to.lat);
  const Δλ = toRad(to.lng - from.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

export function compassLabel(bearing: number): (typeof COMPASS)[number] {
  const i = Math.round(bearing / 45) % 8;
  return COMPASS[i];
}

/** Point ~ratio along great-circle (flat approx OK at barangay scale). */
export function pointAlong(from: LatLng, to: LatLng, ratio: number): LatLng {
  return {
    lat: from.lat + (to.lat - from.lat) * ratio,
    lng: from.lng + (to.lng - from.lng) * ratio,
  };
}

/** Point + local tangent bearing at `ratio` along a polyline (0–1). */
export function pointAndBearingAlongPath(
  path: LatLng[],
  ratio: number,
): { point: LatLng; bearing: number } {
  if (path.length === 0) {
    return { point: { lat: 0, lng: 0 }, bearing: 0 };
  }
  if (path.length === 1) {
    return { point: path[0]!, bearing: 0 };
  }

  const segLens: number[] = [];
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const d = distKm(path[i]!, path[i + 1]!);
    segLens.push(d);
    total += d;
  }

  if (total <= 0) {
    return {
      point: path[path.length - 1]!,
      bearing: bearingDegrees(path[0]!, path[path.length - 1]!),
    };
  }

  let target = Math.max(0, Math.min(1, ratio)) * total;
  for (let i = 0; i < segLens.length; i++) {
    const len = segLens[i]!;
    if (target > len && i < segLens.length - 1) {
      target -= len;
      continue;
    }
    const t = len > 0 ? target / len : 0;
    const a = path[i]!;
    const b = path[i + 1]!;
    return {
      point: pointAlong(a, b, t),
      bearing: bearingDegrees(a, b),
    };
  }

  const last = path.length - 1;
  return {
    point: path[last]!,
    bearing: bearingDegrees(path[last - 1]!, path[last]!),
  };
}
