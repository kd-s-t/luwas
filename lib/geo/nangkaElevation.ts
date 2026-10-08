import {
  NANGKA_ELEVATION_GRID,
  NANGKA_ELEV_RANGE,
} from "@/lib/geo/nangkaElevationGrid";

export { NANGKA_ELEV_RANGE };

/** Inverse-distance elevation estimate from the cached Google Elevation grid. */
export function estimateElevM(lat: number, lng: number): number {
  let wSum = 0;
  let eSum = 0;
  let best = NANGKA_ELEVATION_GRID[0]!;
  let bestD2 = Number.POSITIVE_INFINITY;

  for (const s of NANGKA_ELEVATION_GRID) {
    const dLat = s.lat - lat;
    const dLng = (s.lng - lng) * Math.cos((lat * Math.PI) / 180);
    const d2 = dLat * dLat + dLng * dLng;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = s;
    }
    // ~25 m neighborhood in degrees²
    if (d2 < 1e-12) return s.elevM;
    if (d2 > 2.5e-7) continue;
    const w = 1 / d2;
    wSum += w;
    eSum += w * s.elevM;
  }

  if (wSum > 0) return eSum / wSum;
  return best.elevM;
}

/**
 * Low (flood-prone) → amber/red; high → green.
 * Range anchored to Nangka sample min/max.
 */
export function elevFillColor(elevM: number): string {
  const { minM, maxM } = NANGKA_ELEV_RANGE;
  const t = Math.max(0, Math.min(1, (elevM - minM) / (maxM - minM || 1)));
  // 0 = #c05621 (low), 0.5 = #ca8a04, 1 = #1f8f55 (high)
  if (t < 0.5) {
    const u = t / 0.5;
    return lerpHex("#c05621", "#ca8a04", u);
  }
  return lerpHex("#ca8a04", "#1f8f55", (t - 0.5) / 0.5);
}

function lerpHex(a: string, b: string, t: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const r = Math.round(pa.r + (pb.r - pa.r) * t);
  const g = Math.round(pa.g + (pb.g - pa.g) * t);
  const bl = Math.round(pa.b + (pb.b - pa.b) * t);
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`;
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function toHex(n: number) {
  return n.toString(16).padStart(2, "0");
}
