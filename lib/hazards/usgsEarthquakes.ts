import { CEBU_AREA } from "@/lib/geo/cebu";

export type QuakeEvent = {
  id: string;
  mag: number | null;
  place: string;
  time: number;
  lat: number;
  lng: number;
  depthKm: number | null;
  url: string;
  distanceKm: number;
};

type UsgsFeature = {
  id: string;
  properties: {
    mag: number | null;
    place: string | null;
    time: number;
    url: string | null;
  };
  geometry: {
    coordinates: [number, number, number?];
  };
};

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Live USGS week feed, filtered to PH bbox then ranked by distance to Cebu ops area. */
export async function fetchNearbyEarthquakes(
  radiusKm = 400,
): Promise<QuakeEvent[]> {
  const res = await fetch(
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson",
  );
  if (!res.ok) {
    throw new Error(`USGS feed failed (${res.status})`);
  }

  const data = (await res.json()) as { features: UsgsFeature[] };
  const { lat: originLat, lng: originLng } = CEBU_AREA.center;

  // Rough PH bounding box
  const inPh = (lat: number, lng: number) =>
    lat >= 4.5 && lat <= 21.5 && lng >= 116 && lng <= 127;

  const events: QuakeEvent[] = [];
  for (const f of data.features) {
    const [lng, lat, depth] = f.geometry.coordinates;
    if (!inPh(lat, lng)) continue;
    const distanceKm = haversineKm(originLat, originLng, lat, lng);
    if (distanceKm > radiusKm) continue;
    events.push({
      id: f.id,
      mag: f.properties.mag,
      place: f.properties.place ?? "Unknown",
      time: f.properties.time,
      lat,
      lng,
      depthKm: typeof depth === "number" ? depth : null,
      url: f.properties.url ?? "",
      distanceKm,
    });
  }

  events.sort((a, b) => a.distanceKm - b.distanceKm);
  return events;
}

export function zoomEarthUrl(lat: number, lng: number, zoom = 11): string {
  return `https://zoom.earth/maps/precipitation/#view=${lat.toFixed(4)},${lng.toFixed(4)},${zoom}z`;
}
