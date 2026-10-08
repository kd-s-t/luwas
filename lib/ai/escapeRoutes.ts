import type { AssistEscapeRoute, AssistHouseholdAction } from "@/lib/ai/assistTypes";
import {
  bearingDegrees,
  compassLabel,
  distKm,
} from "@/lib/geo/bearing";
import {
  NANGKA_EVAC_CENTERS,
  type SafePoint,
} from "@/lib/geo/safePoints";
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

/** Pick nearest designated evacuation center (not hall / chapel). */
function pickEvacCenter(
  from: { lat: number; lng: number },
  floods: FloodSample[],
  landslides: LandslideSample[],
): SafePoint {
  const centers = NANGKA_EVAC_CENTERS;
  let best = centers[0]!;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const sp of centers) {
    const d = distKm(from, sp);
    const pressure = hazardPressure(sp, floods, landslides);
    const elevBonus = (sp.elevM ?? 0) / 40;
    const score = pressure * 10 + d - elevBonus;
    if (score < bestScore) {
      bestScore = score;
      best = sp;
    }
  }
  return best;
}

/**
 * One escape direction per safe point (not a line per house).
 * Arrow runs from the evacuate cluster centroid → shelter.
 */
export function buildEscapeRoutes(
  actions: AssistHouseholdAction[],
  households: Household[],
  floods: FloodSample[],
  landslides: LandslideSample[],
): AssistEscapeRoute[] {
  const byId = new Map(households.map((h) => [h.id, h]));

  type Bucket = {
    dest: SafePoint;
    points: { lat: number; lng: number }[];
  };
  const buckets = new Map<string, Bucket>();

  if (NANGKA_EVAC_CENTERS.length === 0) return [];

  for (const a of actions) {
    if (a.priority !== "evacuate") continue;
    const h = byId.get(a.householdId);
    if (!h || h.lat == null || h.lng == null) continue;
    const from = { lat: h.lat, lng: h.lng };
    const dest = pickEvacCenter(from, floods, landslides);
    const bucket = buckets.get(dest.id) ?? { dest, points: [] };
    bucket.points.push(from);
    buckets.set(dest.id, bucket);
  }

  const routes: AssistEscapeRoute[] = [];
  for (const [destId, bucket] of buckets) {
    const n = bucket.points.length;
    if (!n) continue;
    const from = {
      lat: bucket.points.reduce((s, p) => s + p.lat, 0) / n,
      lng: bucket.points.reduce((s, p) => s + p.lng, 0) / n,
    };
    const to = { lat: bucket.dest.lat, lng: bucket.dest.lng };
    const bearing = bearingDegrees(from, to);
    const distanceKm = distKm(from, to);
    const direction = compassLabel(bearing);

    routes.push({
      householdId: `escape-dir-${destId}`,
      from,
      to,
      destinationId: destId,
      destinationName: bucket.dest.name,
      bearing,
      direction,
      distanceKm,
      instruction: `Evacuate ${direction} → ${bucket.dest.name} (~${Math.round(bucket.dest.elevM)} m) · ${n} household${n === 1 ? "" : "s"}`,
      path: [from, to],
      routed: false,
    });
  }

  // Prefer primary hall first if multiple destinations.
  return routes.sort((a, b) => a.distanceKm - b.distanceKm);
}
