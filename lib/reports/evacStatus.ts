import type { SafePoint } from "@/lib/geo/safePoints";
import type { ScenarioReportPin } from "@/lib/scenarios/types";

export type EvacPopulationStatus = {
  reportId: string;
  safePointId: string;
  occupancy: number;
  capacity: number;
  /** open | nearly_full | full | closed */
  fill: "open" | "nearly_full" | "full" | "closed";
  notes: string;
  sourceLabel: string;
  reportedAt: string;
  href?: string;
};

export function evacFillLabel(fill: EvacPopulationStatus["fill"]): string {
  switch (fill) {
    case "closed":
      return "Closed";
    case "full":
      return "Full";
    case "nearly_full":
      return "Nearly full";
    default:
      return "Open";
  }
}

export function computeEvacFill(
  occupancy: number,
  capacity: number,
): EvacPopulationStatus["fill"] {
  if (capacity <= 0) return "open";
  if (occupancy <= 0 && capacity > 0) return "open";
  const ratio = occupancy / capacity;
  if (ratio >= 1) return "full";
  if (ratio >= 0.85) return "nearly_full";
  return "open";
}

function nameLooksLikeSafePoint(pin: ScenarioReportPin, sp: SafePoint): boolean {
  const a = pin.title.toLowerCase();
  const b = sp.name.toLowerCase();
  if (a.includes(b) || b.includes(a.replace(/^ec population ·\s*/i, ""))) {
    return true;
  }
  // "Consolacion Evacuation Center 2" vs title containing "Center 2"
  const short = b
    .replace(/^brgy\.\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return short.length >= 8 && a.includes(short);
}

/** Latest EC population report for a safe point (by safePointId, name, or nearest pin). */
export function evacStatusForSafePoint(
  sp: SafePoint,
  reportPins: ScenarioReportPin[],
): EvacPopulationStatus | null {
  if (!sp.isEvacCenter && sp.kind !== "school" && sp.kind !== "evac_center") {
    return null;
  }

  const candidates = reportPins.filter((p) => p.kind === "evac_status");
  if (candidates.length === 0) return null;

  const byId = candidates.find((p) => p.safePointId === sp.id);
  const byName = candidates.find((p) => nameLooksLikeSafePoint(p, sp));
  const byNear = candidates
    .map((p) => ({
      p,
      d: Math.hypot(p.lat - sp.lat, p.lng - sp.lng),
    }))
    .sort((a, b) => a.d - b.d)[0];

  const pin =
    byId ??
    byName ??
    (byNear && byNear.d <= 0.008 ? byNear.p : undefined);

  if (!pin) return null;

  const occupancy = pin.occupancy ?? 0;
  const capacity = pin.capacity ?? 0;
  return {
    reportId: pin.id,
    safePointId: pin.safePointId ?? sp.id,
    occupancy,
    capacity,
    fill: computeEvacFill(occupancy, capacity),
    notes: pin.notes,
    sourceLabel: pin.sourceLabel,
    reportedAt: pin.reportedAt,
    href: pin.href ?? (pin.mediaUrl ? `/reports/${pin.id}` : undefined),
  };
}

export function formatEvacPopulationLine(s: EvacPopulationStatus): string {
  if (s.capacity > 0) {
    return `${s.occupancy} / ${s.capacity} people · ${evacFillLabel(s.fill)}`;
  }
  return `${s.occupancy} people · ${evacFillLabel(s.fill)}`;
}

/** Compact rows for AI prompts. */
export function compactEvacStatusesForAi(
  safePoints: SafePoint[],
  reportPins: ScenarioReportPin[],
): {
  id: string;
  name: string;
  occupancy: number;
  capacity: number;
  status: string;
  notes: string;
}[] {
  return safePoints
    .filter((s) => s.isEvacCenter)
    .map((s) => {
      const st = evacStatusForSafePoint(s, reportPins);
      return {
        id: s.id,
        name: s.name,
        occupancy: st?.occupancy ?? 0,
        capacity: st?.capacity ?? 0,
        status: st ? evacFillLabel(st.fill) : "no recent report",
        notes: st?.notes ?? "",
      };
    });
}
