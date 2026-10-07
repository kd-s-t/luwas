import { NextResponse } from "next/server";
import type { LatLng } from "@/lib/geo/cebu";

export const runtime = "nodejs";

type Body = { from: LatLng; to: LatLng };

type OsrmResponse = {
  code: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
  }>;
};

async function queryOsrm(from: LatLng, to: LatLng) {
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  // Prefer foot profile so paths follow walkable streets, not highway shortcuts.
  const urls = [
    `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${coords}?overview=full&geometries=geojson`,
    `https://router.project-osrm.org/route/v1/foot/${coords}?overview=full&geometries=geojson`,
    `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(4_000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as OsrmResponse;
      if (data.code !== "Ok" || !data.routes?.[0]) continue;
      const route = data.routes[0];
      return {
        path: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
        distanceKm: route.distance / 1000,
        durationMin: route.duration / 60,
      };
    } catch {
      // next
    }
  }
  return null;
}

/** Proxy OSM foot routing so the browser is not blocked by CORS. */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    body.from?.lat == null ||
    body.from?.lng == null ||
    body.to?.lat == null ||
    body.to?.lng == null
  ) {
    return NextResponse.json({ error: "from/to required" }, { status: 400 });
  }

  const route = await queryOsrm(body.from, body.to);
  if (!route) {
    return NextResponse.json({ error: "No route" }, { status: 502 });
  }
  return NextResponse.json(route);
}
