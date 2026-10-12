import type { AssistEscapeRoute, AssistHouseholdAction } from "@/lib/ai/assistTypes";
import {
  bearingDegrees,
  compassLabel,
  distKm,
} from "@/lib/geo/bearing";
import { pointInFloodFootprints } from "@/lib/geo/elevFloodFootprint";
import { estimateElevM } from "@/lib/geo/nangkaElevation";
import {
  NANGKA_EVAC_CENTERS,
  type SafePoint,
} from "@/lib/geo/safePoints";
import type { FloodSample } from "@/lib/hazards/floodSamples";
import type { LandslideSample } from "@/lib/hazards/landslideSamples";
import type { Household } from "@/lib/households/types";

/** Match AI flood fringe / core thresholds used in predictAiFloods (during). */
const ELEV_CORE_M = 9;
const ELEV_FRINGE_M = 13;

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

/**
 * Hazard score at a candidate shelter.
 * Footprint / low-elev hits dominate pin-distance pressure so flooded ECs lose.
 */
function hazardPressure(
  pt: { lat: number; lng: number },
  floods: FloodSample[],
  landslides: LandslideSample[],
): number {
  let score = 0;
  const elevM = estimateElevM(pt.lat, pt.lng);
  const footprint = floodFootprintHit(pt, floods);

  if (footprint) {
    score +=
      footprint.severity === "critical"
        ? 80
        : footprint.severity === "warning"
          ? 50
          : 30;
  } else if (elevM <= ELEV_CORE_M) {
    // Same elev cells the blue grid paints, even if pin centroid is far.
    score += 70;
  } else if (elevM <= ELEV_FRINGE_M) {
    score += 40;
  }

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

function isInundatedShelter(
  pt: { lat: number; lng: number },
  floods: FloodSample[],
): boolean {
  if (floods.length === 0) return false;
  if (floodFootprintHit(pt, floods)) return true;
  return estimateElevM(pt.lat, pt.lng) <= ELEV_FRINGE_M;
}

function scoreEvacCenter(
  from: { lat: number; lng: number },
  sp: SafePoint,
  floods: FloodSample[],
  landslides: LandslideSample[],
): number {
  const d = distKm(from, sp);
  const pressure = hazardPressure(sp, floods, landslides);
  const elevM = estimateElevM(sp.lat, sp.lng);
  const elevBonus = elevM / 40;
  // Flooded / low shelters are never preferred over dry ones on distance alone.
  return pressure * 10 + d - elevBonus;
}

/** Pick nearest dry designated evacuation center (not hall / chapel). */
function pickEvacCenter(
  from: { lat: number; lng: number },
  floods: FloodSample[],
  landslides: LandslideSample[],
): SafePoint {
  const centers = NANGKA_EVAC_CENTERS;
  const dry = centers.filter((sp) => !isInundatedShelter(sp, floods));
  const pool = dry.length > 0 ? dry : centers;

  let best = pool[0]!;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const sp of pool) {
    const score = scoreEvacCenter(from, sp, floods, landslides);
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
    const elevM = Math.round(estimateElevM(bucket.dest.lat, bucket.dest.lng));
    const wetDest = isInundatedShelter(bucket.dest, floods);

    routes.push({
      householdId: `escape-dir-${destId}`,
      from,
      to,
      destinationId: destId,
      destinationName: bucket.dest.name,
      bearing,
      direction,
      distanceKm,
      instruction: wetDest
        ? `Evacuate ${direction} → ${bucket.dest.name} (~${elevM} m · last resort · flood belt) · ${n} household${n === 1 ? "" : "s"}`
        : `Evacuate ${direction} → ${bucket.dest.name} (~${elevM} m · dry shelter) · ${n} household${n === 1 ? "" : "s"}`,
      path: [from, to],
      routed: false,
    });
  }

  // Prefer primary hall first if multiple destinations.
  return routes.sort((a, b) => a.distanceKm - b.distanceKm);
}
