import type {
  InventoryDispatch,
  InventoryDispatchStatus,
  InventoryHistoryEvent,
  InventoryItemInput,
} from "@/lib/inventory/types";
import { QUEUE_SAMPLE_REPORTS } from "@/lib/reports/ensureQueueSampleReports";
import { RESOURCE_SHORTAGE_REPORT_ID } from "@/lib/reports/ensureResourceShortageReport";
import { APAS_BARANGAY_DOC_ID } from "@/lib/staff/apasStaff";
import { NANGKA_BARANGAY_ID } from "@/lib/staff/nangkaStaff";

export type InventorySeedRow = InventoryItemInput & {
  id: string;
  dispatchStatus?: InventoryDispatchStatus;
  lastDispatch?: InventoryDispatch | null;
  history?: InventoryHistoryEvent[];
};

/** Bump to re-apply demo state examples on existing rows. */
export const INVENTORY_DEMO_STATE_VERSION = 5;

/**
 * Real seeded incident tickets (same ids as Incidents board / Resources).
 */
const DEMO_FLOOD_TICKET = RESOURCE_SHORTAGE_REPORT_ID;
const DEMO_TREE_TICKET =
  QUEUE_SAMPLE_REPORTS.find((r) => r.hazardHint === "typhoon")?.id ??
  QUEUE_SAMPLE_REPORTS[2]!.id;
const DEMO_FLOOD_QUEUE_TICKET =
  QUEUE_SAMPLE_REPORTS.find((r) => r.hazardHint === "flood")?.id ??
  QUEUE_SAMPLE_REPORTS[0]!.id;
const DEMO_LANDSLIDE_TICKET =
  QUEUE_SAMPLE_REPORTS.find((r) => r.hazardHint === "landslide")?.id ??
  QUEUE_SAMPLE_REPORTS[1]!.id;

const DEMO_OFFICER = {
  byUid: "demo-inventory-officer",
  byName: "Hon. Ricardo Villanueva",
};

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

/** Shared disaster-ready catalog; qty / state varies per barangay. */
const CATALOG: Omit<InventorySeedRow, "available">[] = [
  {
    id: "rescue-boat",
    label: "Rescue boat",
    category: "vehicle",
    unit: "boats",
    imageUrl: "/inventory/inventory-rescue-boat.jpg",
    location: "Barangay hall compound",
    notes: "Flood response. Confirm crew before deploy.",
  },
  {
    id: "multicab",
    label: "Multicab / utility van",
    category: "vehicle",
    unit: "units",
    imageUrl: "/inventory/inventory-multicab.jpg",
    location: "Hall garage",
    notes: "Fleet of 6 · 3 on hand · 3 out on incident tickets.",
  },
  {
    id: "generator-5kva",
    label: "Generator 5 kVA",
    category: "generator",
    unit: "units",
    imageUrl: "/inventory/inventory-generator-5kva.jpg",
    location: "Supply room",
    notes: "EC / ops backup power.",
  },
  {
    id: "generator-portable",
    label: "Portable generator",
    category: "generator",
    unit: "units",
    imageUrl: "/inventory/inventory-generator-portable.jpg",
    location: "Supply room",
  },
  {
    id: "food-packs",
    label: "Food packs",
    category: "supply",
    unit: "packs",
    imageUrl: "/inventory/inventory-food-packs.jpg",
    location: "Relief store",
  },
  {
    id: "drinking-water",
    label: "Drinking water",
    category: "supply",
    unit: "L",
    imageUrl: "/inventory/inventory-drinking-water.jpg",
    location: "Relief store",
  },
  {
    id: "first-aid",
    label: "First-aid packs",
    category: "supply",
    unit: "packs",
    imageUrl: "/inventory/inventory-first-aid.jpg",
    location: "Clinic cabinet",
  },
  {
    id: "tarps",
    label: "Tarpaulins",
    category: "supply",
    unit: "pcs",
    imageUrl: "/inventory/inventory-tarps.jpg",
    location: "Relief store",
  },
  {
    id: "evac-kits",
    label: "Evacuation kits",
    category: "equipment",
    unit: "kits",
    imageUrl: "/inventory/inventory-evac-kits.jpg",
    location: "Relief store",
  },
  {
    id: "chainsaw",
    label: "Chainsaw",
    category: "equipment",
    unit: "units",
    imageUrl: "/inventory/inventory-chainsaw.jpg",
    location: "Tool shed",
    notes: "Debris / fallen tree clearance.",
  },
];

/**
 * Demo state examples (all status kinds):
 * - On hand · stocked
 * - On hand · short (0)
 * - Dispatched (out)
 * - Returned (on hand + history)
 */
type DemoState = {
  available: number;
  dispatchStatus: InventoryDispatchStatus;
  lastDispatch: InventoryDispatch | null;
  history: InventoryHistoryEvent[];
};

function demoStates(): Record<string, DemoState> {
  const tDispatch = hoursAgo(5);
  const tReturn = hoursAgo(2);
  const tOut = hoursAgo(1);

  return {
    // On hand · stocked
    tarps: {
      available: 4,
      dispatchStatus: "on_hand",
      lastDispatch: null,
      history: [],
    },
    "first-aid": {
      available: 6,
      dispatchStatus: "on_hand",
      lastDispatch: null,
      history: [],
    },
    // On hand · short (empty)
    "rescue-boat": {
      available: 0,
      dispatchStatus: "on_hand",
      lastDispatch: null,
      history: [],
    },
    "food-packs": {
      available: 0,
      dispatchStatus: "on_hand",
      lastDispatch: null,
      history: [],
    },
    "drinking-water": {
      available: 0,
      dispatchStatus: "on_hand",
      lastDispatch: null,
      history: [],
    },
    "evac-kits": {
      available: 0,
      dispatchStatus: "on_hand",
      lastDispatch: null,
      history: [],
    },
    "generator-portable": {
      available: 0,
      dispatchStatus: "on_hand",
      lastDispatch: null,
      history: [],
    },
    // Fleet of 6 vans · 3 on hand · 3 out on different real tickets
    multicab: {
      available: 3,
      dispatchStatus: "dispatched",
      lastDispatch: {
        qty: 1,
        byUid: DEMO_OFFICER.byUid,
        byName: DEMO_OFFICER.byName,
        at: tOut,
        note: "Purok 6 flood response",
        reportId: DEMO_FLOOD_TICKET,
      },
      history: [
        {
          id: `dispatch-${tOut}-a`,
          kind: "dispatch",
          qty: 1,
          byUid: DEMO_OFFICER.byUid,
          byName: DEMO_OFFICER.byName,
          at: tOut,
          note: "Purok 6 flood response",
          reportId: DEMO_FLOOD_TICKET,
        },
        {
          id: `dispatch-${hoursAgo(2)}-b`,
          kind: "dispatch",
          qty: 1,
          byUid: DEMO_OFFICER.byUid,
          byName: DEMO_OFFICER.byName,
          at: hoursAgo(2),
          note: "Access Road flood check",
          reportId: DEMO_FLOOD_QUEUE_TICKET,
        },
        {
          id: `dispatch-${hoursAgo(4)}-c`,
          kind: "dispatch",
          qty: 1,
          byUid: DEMO_OFFICER.byUid,
          byName: DEMO_OFFICER.byName,
          at: hoursAgo(4),
          note: "Hillside path landslide support",
          reportId: DEMO_LANDSLIDE_TICKET,
        },
      ],
    },
    "generator-5kva": {
      available: 0,
      dispatchStatus: "dispatched",
      lastDispatch: {
        qty: 1,
        byUid: DEMO_OFFICER.byUid,
        byName: DEMO_OFFICER.byName,
        at: hoursAgo(3),
        note: "EC Consolacion backup power",
        reportId: DEMO_FLOOD_TICKET,
      },
      history: [
        {
          id: `dispatch-${hoursAgo(3)}`,
          kind: "dispatch",
          qty: 1,
          byUid: DEMO_OFFICER.byUid,
          byName: DEMO_OFFICER.byName,
          at: hoursAgo(3),
          note: "EC Consolacion backup power",
          reportId: DEMO_FLOOD_TICKET,
        },
      ],
    },
    // Returned · on hand again with full timeline
    chainsaw: {
      available: 1,
      dispatchStatus: "on_hand",
      lastDispatch: {
        qty: 1,
        byUid: DEMO_OFFICER.byUid,
        byName: DEMO_OFFICER.byName,
        at: tDispatch,
        note: "Access Road tree clearance",
        reportId: DEMO_TREE_TICKET,
      },
      history: [
        {
          id: `return-${tReturn}`,
          kind: "return",
          qty: 1,
          byUid: DEMO_OFFICER.byUid,
          byName: DEMO_OFFICER.byName,
          at: tReturn,
          note: "Back to tool shed",
          reportId: DEMO_TREE_TICKET,
        },
        {
          id: `dispatch-${tDispatch}`,
          kind: "dispatch",
          qty: 1,
          byUid: DEMO_OFFICER.byUid,
          byName: DEMO_OFFICER.byName,
          at: tDispatch,
          note: "Access Road tree clearance",
          reportId: DEMO_TREE_TICKET,
        },
      ],
    },
  };
}

const APAS_EXTRA_QTY: Record<string, number> = {
  tarps: 10,
  "first-aid": 6,
  "food-packs": 12,
  "drinking-water": 80,
  "evac-kits": 4,
  "generator-portable": 1,
  "rescue-boat": 0,
  // Keep multicab fleet split: 3 on hand · 3 out (do not override).
};

function rowsFor(barangayId: string): InventorySeedRow[] {
  const demos = demoStates();
  return CATALOG.map((item) => {
    const demo = demos[item.id];
    if (demo) {
      const available =
        barangayId === APAS_BARANGAY_DOC_ID &&
        demo.dispatchStatus === "on_hand" &&
        item.id !== "multicab" &&
        APAS_EXTRA_QTY[item.id] != null
          ? APAS_EXTRA_QTY[item.id]!
          : demo.available;
      return {
        ...item,
        available,
        status: "active" as const,
        dispatchStatus: demo.dispatchStatus,
        lastDispatch: demo.lastDispatch,
        history: demo.history,
      };
    }
    return {
      ...item,
      available: 1,
      status: "active" as const,
      dispatchStatus: "on_hand" as const,
      lastDispatch: null,
      history: [],
    };
  });
}

export const INVENTORY_SEEDS_BY_BARANGAY: Record<string, InventorySeedRow[]> = {
  [NANGKA_BARANGAY_ID]: rowsFor(NANGKA_BARANGAY_ID),
  [APAS_BARANGAY_DOC_ID]: rowsFor(APAS_BARANGAY_DOC_ID),
};

/** Status legend chips for the Inventory desk. */
export const INVENTORY_STATE_EXAMPLES = [
  {
    id: "on_hand",
    label: "On hand",
    detail: "In store · ready to dispatch",
    tone: "ok" as const,
  },
  {
    id: "short",
    label: "Short",
    detail: "0 on hand · add stock or find assistance",
    tone: "warn" as const,
  },
  {
    id: "dispatched",
    label: "Dispatched",
    detail: "Out in the field · who + when in history",
    tone: "out" as const,
  },
  {
    id: "returned",
    label: "Returned",
    detail: "Back on hand · timeline kept",
    tone: "ok" as const,
  },
] as const;
