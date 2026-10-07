import { NextResponse } from "next/server";
import { fetchGoogleCebuWeather } from "@/lib/weather/googleWeather";
import { fetchOpenMeteoCebuWeather } from "@/lib/weather/openMeteo";
import type { AreaWeather } from "@/lib/weather/types";

export const runtime = "nodejs";

/** Long cache so Google Weather is not billed on every page refresh. */
export const revalidate = 1800;

const CACHE_MS = 30 * 60 * 1000;

type CacheEntry = { at: number; weather: AreaWeather };

declare global {
  // Persist across hot reloads in next dev
  // eslint-disable-next-line no-var
  var __luwasWeatherCache: CacheEntry | undefined;
}

function cacheHeaders() {
  return {
    "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=600",
  };
}

/**
 * Prefer Google Weather when keyed; fall back to free Open-Meteo.
 * In-memory + HTTP cache (~30 min) so refreshes reuse the last payload.
 */
export async function GET() {
  const cached = globalThis.__luwasWeatherCache;
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return NextResponse.json(cached.weather, { headers: cacheHeaders() });
  }

  const key = process.env.GOOGLE_WEATHER_API_KEY;

  try {
    const weather = key
      ? await fetchGoogleCebuWeather(key)
      : await fetchOpenMeteoCebuWeather();

    globalThis.__luwasWeatherCache = { at: Date.now(), weather };
    return NextResponse.json(weather, { headers: cacheHeaders() });
  } catch (err) {
    if (cached) {
      return NextResponse.json(cached.weather, {
        headers: {
          ...cacheHeaders(),
          "X-Weather-Stale": "1",
        },
      });
    }
    const message =
      err instanceof Error ? err.message : "Weather unavailable";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
