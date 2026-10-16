/** Barangay evacuation / shelter directory for officers. */

export type EvacCenterStock = {
  foodPacks: number;
  waterLiters: number;
  blankets: number;
  medicalKits: number;
  /** Free-text extras (generators, mats, etc.). */
  other: string;
};

/** Site condition for sheltering. Flooded / collapsed / unusable = do not send people. */
export type EvacCenterCondition =
  | "usable"
  | "flooded"
  | "collapsed"
  | "unusable";

export const EVAC_CENTER_CONDITIONS: {
  id: EvacCenterCondition;
  label: string;
}[] = [
  { id: "usable", label: "Usable" },
  { id: "flooded", label: "Flooded" },
  { id: "collapsed", label: "Collapsed" },
  { id: "unusable", label: "Unusable" },
];

export function isEvacCenterUnusable(condition: EvacCenterCondition): boolean {
  return condition !== "usable";
}

export function evacConditionLabel(condition: EvacCenterCondition): string {
  return (
    EVAC_CENTER_CONDITIONS.find((c) => c.id === condition)?.label ?? "Usable"
  );
}

export type EvacCenterInput = {
  name: string;
  locationLabel: string;
  lat: number;
  lng: number;
  /** Max people the shelter can hold. */
  maxCapacity: number;
  /** People currently inside. */
  occupancy: number;
  condition?: EvacCenterCondition;
  stock: EvacCenterStock;
  notes?: string;
  open24h?: boolean;
  status?: "active" | "inactive";
};

export type EvacCenter = EvacCenterInput & {
  id: string;
  barangayId: string;
  lgu: string;
  orgName: string;
  condition: EvacCenterCondition;
  status: "active" | "inactive";
  open24h: boolean;
  createdAt: string;
  updatedAt: string;
};

export function asEvacCondition(raw: unknown): EvacCenterCondition {
  if (
    raw === "flooded" ||
    raw === "collapsed" ||
    raw === "unusable" ||
    raw === "usable"
  ) {
    return raw;
  }
  return "usable";
}

export function emptyEvacStock(): EvacCenterStock {
  return {
    foodPacks: 0,
    waterLiters: 0,
    blankets: 0,
    medicalKits: 0,
    other: "",
  };
}

export type EvacStockLineKind =
  | "food"
  | "water"
  | "blankets"
  | "medical"
  | "other";

export type EvacStockLine = {
  kind: EvacStockLineKind;
  label: string;
};

export function evacStockItems(stock: EvacCenterStock): EvacStockLine[] {
  const lines: EvacStockLine[] = [];
  if (stock.foodPacks > 0) {
    lines.push({ kind: "food", label: `${stock.foodPacks} food packs` });
  }
  if (stock.waterLiters > 0) {
    lines.push({ kind: "water", label: `${stock.waterLiters} L water` });
  }
  if (stock.blankets > 0) {
    lines.push({ kind: "blankets", label: `${stock.blankets} blankets` });
  }
  if (stock.medicalKits > 0) {
    lines.push({
      kind: "medical",
      label: `${stock.medicalKits} medical kits`,
    });
  }
  const other = stock.other.trim();
  if (other && !/^open\s*24/i.test(other)) {
    lines.push({ kind: "other", label: other });
  }
  return lines;
}

export function evacStockLines(stock: EvacCenterStock): string[] {
  return evacStockItems(stock).map((item) => item.label);
}

export function formatEvacStock(stock: EvacCenterStock): string {
  const bits = evacStockLines(stock);
  return bits.length > 0 ? bits.join(" · ") : "No stock recorded";
}

export function formatEvacUpdatedAt(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  });
}
