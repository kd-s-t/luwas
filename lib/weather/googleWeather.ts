import { CEBU_AREA } from "@/lib/geo/cebu";
import type { AreaWeather } from "@/lib/weather/types";

type GoogleCurrentConditions = {
  currentTime?: string;
  isDaytime?: boolean;
  relativeHumidity?: number;
  weatherCondition?: {
    description?: { text?: string };
    type?: string;
  };
  temperature?: { degrees?: number };
  feelsLikeTemperature?: { degrees?: number };
  precipitation?: {
    qpf?: { quantity?: number };
    probability?: { percent?: number };
  };
  wind?: {
    speed?: { value?: number };
  };
  thunderstormProbability?: number;
};

/** Map Google Weather condition types to WMO-like codes for hazard checks. */
export function googleTypeToWeatherCode(type: string | undefined): number {
  if (!type) return 2;
  const t = type.toUpperCase();

  if (
    t.includes("THUNDER") ||
    t.includes("LIGHTNING") ||
    t === "HAIL" ||
    t.includes("HAIL_")
  ) {
    return 95;
  }
  if (
    t.includes("HEAVY_RAIN") ||
    t.includes("VIOLENT") ||
    t.includes("MODERATE_TO_HEAVY_RAIN") ||
    t.includes("RAIN_PERIODICALLY_HEAVY")
  ) {
    return 65;
  }
  if (
    t.includes("RAIN") ||
    t.includes("SHOWER") ||
    t.includes("DRIZZLE") ||
    t.includes("WIND_AND_RAIN")
  ) {
    return 63;
  }
  if (t.includes("SNOW") || t.includes("SLEET") || t.includes("ICE")) {
    return 73;
  }
  if (t.includes("FOG") || t.includes("HAZE") || t.includes("MIST")) {
    return 45;
  }
  if (t === "CLEAR" || t === "MOSTLY_CLEAR" || t === "SUNNY") return 0;
  if (t === "PARTLY_CLOUDY") return 2;
  if (t === "MOSTLY_CLOUDY" || t === "CLOUDY" || t === "OVERCAST") return 3;
  if (t.includes("WIND")) return 2;
  return 2;
}

export async function fetchGoogleCebuWeather(
  apiKey: string,
): Promise<AreaWeather> {
  const { lat, lng } = CEBU_AREA.center;
  const url = new URL(
    "https://weather.googleapis.com/v1/currentConditions:lookup",
  );
  url.searchParams.set("key", apiKey);
  url.searchParams.set("location.latitude", String(lat));
  url.searchParams.set("location.longitude", String(lng));

  const res = await fetch(url.toString(), { next: { revalidate: 300 } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Google Weather failed (${res.status})${body ? `: ${body.slice(0, 200)}` : ""}`,
    );
  }

  const data = (await res.json()) as GoogleCurrentConditions;
  const type = data.weatherCondition?.type;
  const precipMm = data.precipitation?.qpf?.quantity ?? 0;
  const label =
    data.weatherCondition?.description?.text?.trim() ||
    type?.replaceAll("_", " ").toLowerCase() ||
    "Unknown";

  return {
    temperatureC: data.temperature?.degrees ?? 0,
    feelsLikeC: data.feelsLikeTemperature?.degrees ?? data.temperature?.degrees ?? 0,
    humidity: data.relativeHumidity ?? 0,
    windKmh: data.wind?.speed?.value ?? 0,
    precipitationMm: precipMm,
    weatherCode: googleTypeToWeatherCode(type),
    label,
    isDay: Boolean(data.isDaytime),
    updatedAt: data.currentTime ?? new Date().toISOString(),
    source: "google",
  };
}
