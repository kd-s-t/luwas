import { toE164Ph } from "@/lib/alerts/phones";
import {
  respondersForBarangay,
  stationPhoneList,
  type ResponderKind,
  type ResponderStation,
} from "@/lib/geo/responderStations";

/** Station kinds Mangluluwas may dial (never 911 / national hotlines). */
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

/**
 * One primary dialable station per requested kind for the barangay.
 * Skips national hotlines (911).
 */
export function resolveResponderCalls(input: {
  lgu: string;
  barangay: string;
  kinds: ResponderCallKind[];
}): ResolvedResponderCall[] {
  const stations = respondersForBarangay(input.lgu, input.barangay).filter(
    (s) => s.kind !== "hotline",
  );
  const out: ResolvedResponderCall[] = [];

  for (const kind of input.kinds) {
    const candidates = stations.filter((s) => s.kind === kind);
    const station =
      candidates.find((s) => pickStationDialNumber(s)) ?? candidates[0];
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
