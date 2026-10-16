import { toE164Ph } from "@/lib/alerts/phones";
import { distKm } from "@/lib/geo/bearing";
import {
  respondersForBarangay,
  stationPhoneList,
  type ResponderKind,
  type ResponderStation,
} from "@/lib/geo/responderStations";

/** Station kinds Mangugnai may dial (never 911 / national hotlines). */
export type ResponderCallKind = Exclude<ResponderKind, "hotline">;

export type ResolvedResponderCall = {
  kind: ResponderCallKind;
  stationId: string;
  stationName: string;
  phoneDisplay: string;
  to: string;
};

const KIND_LABEL: Record<ResponderCallKind, string> = {
  bfp: "Fire (BFP)",
  pnp: "Police (PNP)",
  hospital: "Hospital",
  tanod: "Barangay / tanod",
};

export function responderKindLabel(kind: ResponderCallKind): string {
  return KIND_LABEL[kind];
}

/** Prefer mobile (Twilio-friendly), then landline. */
export function pickStationDialNumber(
  station: ResponderStation,
): { display: string; e164: string } | null {
  for (const m of station.mobiles ?? []) {
    const e164 = toE164Ph(m);
    if (e164) return { display: m.trim(), e164 };
  }
  for (const p of station.phones ?? []) {
    const e164 = toE164Ph(p);
    if (e164) return { display: p.trim(), e164 };
  }
  // Fallback scan combined list (order mobiles first already covered).
  for (const raw of stationPhoneList(station)) {
    const e164 = toE164Ph(raw);
    if (e164) return { display: raw.trim(), e164 };
  }
  return null;
}

function pickNearestDialable(
  candidates: ResponderStation[],
  near?: { lat: number; lng: number } | null,
): ResponderStation | undefined {
  const dialable = candidates.filter((s) => pickStationDialNumber(s));
  if (dialable.length === 0) return candidates[0];
  if (
    !near ||
    typeof near.lat !== "number" ||
    typeof near.lng !== "number" ||
    !Number.isFinite(near.lat) ||
    !Number.isFinite(near.lng)
  ) {
    return dialable[0];
  }
  let best = dialable[0]!;
  let bestKm = Infinity;
  for (const s of dialable) {
    if (typeof s.lat !== "number" || typeof s.lng !== "number") continue;
    const d = distKm(
      { lat: near.lat, lng: near.lng },
      { lat: s.lat, lng: s.lng },
    );
    if (d < bestKm) {
      bestKm = d;
      best = s;
    }
  }
  return best;
}

/**
 * One primary dialable station per requested kind for the barangay.
 * When `near` is set, prefers the closest station with coords (e.g. BFP).
 * Skips national hotlines (911).
 */
export function resolveResponderCalls(input: {
  lgu: string;
  barangay: string;
  kinds: ResponderCallKind[];
  near?: { lat: number; lng: number } | null;
}): ResolvedResponderCall[] {
  const stations = respondersForBarangay(input.lgu, input.barangay).filter(
    (s) => s.kind !== "hotline",
  );
  const out: ResolvedResponderCall[] = [];

  for (const kind of input.kinds) {
    const candidates = stations.filter((s) => s.kind === kind);
    const station = pickNearestDialable(candidates, input.near);
    if (!station) continue;
    const dial = pickStationDialNumber(station);
    if (!dial) continue;
    out.push({
      kind,
      stationId: station.id,
      stationName: station.name.replace(/\s*\(BFP\)\s*$/i, "").trim(),
      phoneDisplay: dial.display,
      to: dial.e164,
    });
  }

  return out;
}
