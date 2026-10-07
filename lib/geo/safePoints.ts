import { CEBU_AREA, type LatLng } from "@/lib/geo/cebu";

export type SafePoint = LatLng & {
  id: string;
  name: string;
  kind: "hall" | "shelter" | "school";
  notes: string;
};

/**
 * Evacuation / assembly points in Brgy. Nangka, Consolacion.
 * Coordinates from OpenStreetMap Nominatim (hall, elementary, chapel).
 */
export const NANGKA_SAFE_POINTS: SafePoint[] = [
  {
    id: "safe-hall",
    name: "Nangka Barangay Hall",
    kind: "hall",
    lat: CEBU_AREA.center.lat,
    lng: CEBU_AREA.center.lng,
    notes: "Primary command / assembly · Purok 1–6 Access Road",
  },
  {
    id: "safe-elem",
    name: "Nangka Elementary School",
    kind: "school",
    lat: 10.3721058,
    lng: 123.9590862,
    notes: "DepEd campus · Purok Uno staging (OSM)",
  },
  {
    id: "safe-chapel",
    name: "Sto. Niño Chapel staging",
    kind: "shelter",
    lat: 10.3710086,
    lng: 123.9593892,
    notes: "Chapel grounds near barangay hall (OSM)",
  },
];
