import { distKm } from "@/lib/geo/bearing";
import { CEBU_AREA, type LatLng } from "@/lib/geo/cebu";
import {
  CEBU_EVAC_CENTERS,
  NANGKA_ROUTE_EVAC_CENTERS,
  type CebuEvacCenter,
} from "@/lib/geo/cebuEvacCenters";
import type { MapArea } from "@/lib/geo/mapAreas";

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

function evacKind(e: CebuEvacCenter): SafePointKind {
  return /elementary|school|high school|academy/i.test(e.name)
    ? "school"
    : "evac_center";
}

export function evacCenterToSafePoint(e: CebuEvacCenter): SafePoint {
  const kind = evacKind(e);
  return {
    id: e.id,
    name: e.name,
    kind,
    lat: e.lat,
    lng: e.lng,
    elevM: kind === "school" ? 26 : 12,
    isEvacCenter: true,
    notes: [e.notes, e.open24h ? "Open 24 hours" : null]
      .filter(Boolean)
      .join(" · "),
  };
}

const ROUTE_ECS: SafePoint[] =
  NANGKA_ROUTE_EVAC_CENTERS.map(evacCenterToSafePoint);

/** Command center pin = barangay hall at map center. */
export function commandHallPoint(area: MapArea): SafePoint {
  return {
    id: `hall-${area.id.replace(/\//g, "-")}`,
    name: `Brgy. ${area.barangay} Hall`,
    kind: "hall",
    lat: area.center.lat,
    lng: area.center.lng,
    elevM: 0,
    isEvacCenter: false,
    notes: "",
  };
}

/**
 * Hall (command) + curated ECs/schools for this barangay’s LGU
 * (or within ~5 km when LGU match is thin).
 */
export function safePointsForArea(area: MapArea, maxKm = 5): SafePoint[] {
  const hall = commandHallPoint(area);
  const byLgu = CEBU_EVAC_CENTERS.filter(
    (e) => e.lgu.toLowerCase() === area.lgu.toLowerCase(),
  );
  const nearby =
    byLgu.length > 0
      ? byLgu
      : CEBU_EVAC_CENTERS.filter(
          (e) => distKm(area.center, { lat: e.lat, lng: e.lng }) <= maxKm,
        );
  return [hall, ...nearby.map(evacCenterToSafePoint)];
}

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
    notes: "",
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
    notes: "",
  },
];

/** Destinations used for escape routing / evacuate arrows. */
export const NANGKA_EVAC_CENTERS: SafePoint[] = NANGKA_SAFE_POINTS.filter(
  (p) => p.isEvacCenter,
);

export function safePointRoleLabel(sp: SafePoint): string {
  if (sp.kind === "hall") return "Command center";
  if (sp.kind === "school") {
    return sp.isEvacCenter ? "School · evacuation shelter" : "School";
  }
  if (sp.kind === "evac_center") return "Evacuation center";
  return "Landmark";
}
