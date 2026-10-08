/**
 * OSM waterway centerlines through Brgy. Nangka (Consolacion) — used to keep
 * synthetic household pins off rivers/creeks. Source: OpenStreetMap ways
 * Cansaga River (97925677) + Jagobiao Creek (97925682), clipped to the demo bbox.
 */

export type WaterLatLng = { lat: number; lng: number };

/** Cansaga River — eastern channel through Nangka (downsampled). */
const CANSAGA_RIVER: WaterLatLng[] = [
  { lat: 10.375877, lng: 123.963003 },
  { lat: 10.375366, lng: 123.963138 },
  { lat: 10.375042, lng: 123.963345 },
  { lat: 10.374764, lng: 123.963715 },
  { lat: 10.374698, lng: 123.963973 },
  { lat: 10.374329, lng: 123.964486 },
  { lat: 10.373827, lng: 123.965329 },
  { lat: 10.373896, lng: 123.965972 },
  { lat: 10.374102, lng: 123.966272 },
  { lat: 10.374009, lng: 123.966615 },
  { lat: 10.373676, lng: 123.966935 },
  { lat: 10.373259, lng: 123.967119 },
  { lat: 10.372681, lng: 123.967558 },
  { lat: 10.372079, lng: 123.967513 },
  { lat: 10.371730, lng: 123.967631 },
  { lat: 10.371535, lng: 123.967887 },
  { lat: 10.371198, lng: 123.967927 },
  { lat: 10.370868, lng: 123.967743 },
  { lat: 10.370558, lng: 123.967497 },
  { lat: 10.369849, lng: 123.967455 },
  { lat: 10.369582, lng: 123.967538 },
  { lat: 10.369159, lng: 123.967738 },
  { lat: 10.368823, lng: 123.967672 },
  { lat: 10.368412, lng: 123.967367 },
  { lat: 10.368057, lng: 123.967131 },
  { lat: 10.367499, lng: 123.967185 },
  { lat: 10.366956, lng: 123.967112 },
  { lat: 10.366724, lng: 123.966824 },
  { lat: 10.366485, lng: 123.966742 },
  { lat: 10.366297, lng: 123.966988 },
  { lat: 10.366217, lng: 123.967167 },
  { lat: 10.366205, lng: 123.967307 },
  { lat: 10.366264, lng: 123.967367 },
  { lat: 10.366509, lng: 123.967637 },
  { lat: 10.366670, lng: 123.967828 },
  { lat: 10.366679, lng: 123.968083 },
  { lat: 10.366694, lng: 123.968320 },
  { lat: 10.366760, lng: 123.968620 },
  { lat: 10.366658, lng: 123.968865 },
  { lat: 10.366522, lng: 123.969084 },
];

/** Jagobiao Creek — western channel / drainage near V&G / Duke St. */
const JAGOBIAO_CREEK: WaterLatLng[] = [
  { lat: 10.371131, lng: 123.956984 },
  { lat: 10.371260, lng: 123.957110 },
  { lat: 10.371524, lng: 123.957131 },
  { lat: 10.371856, lng: 123.957380 },
  { lat: 10.372198, lng: 123.957730 },
  { lat: 10.372358, lng: 123.958085 },
  { lat: 10.372457, lng: 123.958451 },
  { lat: 10.373276, lng: 123.959274 },
  { lat: 10.373461, lng: 123.959597 },
  { lat: 10.374340, lng: 123.960128 },
  { lat: 10.374479, lng: 123.960496 },
  { lat: 10.374744, lng: 123.960935 },
  { lat: 10.374968, lng: 123.961098 },
  { lat: 10.375258, lng: 123.961427 },
  { lat: 10.375421, lng: 123.961851 },
  { lat: 10.375501, lng: 123.962440 },
  { lat: 10.375542, lng: 123.962611 },
  { lat: 10.375551, lng: 123.962919 },
  { lat: 10.375366, lng: 123.963138 },
];

type WaterCorridor = {
  path: WaterLatLng[];
  /** Half-width of rendered channel + margin (meters). */
  bufferM: number;
};

const CORRIDORS: WaterCorridor[] = [
  { path: CANSAGA_RIVER, bufferM: 65 },
  { path: JAGOBIAO_CREEK, bufferM: 45 },
];

function distPointToSegmentM(
  p: WaterLatLng,
  a: WaterLatLng,
  b: WaterLatLng,
): number {
  const cos = Math.cos((p.lat * Math.PI) / 180);
  const ax = (a.lng - p.lng) * cos * 111_320;
  const ay = (a.lat - p.lat) * 111_320;
  const bx = (b.lng - p.lng) * cos * 111_320;
  const by = (b.lat - p.lat) * 111_320;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? (-ax * dx + -ay * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const px = ax + t * dx;
  const py = ay + t * dy;
  return Math.hypot(px, py);
}

function distToPolylineM(p: WaterLatLng, path: WaterLatLng[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < path.length - 1; i++) {
    const d = distPointToSegmentM(p, path[i]!, path[i + 1]!);
    if (d < best) best = d;
  }
  return best;
}

/** True when the point sits on/near a mapped river or creek. */
export function isOnNangkaWater(lat: number, lng: number): boolean {
  const p = { lat, lng };
  for (const c of CORRIDORS) {
    if (distToPolylineM(p, c.path) <= c.bufferM) return true;
  }
  return false;
}
