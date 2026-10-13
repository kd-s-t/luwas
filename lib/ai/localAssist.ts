import type { AssistResult } from "@/lib/ai/assistTypes";
import { enrichActionsWithContacts } from "@/lib/ai/callList";
import { buildEscapeRoutes } from "@/lib/ai/escapeRoutes";
import { predictAiFloods } from "@/lib/ai/predictFloods";
import { distKm } from "@/lib/geo/bearing";
import { pointInFloodFootprints } from "@/lib/geo/elevFloodFootprint";
import { estimateElevM } from "@/lib/geo/nangkaElevation";
import type { FloodSample } from "@/lib/hazards/floodSamples";
import type { LandslideSample } from "@/lib/hazards/landslideSamples";
import type { TyphoonSample } from "@/lib/hazards/typhoonSamples";
import type { Household } from "@/lib/households/types";

/** Align with escapeRoutes / elev flood grid (Google Elevation cache). */
const ELEV_CORE_M = 9;
const ELEV_FRINGE_M = 13;
/** Above this: shelter in place — do not evacuate for flood alone. */
const ELEV_HIGH_M = 14;
/** Only used when a flood sample has no footprint polygons. */
const FLOOD_PIN_PREPARE_KM = 0.2;

function floodFootprintHit(
  pt: { lat: number; lng: number },
  floods: FloodSample[],
): FloodSample | null {
  for (const f of floods) {
    if (pointInFloodFootprints(pt, f.footprints)) return f;
    if (f.footprint?.length && pointInFloodFootprints(pt, [f.footprint])) {
      return f;
    }
  }
  return null;
}

/** Deterministic assist when Gemini API key is not set — still updates the map. */
export function runLocalAssist(input: {
  households: Household[];
  floods: FloodSample[];
  landslides: LandslideSample[];
  typhoons: TyphoonSample[];
  weatherLabel?: string;
  /** When gemini ran triage, tag predicted floods as gemini. */
  floodSource?: "gemini" | "local";
}): AssistResult {
  const { households, landslides, typhoons, weatherLabel } = input;
  const predictedFloods = predictAiFloods({
    typhoons,
    source: input.floodSource ?? "local",
  });
  // Prefer AI footprints for hazard pressure; fall back to scenario pins.
  const floods =
    predictedFloods.length > 0 ? predictedFloods : input.floods;
  const criticalFloods = floods.filter((f) => f.severity === "critical");
  const warningFloods = floods.filter((f) => f.severity !== "watch");
  const hotSlides = landslides.filter((l) => l.severity !== "watch");
  const nearestTy = [...typhoons].sort((a, b) => a.distanceKm - b.distanceKm)[0];
  const floodActive = floods.length > 0;
  const floodsHaveTiles = floods.some(
    (f) => (f.footprints?.length ?? 0) > 0 || Boolean(f.footprint?.length),
  );

  const actions: AssistResult["actions"] = [];

  for (const h of households) {
    if (h.lat == null || h.lng == null) continue;
    const pt = { lat: h.lat, lng: h.lng };
    const elevM = estimateElevM(h.lat, h.lng);
    const elevLabel = `~${Math.round(elevM)} m`;

    const footprint = floodFootprintHit(pt, floods);
    let nearFloodPin = false;
    let floodDepth = footprint?.depthCm ?? 0;
    if (!floodsHaveTiles) {
      for (const f of floods) {
        if (distKm(pt, f) < FLOOD_PIN_PREPARE_KM) {
          nearFloodPin = true;
          floodDepth = Math.max(floodDepth, f.depthCm);
        }
      }
    }

    let nearSlide = false;
    for (const s of landslides) {
      if (distKm(pt, s) < 0.25) nearSlide = true;
    }

    const onCore = elevM <= ELEV_CORE_M;
    const onFringe = elevM <= ELEV_FRINGE_M;
    const onHighGround = elevM >= ELEV_HIGH_M;

    const notes = h.notes.toLowerCase();
    const vulnerable =
      /pwd|elderly|pregnant|infant|flood|surge|no upper/i.test(notes);

    // Landslide cut: still evacuate even on higher lots if next to a slide sample.
    if (nearSlide && (hotSlides.length > 0 || vulnerable)) {
      actions.push({
        householdId: h.id,
        priority: "evacuate",
        reason: `Near landslide sample · ${elevLabel} · ${h.purok}`,
      });
      continue;
    }

    // High ground: shelter in place — never flood-evacuate just for pin proximity.
    if (onHighGround && !footprint && !nearSlide) {
      if (nearestTy || floodActive || vulnerable) {
        actions.push({
          householdId: h.id,
          priority: "prepare",
          reason: `High ground ${elevLabel} · shelter in place · stock water, food, cooking fuel · ${h.purok}`,
        });
      }
      continue;
    }

    // Red: actually inside elev flood tiles, or true low-ground core.
    if (footprint || onCore) {
      actions.push({
        householdId: h.id,
        priority: "evacuate",
        reason: footprint
          ? `Inside AI flood footprint · ${elevLabel} · ${h.purok}`
          : `Low ground ${elevLabel} · flood corridor · ${h.purok}`,
      });
      continue;
    }

    // Yellow: fringe elevation, vulnerable, or (legacy) near pin when no tiles.
    if (onFringe || nearFloodPin || nearSlide || vulnerable) {
      actions.push({
        householdId: h.id,
        priority: "prepare",
        reason: onFringe
          ? `Flood fringe ${elevLabel} · go-bag + water/food stocks · ${h.purok}`
          : nearFloodPin
            ? `Near flood watch (~${floodDepth} cm) · ${elevLabel} · ${h.purok}`
            : nearSlide
              ? `Near landslide sample · ${elevLabel} · ${h.purok}`
              : `Prepare go-bag / stocks · ${elevLabel} · ${h.purok}`,
      });
      continue;
    }

    if (nearestTy && nearestTy.distanceKm < 200) {
      actions.push({
        householdId: h.id,
        priority: "prepare",
        reason: `Typhoon ${nearestTy.name} · ${elevLabel} · stock water, food, fuel · ${h.purok}`,
      });
    }
  }

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
    `Triage focus: ${focusHazard}.`,
    evacuateN
      ? `${evacuateN} evacuate from low ground / flood footprints.`
      : "No low-ground evacuate pins.",
    prepareN
      ? `${prepareN} prepare on higher lots (stock water, food, cooking fuel — shelter in place).`
      : "",
    escapes.length
      ? `Escape direction: ${escapes.map((e) => e.direction + " → " + e.destinationName).join("; ")}.`
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
    predictedFloods,
    mapHint:
      escapes.length > 0
        ? "Flood footprints on map · one escape direction. High lots: stock up."
        : "Flood footprints on map. High-ground homes: shelter in place and stock water/food/fuel.",
    source: input.floodSource ?? "local",
  };
}
