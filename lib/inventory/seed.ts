import type { InventoryItemInput } from "@/lib/inventory/types";
import { APAS_BARANGAY_DOC_ID } from "@/lib/staff/apasStaff";
import { NANGKA_BARANGAY_ID } from "@/lib/staff/nangkaStaff";

export type InventorySeedRow = InventoryItemInput & { id: string };

/** Shared disaster-ready catalog; qty varies per barangay. */
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
    notes: "Relief haul and personnel.",
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

/** Scarce by design for Nangka Resources demo. */
const NANGKA_QTY: Record<string, number> = {
  "rescue-boat": 0,
  multicab: 1,
  "generator-5kva": 1,
  "generator-portable": 0,
  "food-packs": 0,
  "drinking-water": 0,
  "first-aid": 0,
  tarps: 4,
  "evac-kits": 0,
  chainsaw: 1,
};

/** Apas starter stock (slightly more on hand). */
const APAS_QTY: Record<string, number> = {
  "rescue-boat": 0,
  multicab: 1,
  "generator-5kva": 2,
  "generator-portable": 1,
  "food-packs": 12,
  "drinking-water": 80,
  "first-aid": 6,
  tarps: 10,
  "evac-kits": 4,
  chainsaw: 1,
};

function rowsFor(
  qty: Record<string, number>,
): InventorySeedRow[] {
  return CATALOG.map((item) => ({
    ...item,
    available: qty[item.id] ?? 0,
    status: "active" as const,
  }));
}

export const INVENTORY_SEEDS_BY_BARANGAY: Record<string, InventorySeedRow[]> = {
  [NANGKA_BARANGAY_ID]: rowsFor(NANGKA_QTY),
  [APAS_BARANGAY_DOC_ID]: rowsFor(APAS_QTY),
};
