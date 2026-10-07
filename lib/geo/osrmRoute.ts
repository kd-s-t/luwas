import type { AssistEscapeRoute } from "@/lib/ai/assistTypes";
import type { LatLng } from "@/lib/geo/cebu";
import { bearingDegrees, compassLabel } from "@/lib/geo/bearing";

type ProxyRoute = {
  path: LatLng[];
  distanceKm: number;
  durationMin: number;
};

async function fetchViaProxy(from: LatLng, to: LatLng): Promise<ProxyRoute | null> {
  try {
    const res = await fetch("/api/route/escape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to }),
    });
    if (!res.ok) return null;
    return (await res.json()) as ProxyRoute;
  } catch {
    return null;
  }
}

async function enrichOne(escape: AssistEscapeRoute): Promise<AssistEscapeRoute> {
  const road = await fetchViaProxy(escape.from, escape.to);
  if (!road || road.path.length < 2) {
    return escape;
  }

  const midIdx = Math.min(
    road.path.length - 2,
    Math.max(0, Math.floor(road.path.length * 0.55)),
  );
  const bearing = bearingDegrees(road.path[midIdx], road.path[midIdx + 1]);
  const direction = compassLabel(bearing);
  const meters = Math.max(50, Math.round(road.distanceKm * 1000));
  const mins = Math.max(1, Math.round(road.durationMin));

  return {
    ...escape,
    path: road.path,
    bearing,
    direction,
    distanceKm: road.distanceKm,
    routed: true,
    instruction: `Follow roads ${direction} ~${meters} m (~${mins} min walk) → ${escape.destinationName}`,
  };
}

/** Replace crow-flies segments with OSM foot routes (max 3 concurrent). */
export async function enrichEscapesWithRoads(
  escapes: AssistEscapeRoute[],
): Promise<AssistEscapeRoute[]> {
  const out: AssistEscapeRoute[] = new Array(escapes.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(3, escapes.length) }, async () => {
    while (i < escapes.length) {
      const idx = i++;
      out[idx] = await enrichOne(escapes[idx]!);
    }
  });
  await Promise.all(workers);
  return out;
}
