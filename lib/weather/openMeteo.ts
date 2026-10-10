import { CEBU_AREA } from "@/lib/geo/cebu";
import type { AreaWeather } from "@/lib/weather/types";

export type { AreaWeather } from "@/lib/weather/types";
export { isHazardousWeather } from "@/lib/weather/types";

const WMO_LABELS: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Slight rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Rain showers",
  81: "Rain showers",
  82: "Violent rain showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Thunderstorm with heavy hail",
};

export function weatherLabel(code: number): string {
  return WMO_LABELS[code] ?? `Code ${code}`;
}

/** Fallback when Google Weather key is unset. */
export async function fetchOpenMeteoCebuWeather(): Promise<AreaWeather> {
  const { lat, lng } = CEBU_AREA.center;
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day",
  );
  url.searchParams.set("timezone", "Asia/Manila");
  url.searchParams.set("wind_speed_unit", "kmh");

  const res = await fetch(url.toString(), { next: { revalidate: 1800 } });
  if (!res.ok) {
    throw new Error(`Weather fetch failed (${res.status})`);
  }

  const data = (await res.json()) as {
    current: {
      temperature_2m: number;
      apparent_temperature: number;
      relative_humidity_2m: number;
      precipitation: number;
      weather_code: number;
      wind_speed_10m: number;
      is_day: number;
      time: string;
    };
  };

  const c = data.current;
  return {
    temperatureC: c.temperature_2m,
    feelsLikeC: c.apparent_temperature,
    humidity: c.relative_humidity_2m,
    windKmh: c.wind_speed_10m,
    precipitationMm: c.precipitation,
    weatherCode: c.weather_code,
    label: weatherLabel(c.weather_code),
    isDay: Boolean(c.is_day),
    updatedAt: c.time,
    source: "open-meteo",
  };
}

/**
 * Client-side helper — hits LUWAS `/api/weather` so the Google key stays server-only.
 */
export async function fetchCebuWeather(): Promise<AreaWeather> {
  // Respect Cache-Control from /api/weather (5 min). Avoid cache: "no-store".
  const res = await fetch("/api/weather");
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(err?.error ?? `Weather fetch failed (${res.status})`);
  }
  return (await res.json()) as AreaWeather;
}
