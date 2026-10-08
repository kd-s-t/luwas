import type { AssistResult } from "@/lib/ai/assistTypes";
import { enrichActionsWithContacts } from "@/lib/ai/callList";
import { buildEscapeRoutes } from "@/lib/ai/escapeRoutes";
import { distKm } from "@/lib/geo/bearing";
import type { FloodSample } from "@/lib/hazards/floodSamples";
import type { LandslideSample } from "@/lib/hazards/landslideSamples";
import type { TyphoonSample } from "@/lib/hazards/typhoonSamples";
import type { Household } from "@/lib/households/types";

/** Deterministic assist when Gemini API key is not set — still updates the map. */
export function runLocalAssist(input: {
  households: Household[];
  floods: FloodSample[];
  landslides: LandslideSample[];
  typhoons: TyphoonSample[];
  weatherLabel?: string;
}): AssistResult {
  const { households, floods, landslides, typhoons, weatherLabel } = input;
  const criticalFloods = floods.filter((f) => f.severity === "critical");
  const warningFloods = floods.filter((f) => f.severity !== "watch");
  const hotSlides = landslides.filter((l) => l.severity !== "watch");
  const nearestTy = [...typhoons].sort((a, b) => a.distanceKm - b.distanceKm)[0];

  const actions: AssistResult["actions"] = [];

  for (const h of households) {
    if (h.lat == null || h.lng == null) continue;
    const pt = { lat: h.lat, lng: h.lng };

    let nearFlood = false;
    let nearSlide = false;
    let floodDepth = 0;
    for (const f of floods) {
      const d = distKm(pt, f);
      if (d < 0.35) {
        nearFlood = true;
        floodDepth = Math.max(floodDepth, f.depthCm);
      }
    }
    for (const s of landslides) {
      if (distKm(pt, s) < 0.3) nearSlide = true;
    }

    const notes = h.notes.toLowerCase();
    const vulnerable =
      /pwd|elderly|pregnant|infant|flood|surge|no upper/i.test(notes);

    if ((nearFlood && floodDepth >= 40) || (nearFlood && vulnerable)) {
      actions.push({
        householdId: h.id,
        priority: "evacuate",
        reason: nearFlood
          ? `Within flood zone (~${floodDepth} cm) · ${h.purok}`
          : `Vulnerable household in wet zone · ${h.purok}`,
      });
    } else if (nearSlide || nearFlood || vulnerable) {
      actions.push({
        householdId: h.id,
        priority: "prepare",
        reason: nearSlide
          ? `Near landslide sample · ${h.purok}`
          : `Prepare go-bag / monitor · ${h.purok}`,
      });
    } else if (nearestTy && nearestTy.distanceKm < 200) {
      actions.push({
        householdId: h.id,
        priority: "monitor",
        reason: `Typhoon ${nearestTy.name} ~${Math.round(nearestTy.distanceKm)} km · stand by`,
      });
    }
  }

  // All hazard-affected homes (evacuate + prepare). Skip typhoon-only "monitor"
  // so the map/SMS list is every impacted household, not a short demo sample.
  const ranked = [
    ...actions.filter((a) => a.priority === "evacuate"),
    ...actions.filter((a) => a.priority === "prepare"),
  ];

  const escapes = buildEscapeRoutes(ranked, households, floods, landslides);

  const focusHazard =
    criticalFloods.length || warningFloods.length
      ? "flood"
      : hotSlides.length
        ? "landslide"
        : nearestTy
          ? "typhoon"
          : "mixed";

  const evacuateN = ranked.filter((a) => a.priority === "evacuate").length;
  const prepareN = ranked.filter((a) => a.priority === "prepare").length;
  const summary = [
    `AI assist (local rules): focus on ${focusHazard}.`,
    evacuateN || prepareN
      ? `${evacuateN} evacuate · ${prepareN} prepare (all affected households).`
      : "No immediate evacuate/prepare pins from current hazard samples.",
    escapes.length
      ? `${escapes.length} escape direction(s) drawn to nearest safe point.`
      : "",
    weatherLabel ? `Weather: ${weatherLabel}.` : "",
    nearestTy
      ? `${nearestTy.name} ${Math.round(nearestTy.distanceKm)} km out.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    summary,
    focusHazard,
    actions: enrichActionsWithContacts(ranked, households),
    escapes,
    mapHint:
      escapes.length > 0
        ? "Escape lines will follow OSM streets to the nearest safe point."
        : "Highlighted homes need officer follow-up on the map.",
    source: "local",
  };
}
