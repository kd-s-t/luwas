import { elevFloodCellPolygons, nearestLowSpot } from "@/lib/geo/elevFloodFootprint";
import type { FloodSample } from "@/lib/hazards/floodSamples";
import type { TyphoonSample } from "@/lib/hazards/typhoonSamples";

/**
 * AI flood footprint prediction for Nangka.
 * Uses elevation lows + storm intensity (not the static scenario grid).
 * Gemini / local triage both attach this to AssistResult.predictedFloods.
 */
export function predictAiFloods(input: {
  typhoons?: TyphoonSample[];
  source?: "gemini" | "local";
}): FloodSample[] {
  const ty = [...(input.typhoons ?? [])].sort(
    (a, b) => a.distanceKm - b.distanceKm,
  )[0];
  const source = input.source ?? "local";

  // Closer / stronger storm → deeper inundation thresholds.
  const near = ty ? ty.distanceKm < 120 : false;
  const intense =
    ty &&
    (ty.category === "super_typhoon" ||
      ty.category === "typhoon" ||
      ty.maxWindsKmh >= 150);

  const fringeMax = near && intense ? 13 : near ? 12 : 11;
  const coreMax = near && intense ? 9 : near ? 8 : 7;
  const fringeDepth = near && intense ? 55 : near ? 35 : 15;
  const coreDepth = near && intense ? 95 : near ? 70 : 25;
  const fringeSev: FloodSample["severity"] =
    near && intense ? "warning" : "watch";
  const coreSev: FloodSample["severity"] =
    near && intense ? "critical" : near ? "warning" : "watch";

  const fringe = elevFloodCellPolygons(fringeMax);
  const core = elevFloodCellPolygons(coreMax);
  const lowEast = nearestLowSpot({ lat: 10.3684, lng: 123.9661 }, coreMax);
  const lowSouth = nearestLowSpot({ lat: 10.3669, lng: 123.9675 }, coreMax);

  const stormNote = ty
    ? `${ty.name} · ${Math.round(ty.distanceKm)} km · ${ty.maxWindsKmh} km/h`
    : "No active typhoon pin — baseline flood-prone lows";

  return [
    {
      id: "ai-flood-fringe",
      name: "AI flood prediction · fringe",
      place: `Elev ≤ ~${fringeMax} m · ${source === "gemini" ? "Gemini triage" : "local AI rules"}`,
      purokHint: "Purok 5–6 corridor",
      severity: fringeSev,
      lat: lowEast?.lat ?? 10.3684,
      lng: lowEast?.lng ?? 123.9661,
      depthCm: fringeDepth,
      reportedAt: new Date().toISOString(),
      footprints: fringe,
      notes: `Predicted inundation fringe from elevation + storm context. ${stormNote}.`,
    },
    {
      id: "ai-flood-core",
      name: "AI flood prediction · core",
      place: `Elev ≤ ~${coreMax} m · Cansaga lows`,
      purokHint: "Purok 6",
      severity: coreSev,
      lat: lowSouth?.lat ?? 10.3669,
      lng: lowSouth?.lng ?? 123.9675,
      depthCm: coreDepth,
      reportedAt: new Date().toISOString(),
      footprints: core,
      notes: `Predicted core flood belt — first to wet when runoff / river rise hits. ${stormNote}.`,
    },
  ];
}
