/** Curated Consolacion / metro Cebu places, aligned with iOS ServiceAreaPlaces. */

export type ServiceAreaPlace = {
  id: string;
  barangay: string;
  lgu: string;
  lat: number;
  lng: number;
  /** Landmark name shown instead of "Brgy. …". */
  landmark?: string;
  /** Extra search phrases (e.g. "sm consolacion"). */
  aliases?: string[];
};

export function placeLabel(p: ServiceAreaPlace): string {
  if (p.landmark?.trim()) return `${p.landmark.trim()}, ${p.lgu}`;
  return `Brgy. ${p.barangay}, ${p.lgu}`;
}

export const NANGKA_HALL = {
  lat: 10.3708662,
  lng: 123.9590464,
} as const;

export const SERVICE_AREA_PLACES: ServiceAreaPlace[] = [
  {
    id: "consolacion/sm-consolacion",
    barangay: "Poblacion Occidental",
    lgu: "Consolacion",
    lat: 10.379876090660447,
    lng: 123.96408121585092,
    landmark: "SM Consolacion",
    aliases: [
      "sm consolacion",
      "sm city consolacion",
      "sm lacion",
      "sm conso",
      "smc consolacion",
    ],
  },
  {
    id: "consolacion/nangka",
    barangay: "Nangka",
    lgu: "Consolacion",
    lat: 10.3708662,
    lng: 123.9590464,
  },
  {
    id: "consolacion/tayud",
    barangay: "Tayud",
    lgu: "Consolacion",
    lat: 10.3862,
    lng: 123.9728,
  },
  {
    id: "consolacion/pulpogan",
    barangay: "Pulpogan",
    lgu: "Consolacion",
    lat: 10.3584,
    lng: 123.9486,
  },
  {
    id: "consolacion/cansaga",
    barangay: "Cansaga",
    lgu: "Consolacion",
    lat: 10.3655,
    lng: 123.9682,
  },
  {
    id: "consolacion/casili",
    barangay: "Casili",
    lgu: "Consolacion",
    lat: 10.3921,
    lng: 123.9514,
  },
  {
    id: "consolacion/poblacion-occidental",
    barangay: "Poblacion Occidental",
    lgu: "Consolacion",
    lat: 10.3768,
    lng: 123.9571,
  },
  {
    id: "consolacion/lamac",
    barangay: "Lamac",
    lgu: "Consolacion",
    lat: 10.3512,
    lng: 123.9618,
  },
  {
    id: "mandaue-city/tipolo",
    barangay: "Tipolo",
    lgu: "Mandaue City",
    lat: 10.3331,
    lng: 123.9354,
  },
  {
    id: "cebu-city/mabolo",
    barangay: "Mabolo",
    lgu: "Cebu City",
    lat: 10.3275,
    lng: 123.9158,
  },
  {
    id: "cebu-city/apas",
    barangay: "Apas",
    lgu: "Cebu City",
    lat: 10.337229,
    lng: 123.90484,
  },
];

function placeSearchBlob(p: ServiceAreaPlace): string {
  return [
    placeLabel(p),
    p.barangay,
    p.lgu,
    p.landmark ?? "",
    ...(p.aliases ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

/** Resolve typed search to one curated place (label, landmark, or alias). */
export function matchPlace(query: string): ServiceAreaPlace | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const exactLabel = SERVICE_AREA_PLACES.find(
    (p) => placeLabel(p).toLowerCase() === q,
  );
  if (exactLabel) return exactLabel;
  const exactLandmark = SERVICE_AREA_PLACES.find(
    (p) => p.landmark?.trim().toLowerCase() === q,
  );
  if (exactLandmark) return exactLandmark;
  const aliasHit = SERVICE_AREA_PLACES.find((p) =>
    (p.aliases ?? []).some((a) => {
      const alias = a.trim().toLowerCase();
      return (
        alias === q ||
        (q.length >= 3 && alias.startsWith(q)) ||
        (q.length >= alias.length && q.includes(alias))
      );
    }),
  );
  if (aliasHit) return aliasHit;
  if (q.length >= 3) {
    const byBarangay = SERVICE_AREA_PLACES.find(
      (p) => !p.landmark && p.barangay.toLowerCase() === q,
    );
    if (byBarangay) return byBarangay;
  }
  return null;
}

export function filterPlaces(query: string): ServiceAreaPlace[] {
  const q = query.trim().toLowerCase();
  if (!q) return SERVICE_AREA_PLACES.slice(0, 8);
  const matched = matchPlace(q);
  const tokens = q.split(/\s+/).filter(Boolean);
  const hits = SERVICE_AREA_PLACES.filter((p) => {
    const blob = placeSearchBlob(p);
    if (blob.includes(q)) return true;
    // Multi-word queries: every token must appear (e.g. "sm consolacion").
    if (tokens.length > 1 && tokens.every((t) => blob.includes(t))) return true;
    return false;
  });
  if (matched && !hits.some((h) => h.id === matched.id)) {
    hits.unshift(matched);
  } else if (matched) {
    hits.sort((a, b) => (a.id === matched.id ? -1 : b.id === matched.id ? 1 : 0));
  }
  return hits.slice(0, 8);
}

/** Haversine distance in kilometers. */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export function nearestPlace(lat: number, lng: number): ServiceAreaPlace {
  let best = SERVICE_AREA_PLACES[0]!;
  let bestKm = Infinity;
  for (const p of SERVICE_AREA_PLACES) {
    const km = distanceKm({ lat, lng }, p);
    if (km < bestKm) {
      bestKm = km;
      best = p;
    }
  }
  return best;
}
