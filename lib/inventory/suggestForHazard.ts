import type { InventoryItem } from "@/lib/inventory/types";
import type { ReportHazardHint } from "@/lib/reports/types";

/** Catalog seed ids preferred per hazard (order = suggestion rank). */
const HAZARD_SEED_IDS: Record<ReportHazardHint, string[]> = {
  flood: [
    "rescue-boat",
    "multicab",
    "drinking-water",
    "food-packs",
    "evac-kits",
    "first-aid",
  ],
  typhoon: [
    "chainsaw",
    "tarps",
    "generator-5kva",
    "generator-portable",
    "evac-kits",
    "multicab",
  ],
  landslide: ["multicab", "first-aid", "evac-kits", "chainsaw", "tarps"],
  fire: [
    "first-aid",
    "multicab",
    "drinking-water",
    "generator-portable",
    "tarps",
  ],
  accident: ["first-aid", "multicab"],
  blockage: ["chainsaw", "multicab"],
  evac: [
    "evac-kits",
    "food-packs",
    "drinking-water",
    "multicab",
    "generator-5kva",
  ],
  crime: ["multicab"],
  other: ["multicab", "first-aid", "food-packs", "drinking-water"],
};

export function inventorySeedKey(itemId: string): string {
  const i = itemId.lastIndexOf("__");
  return i >= 0 ? itemId.slice(i + 2) : itemId;
}

export type InventorySuggestion = {
  item: InventoryItem;
  rank: number;
  /** True when local stock cannot cover a unit. */
  short: boolean;
};

/** Rank barangay inventory for this hazard. Proposal only. */
export function suggestInventoryForHazard(
  hazard: ReportHazardHint,
  inventory: InventoryItem[],
  limit = 6,
): InventorySuggestion[] {
  const preferred = HAZARD_SEED_IDS[hazard] ?? HAZARD_SEED_IDS.other;
  const rankOf = new Map(preferred.map((id, i) => [id, i]));

  const scored = inventory
    .map((item) => {
      const key = inventorySeedKey(item.id);
      const byKey = rankOf.get(key);
      const byCategory =
        hazard === "flood" && item.category === "vehicle"
          ? 20
          : hazard === "fire" && item.category === "supply"
            ? 20
            : 50;
      const rank = byKey ?? byCategory;
      return {
        item,
        rank,
        short: item.available <= 0 || item.dispatchStatus === "dispatched",
      };
    })
    .filter((s) => s.rank < 40)
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (a.short !== b.short) return a.short ? 1 : -1;
      return b.item.available - a.item.available;
    });

  return scored.slice(0, limit);
}
