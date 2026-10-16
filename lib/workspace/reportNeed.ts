import type { HazardReport, ReportHazardHint } from "@/lib/reports/types";
import { hazardHintLabel } from "@/lib/reports/types";
import {
  matchInventoryForHazard,
  NANGKA_SAMPLE_INVENTORY,
} from "@/lib/workspace/sampleInventory";

export type ReportNeedParsed = {
  /** True when local stock for this hazard cannot cover a response. */
  short: boolean;
  /** Human-readable gap from the report itself. */
  detail: string;
  /** e.g. "Ground check", "2 kits", "60 packs · 300 L" */
  neededLabel: string;
  /** e.g. "Households 12" or "Households TBD" */
  householdsLabel: string;
};

function parseExplicitSupply(text: string): {
  packs?: string;
  water?: string;
  kits?: string;
  households?: string;
} {
  const packs = text.match(/(\d+)\s+food\s+packs?/i)?.[1];
  const water = text.match(/(\d+)\s*L(?:\s+water)?/i)?.[1];
  const kits = text.match(/(\d+)\s+(?:medical\s+)?kits?/i)?.[1];
  const households = text.match(/(\d+)\s+households?/i)?.[1];
  return { packs, water, kits, households };
}

function neededFromHazard(hazard: ReportHazardHint): string {
  switch (hazard) {
    case "flood":
      return "Ground check · flood response";
    case "landslide":
      return "Ground check · slope safety";
    case "fire":
      return "Fire response · medical standby";
    case "typhoon":
      return "Wind / debris response";
    case "evac":
      return "Evacuation support";
    case "accident":
      return "Rescue / medical response";
    case "blockage":
      return "Clearance / access restoration";
    default:
      return `${hazardHintLabel(hazard)} response`;
  }
}

function stockShortForHazard(hazard: ReportHazardHint): boolean {
  const matches = matchInventoryForHazard(hazard, NANGKA_SAMPLE_INVENTORY);
  if (matches.some((m) => m.shortfall > 0 || !m.canFulfill)) return true;
  return NANGKA_SAMPLE_INVENTORY.some(
    (i) => i.available === 0 && i.hazards.includes(hazard),
  );
}

/**
 * Build the Resources / Find assistance "selected need" from the report.
 * Uses explicit quantities in notes when present; never invents pack/water counts.
 */
export function parseReportNeed(report: HazardReport): ReportNeedParsed {
  const title = report.title?.trim() ?? "";
  const notes = report.notes?.trim() ?? "";
  const blob = `${title}\n${notes}`;
  const explicit = parseExplicitSupply(blob);
  const short = stockShortForHazard(report.hazardHint);

  const householdsLabel = explicit.households
    ? `Households ${explicit.households}`
    : "Households TBD";

  if (explicit.packs || explicit.water) {
    const bits = [
      explicit.packs ? `${explicit.packs} packs` : null,
      explicit.water ? `${explicit.water} L water` : null,
    ].filter(Boolean);
    return {
      short,
      detail:
        notes ||
        `${bits.join(" + ")} still needed for this incident. Local stock may not cover it.`,
      neededLabel: bits.join(" · "),
      householdsLabel,
    };
  }

  if (explicit.kits) {
    return {
      short,
      detail:
        notes ||
        `${explicit.kits} medical kits still needed. Local kits may not cover it.`,
      neededLabel: `${explicit.kits} kits`,
      householdsLabel,
    };
  }

  const place =
    report.citizenPurok?.trim() ||
    report.locationLabel?.trim() ||
    report.barangay ||
    "Field";

  const detail =
    notes ||
    title ||
    `${hazardHintLabel(report.hazardHint)} reported at ${place}. Confirm response needs on site.`;

  return {
    short,
    detail,
    neededLabel: neededFromHazard(report.hazardHint),
    householdsLabel,
  };
}
