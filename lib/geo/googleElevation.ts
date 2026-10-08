import type { LatLng } from "@/lib/geo/cebu";

export type ElevationSample = LatLng & {
  elevationM: number;
  resolutionM?: number;
};

type GoogleElevationResponse = {
  status: string;
  error_message?: string;
  results?: {
    elevation: number;
    resolution?: number;
    location: { lat: number; lng: number };
  }[];
};

/** Google Elevation API — server-only (needs Maps key with Elevation enabled). */
export async function fetchGoogleElevations(
  apiKey: string,
  locations: LatLng[],
): Promise<ElevationSample[]> {
  if (!locations.length) return [];

  // API allows up to 512 locations per request; keep batches modest.
  const out: ElevationSample[] = [];
  const chunkSize = 100;
  for (let i = 0; i < locations.length; i += chunkSize) {
    const chunk = locations.slice(i, i + chunkSize);
    const locParam = chunk.map((p) => `${p.lat},${p.lng}`).join("|");
    const url = new URL("https://maps.googleapis.com/maps/api/elevation/json");
    url.searchParams.set("locations", locParam);
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString(), { next: { revalidate: 86_400 } });
    if (!res.ok) {
      throw new Error(`Elevation HTTP ${res.status}`);
    }
    const data = (await res.json()) as GoogleElevationResponse;
    if (data.status !== "OK" || !data.results) {
      throw new Error(
        data.error_message || `Elevation status ${data.status}`,
      );
    }
    for (const r of data.results) {
      out.push({
        lat: r.location.lat,
        lng: r.location.lng,
        elevationM: r.elevation,
        resolutionM: r.resolution,
      });
    }
  }
  return out;
}

export function googleElevationConfigured(): boolean {
  return Boolean(process.env.GOOGLE_WEATHER_API_KEY?.trim());
}
