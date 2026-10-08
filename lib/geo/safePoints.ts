import { CEBU_AREA, type LatLng } from "@/lib/geo/cebu";
import { NANGKA_ROUTE_EVAC_CENTERS } from "@/lib/geo/cebuEvacCenters";

export type SafePointKind = "hall" | "school" | "evac_center" | "landmark";

export type SafePoint = LatLng & {
  id: string;
  name: string;
  kind: SafePointKind;
  notes: string;
  /** Meters above local mean sea level (Google Elevation API). */
  elevM: number;
  /**
   * True only for designated evacuation / shelter destinations.
   * Barangay Hall = command; chapel = landmark — not ECs.
   */
  isEvacCenter: boolean;
};

const ROUTE_ECS: SafePoint[] = NANGKA_ROUTE_EVAC_CENTERS.map((e) => ({
  id: e.id,
  name: e.name,
  kind: e.id.includes("elem") ? ("school" as const) : ("evac_center" as const),
  lat: e.lat,
  lng: e.lng,
  elevM: e.id.includes("elem") ? 26 : 12,
  isEvacCenter: true,
  notes: [e.notes, e.open24h ? "Open 24 hours" : null, `Source: ${e.source}`]
    .filter(Boolean)
    .join(" · "),
}));

/**
 * Ops landmarks + designated ECs for Brgy. Nangka.
 * Escape arrows only target `isEvacCenter` (see cebuEvacCenters.ts).
 */
export const NANGKA_SAFE_POINTS: SafePoint[] = [
  {
    id: "safe-hall",
    name: "Nangka Barangay Hall",
    kind: "hall",
    lat: CEBU_AREA.center.lat,
    lng: CEBU_AREA.center.lng,
    elevM: 26,
    isEvacCenter: false,
    notes: "Command / MDRRMO desk · not an evacuation center",
  },
  ...ROUTE_ECS,
  {
    id: "safe-chapel",
    name: "Sto. Niño Chapel",
    kind: "landmark",
    lat: 10.3710086,
    lng: 123.9593892,
    elevM: 26,
    isEvacCenter: false,
    notes: "Chapel landmark · not an evacuation center",
  },
];

/** Destinations used for escape routing / evacuate arrows. */
export const NANGKA_EVAC_CENTERS: SafePoint[] = NANGKA_SAFE_POINTS.filter(
  (p) => p.isEvacCenter,
);
