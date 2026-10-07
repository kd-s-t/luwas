import { NextResponse } from "next/server";
import { fetchGoogleCebuWeather } from "@/lib/weather/googleWeather";
import { fetchOpenMeteoCebuWeather } from "@/lib/weather/openMeteo";

export const runtime = "nodejs";

export async function GET() {
  const key = process.env.GOOGLE_WEATHER_API_KEY;

  try {
    if (key) {
      const weather = await fetchGoogleCebuWeather(key);
      return NextResponse.json(weather);
    }

    const weather = await fetchOpenMeteoCebuWeather();
    return NextResponse.json(weather);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Weather unavailable";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
