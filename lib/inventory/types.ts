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
  /** Linked incident ticket when dispatched for a report. */
  reportId?: string;
};

/** @deprecated Prefer InventoryHistoryEvent; kept for last-dispatch summary. */
export type InventoryDispatch = {
  qty: number;
  byUid: string;
  byName: string;
  at: string;
  note?: string;
  reportId?: string;
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

/** Open dispatch tickets (not yet returned for that report). Newest first. */
export function openDispatchReportIds(
  history: InventoryHistoryEvent[],
): string[] {
  const returned = new Set<string>();
  const open: string[] = [];
  for (const e of history) {
    if (!e.reportId) continue;
    if (e.kind === "return") {
      returned.add(e.reportId);
      continue;
    }
    if (e.kind === "dispatch" && !returned.has(e.reportId) && !open.includes(e.reportId)) {
      open.push(e.reportId);
    }
  }
  return open;
}

/** Units currently out (dispatches minus returns). */
export function netDispatchedQty(history: InventoryHistoryEvent[]): number {
  let n = 0;
  for (const e of [...history].reverse()) {
    if (e.kind === "dispatch") n += e.qty;
    else n = Math.max(0, n - e.qty);
  }
  return n;
}

/** Units still out for one incident ticket (dispatch − return for that reportId). */
export function qtyOutForReport(
  history: InventoryHistoryEvent[],
  reportId: string,
): number {
  let n = 0;
  for (const e of [...history].reverse()) {
    if (e.reportId !== reportId) continue;
    if (e.kind === "dispatch") n += e.qty;
    else n = Math.max(0, n - e.qty);
  }
  return n;
}

export type InventoryAssignedToReport = {
  item: InventoryItem;
  qty: number;
  /** Latest open dispatch event for this report. */
  event: InventoryHistoryEvent;
};

/** Inventory currently assigned / out on this incident ticket. */
export function inventoryAssignedToReport(
  inventory: InventoryItem[],
  reportId: string,
): InventoryAssignedToReport[] {
  const id = reportId.trim();
  if (!id) return [];
  const out: InventoryAssignedToReport[] = [];
  for (const item of inventory) {
    const qty = qtyOutForReport(item.history, id);
    if (qty <= 0) continue;
    const event =
      item.history.find(
        (e) => e.kind === "dispatch" && e.reportId === id,
      ) ?? null;
    if (!event) continue;
    out.push({ item, qty, event });
  }
  return out.sort((a, b) => a.item.label.localeCompare(b.item.label));
}
