import { NANGKA_ROUTE_EVAC_CENTERS } from "@/lib/geo/cebuEvacCenters";
import type { EvacCenterInput } from "@/lib/evacCenters/types";
import { emptyEvacStock } from "@/lib/evacCenters/types";
import {
  NANGKA_BARANGAY_ID,
  NANGKA_ORG_NAME,
} from "@/lib/staff/nangkaStaff";

export { NANGKA_BARANGAY_ID, NANGKA_ORG_NAME };

/** Human landmark labels (not coordinate provenance). */
const LOCATION_BY_ID: Record<string, string> = {
  "evac-consolacion-1": "Nangka · near Brgy. Hall / Laray Rd",
  "evac-consolacion-2": "Nangka · municipal EC cluster (paired site)",
  "evac-nangka-elem": "Nangka Elementary School · with barangay gym",
};

/** Seed ECs for Brgy. Nangka from the curated Cebu catalog. */
export const NANGKA_EVAC_CENTER_SEED: (EvacCenterInput & {
  id: string;
  lgu: string;
})[] = NANGKA_ROUTE_EVAC_CENTERS.map((e, i) => ({
  id: e.id,
  name: e.name,
  locationLabel: LOCATION_BY_ID[e.id] ?? `Brgy. Nangka · ${e.name}`,
  lat: e.lat,
  lng: e.lng,
  maxCapacity: i === 2 ? 180 : 250,
  occupancy: i === 0 ? 86 : i === 1 ? 42 : 0,
  stock: {
    ...emptyEvacStock(),
    foodPacks: i === 0 ? 120 : 80,
    waterLiters: i === 0 ? 400 : 250,
    blankets: i === 0 ? 60 : 40,
    medicalKits: 4,
    other: "",
  },
  notes: e.notes,
  open24h: Boolean(e.open24h),
  status: "active" as const,
  lgu: e.lgu,
}));
