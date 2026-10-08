import { NextResponse } from "next/server";
import {
  fetchGoogleElevations,
  googleElevationConfigured,
} from "@/lib/geo/googleElevation";

export const runtime = "nodejs";

type Body = {
  locations?: { lat?: number; lng?: number }[];
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("locations")?.trim();
  if (!raw) {
    return NextResponse.json(
      {
        error: "Pass ?locations=lat,lng|lat,lng",
        ready: googleElevationConfigured(),
      },
      { status: 400 },
    );
  }
  const locations = raw.split("|").flatMap((part) => {
    const [latS, lngS] = part.split(",");
    const lat = Number(latS);
    const lng = Number(lngS);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    return [{ lat, lng }];
  });
  return lookup(locations);
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const locations = (body.locations ?? []).flatMap((p) => {
    const lat = Number(p.lat);
    const lng = Number(p.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    return [{ lat, lng }];
  });
  return lookup(locations);
}

async function lookup(locations: { lat: number; lng: number }[]) {
  if (!locations.length) {
    return NextResponse.json({ error: "No valid locations" }, { status: 400 });
  }
  if (locations.length > 100) {
    return NextResponse.json(
      { error: "Max 100 locations per request" },
      { status: 400 },
    );
  }

  const key = process.env.GOOGLE_WEATHER_API_KEY?.trim();
  if (!key) {
    return NextResponse.json(
      { error: "GOOGLE_WEATHER_API_KEY not set", ready: false },
      { status: 503 },
    );
  }

  try {
    const results = await fetchGoogleElevations(key, locations);
    return NextResponse.json({
      provider: "google",
      results: results.map((r) => ({
        lat: r.lat,
        lng: r.lng,
        elevationM: Math.round(r.elevationM * 10) / 10,
        resolutionM: r.resolutionM,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Elevation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
