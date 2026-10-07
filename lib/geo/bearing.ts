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
