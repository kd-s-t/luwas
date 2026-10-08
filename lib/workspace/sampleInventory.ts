import type { ReportHazardHint } from "@/lib/reports/types";

/** Small deterministic sample stock for competition MVP demos. */
export type SampleInventoryItem = {
  id: string;
  label: string;
  unit: string;
  available: number;
  hazards: ReportHazardHint[];
};

export const NANGKA_SAMPLE_INVENTORY: SampleInventoryItem[] = [
  {
    id: "evac-kits",
    label: "Evacuation kits",
    unit: "kits",
    available: 12,
    hazards: ["flood", "typhoon", "landslide", "other"],
  },
  {
    id: "rice-sacks",
    label: "Rice sacks (5kg)",
    unit: "sacks",
    available: 40,
    hazards: ["flood", "typhoon", "fire", "other"],
  },
  {
    id: "rescue-boats",
    label: "Rescue boats",
    unit: "boats",
    available: 1,
    hazards: ["flood"],
  },
  {
    id: "first-aid",
    label: "First-aid packs",
    unit: "packs",
    available: 8,
    hazards: ["fire", "landslide", "typhoon", "flood", "other"],
  },
  {
    id: "tarps",
    label: "Tarpaulins",
    unit: "pcs",
    available: 0,
    hazards: ["typhoon", "fire", "other"],
  },
];

export type InventoryMatch = {
  item: SampleInventoryItem;
  requested: number;
  canFulfill: boolean;
  shortfall: number;
};

/** Match a hazard to sample stock; never invents capacity beyond listed stock. */
export function matchInventoryForHazard(
  hazard: ReportHazardHint,
  inventory: SampleInventoryItem[] = NANGKA_SAMPLE_INVENTORY,
): InventoryMatch[] {
  const requested = hazard === "flood" || hazard === "typhoon" ? 2 : 1;
  return inventory
    .filter((item) => item.hazards.includes(hazard))
    .map((item) => {
      const shortfall = Math.max(0, requested - item.available);
      return {
        item,
        requested,
        canFulfill: item.available >= requested,
        shortfall,
      };
    });
}
