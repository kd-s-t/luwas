export type AreaWeather = {
  temperatureC: number;
  feelsLikeC: number;
  humidity: number;
  windKmh: number;
  precipitationMm: number;
  weatherCode: number;
  label: string;
  isDay: boolean;
  updatedAt: string;
  source?: "google" | "open-meteo";
};

/** Hazardous for ops: meaningful rain / storms (WMO-style codes or precip). */
export function isHazardousWeather(code: number, precipMm: number): boolean {
  return precipMm >= 2 || code >= 61 || code === 95 || code === 96 || code === 99;
}
