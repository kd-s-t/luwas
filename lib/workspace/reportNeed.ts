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

/** Shared supply problem for epic grouping on the attention board. */
export type SupplyNeedKind = "water" | "food" | "medical" | "relief";

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

/** Detect a shared supply need so many field reports collapse into one epic. */
export function supplyNeedKind(
  report: Pick<HazardReport, "title" | "notes">,
): SupplyNeedKind | null {
  const blob = `${report.title ?? ""}\n${report.notes ?? ""}`;
  const water =
    /(\d+)\s*L(?:\s+(?:of\s+)?(?:drinking\s+)?water)?|\bdrinking\s+water\b|\bwater\s+shortage\b|\b(?:need|needs|needing)\s+(?:ug\s+)?(?:drinking\s+)?water\b/i.test(
      blob,
    );
  const food =
    /(\d+)\s+food\s+packs?|\bfood\s+shortage\b|\bfood\s+packs?\b/i.test(blob);
  const medical =
    /(\d+)\s+(?:medical\s+)?kits?|\bmedical\s+kits?\b/i.test(blob);
  if (water && !food && !medical) return "water";
  if (food && !water && !medical) return "food";
  if (medical && !water && !food) return "medical";
  if (water || food || medical) return "relief";
  return null;
}

/** Design codes: RS-001 water · RS-002 food · RS-003 medical · RS-004 relief. */
export function supplyNeedEpicCode(kind: SupplyNeedKind): string {
  switch (kind) {
    case "water":
      return "RS-001";
    case "food":
      return "RS-002";
    case "medical":
      return "RS-003";
    case "relief":
      return "RS-004";
  }
}

export function supplyNeedNoun(kind: SupplyNeedKind): string {
  switch (kind) {
    case "water":
      return "Drinking water";
    case "food":
      return "Food packs";
    case "medical":
      return "Medical kits";
    case "relief":
      return "Relief supplies";
  }
}

export function supplyNeedUnit(kind: SupplyNeedKind): string {
  switch (kind) {
    case "water":
      return "L";
    case "food":
      return "packs";
    case "medical":
      return "kits";
    case "relief":
      return "units";
  }
}

/** Sum explicit pack / liter / kit counts across reports that share a need. */
export function aggregateSupplyNeed(reports: HazardReport[]): {
  packs: number;
  waterL: number;
  kits: number;
  neededLabel: string;
} {
  let packs = 0;
  let waterL = 0;
  let kits = 0;
  for (const report of reports) {
    const blob = `${report.title ?? ""}\n${report.notes ?? ""}`;
    const explicit = parseExplicitSupply(blob);
    if (explicit.packs) packs += Number(explicit.packs) || 0;
    if (explicit.water) waterL += Number(explicit.water) || 0;
    if (explicit.kits) kits += Number(explicit.kits) || 0;
  }
  const bits = [
    packs > 0 ? `${packs} packs` : null,
    waterL > 0 ? `${waterL.toLocaleString("en-PH")} L water` : null,
    kits > 0 ? `${kits} kits` : null,
  ].filter(Boolean);
  return {
    packs,
    waterL,
    kits,
    neededLabel: bits.join(" · ") || "Supplies TBD",
  };
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
