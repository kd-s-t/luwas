/** Browser Maps JavaScript API key (NEXT_PUBLIC_). */
export function googleMapsApiKey(): string {
  return (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "").trim();
}

export function hasGoogleMapsApiKey(): boolean {
  return googleMapsApiKey().length > 0;
}

/**
 * Required for Advanced Markers. DEMO_MAP_ID works without a Cloud Console map style.
 * Override with NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID when you create a real Map ID.
 */
export function googleMapsMapId(): string {
  const id = (process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "").trim();
  return id || "DEMO_MAP_ID";
}
