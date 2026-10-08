import type { AssistEscapeRoute, AssistHouseholdAction } from "@/lib/ai/assistTypes";
import {
  bearingDegrees,
  compassLabel,
  distKm,
} from "@/lib/geo/bearing";
import { NANGKA_SAFE_POINTS } from "@/lib/geo/safePoints";
import type { FloodSample } from "@/lib/hazards/floodSamples";
import type { LandslideSample } from "@/lib/hazards/landslideSamples";
import type { Household } from "@/lib/households/types";

function hazardPressure(
  pt: { lat: number; lng: number },
  floods: FloodSample[],
  landslides: LandslideSample[],
): number {
  let score = 0;
  for (const f of floods) {
    const d = distKm(pt, f);
    if (d < 0.25) {
      score += f.severity === "critical" ? 8 : f.severity === "warning" ? 4 : 1;
    }
  }
  for (const s of landslides) {
    const d = distKm(pt, s);
    if (d < 0.25) {
      score += s.severity === "critical" ? 8 : s.severity === "warning" ? 4 : 1;
    }
  }
  return score;
}

function pickSafePoint(
  from: { lat: number; lng: number },
  floods: FloodSample[],
  landslides: LandslideSample[],
) {
  let best = NANGKA_SAFE_POINTS[0];
  let bestScore = Number.POSITIVE_INFINITY;

  for (const sp of NANGKA_SAFE_POINTS) {
    const d = distKm(from, sp);
    const pressure = hazardPressure(sp, floods, landslides);
    // Prefer low hazard, short walk, and higher ground (elevM from Google Elevation).
    const elevBonus = (sp.elevM ?? 0) / 40;
    const score = pressure * 10 + d - elevBonus;
    if (score < bestScore) {
      bestScore = score;
      best = sp;
    }
  }
  return best;
}

/** Build map escape arrows for evacuate/prepare households. */
export function buildEscapeRoutes(
  actions: AssistHouseholdAction[],
  households: Household[],
  floods: FloodSample[],
  landslides: LandslideSample[],
): AssistEscapeRoute[] {
  const byId = new Map(households.map((h) => [h.id, h]));
  const routes: AssistEscapeRoute[] = [];

  for (const a of actions) {
    if (a.priority === "monitor") continue;
    const h = byId.get(a.householdId);
    if (!h || h.lat == null || h.lng == null) continue;

    const from = { lat: h.lat, lng: h.lng };
    const dest = pickSafePoint(from, floods, landslides);
    const bearing = bearingDegrees(from, dest);
    const distanceKm = distKm(from, dest);
    const direction = compassLabel(bearing);

    routes.push({
      householdId: h.id,
      from,
      to: { lat: dest.lat, lng: dest.lng },
      destinationId: dest.id,
      destinationName: dest.name,
      bearing,
      direction,
      distanceKm,
      instruction: `Head ${direction} toward ${dest.name} (~${Math.round(dest.elevM)} m elev · routing roads…)`,
      path: [from, { lat: dest.lat, lng: dest.lng }],
      routed: false,
    });
  }

  return routes;
}
