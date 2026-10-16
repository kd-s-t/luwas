/** Barangay-owned disaster stock (vehicles, generators, supplies). */

export type InventoryCategory =
  | "vehicle"
  | "generator"
  | "supply"
  | "equipment"
  | "other";

/** Whether the item (or last draw) is out in the field. */
export type InventoryDispatchStatus = "on_hand" | "dispatched";

export type InventoryHistoryKind = "dispatch" | "return";

export type InventoryHistoryEvent = {
  id: string;
  kind: InventoryHistoryKind;
  qty: number;
  byUid: string;
  byName: string;
  at: string;
  note?: string;
};

/** @deprecated Prefer InventoryHistoryEvent; kept for last-dispatch summary. */
export type InventoryDispatch = {
  qty: number;
  byUid: string;
  byName: string;
  at: string;
  note?: string;
};

export type InventoryItemInput = {
  label: string;
  category: InventoryCategory;
  unit: string;
  available: number;
  /** Photo of the physical item (public URL path). */
  imageUrl?: string;
  location?: string;
  notes?: string;
  status?: "active" | "inactive";
};

export type InventoryItem = InventoryItemInput & {
  id: string;
  barangayId: string;
  orgName: string;
  status: "active" | "inactive";
  dispatchStatus: InventoryDispatchStatus;
  /** Newest-first timeline of dispatch / return. */
  history: InventoryHistoryEvent[];
  /** Latest dispatch event (derived); null if never dispatched. */
  lastDispatch: InventoryDispatch | null;
  createdAt: string;
  updatedAt: string;
};

export const INVENTORY_HISTORY_CAP = 50;

export function inventoryCategoryLabel(category: InventoryCategory): string {
  switch (category) {
    case "vehicle":
      return "Vehicle";
    case "generator":
      return "Generator";
    case "supply":
      return "Supply";
    case "equipment":
      return "Equipment";
    default:
      return "Other";
  }
}

export function inventoryDispatchStatusLabel(
  status: InventoryDispatchStatus,
): string {
  return status === "dispatched" ? "Dispatched" : "On hand";
}

export function inventoryHistoryKindLabel(kind: InventoryHistoryKind): string {
  return kind === "return" ? "Returned" : "Dispatched";
}

export function formatInventoryDispatchWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Asia/Manila",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
