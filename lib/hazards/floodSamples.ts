export type FloodSeverity = "watch" | "warning" | "critical";

export type FloodSample = {
  id: string;
  name: string;
  place: string;
  purokHint: string;
  severity: FloodSeverity;
  lat: number;
  lng: number;
  depthCm: number;
  reportedAt: string;
  notes: string;
  /**
   * Optional inundation / flood-prone footprints (closed rings).
   * Prefer elevation cell quads so zones stay in valleys, not on hills.
   */
  footprints?: { lat: number; lng: number }[][];
  /** @deprecated Prefer footprints — single ring if needed. */
  footprint?: { lat: number; lng: number }[];
  /** Soft circle fallback (meters) when no footprint is set. */
  radiusM?: number;
};

/**
 * Flood samples along real Nangka (Consolacion) corridors for the Odette simulation.
 * Not live PAGASA bulletins.
 */
export const CEBU_FLOOD_SAMPLES: FloodSample[] = [
  {
    id: "fl-nangka-east-access",
    name: "Street flood · eastern Access Road",
    place: "Low stretch, Purok 1–6 Access Road (east)",
    purokHint: "Purok 6",
    severity: "critical",
    lat: 10.3684,
    lng: 123.9661,
    depthCm: 85,
    reportedAt: "2026-10-07T14:20:00+08:00",
    notes: "Knee-to-waist deep · single-storey homes advised to move to hall/school",
  },
  {
    id: "fl-nangka-purok-singko",
    name: "Ponding · Purok Singko",
    place: "Drainage clog mid Access Road",
    purokHint: "Purok 5",
    severity: "warning",
    lat: 10.3697,
    lng: 123.9644,
    depthCm: 40,
    reportedAt: "2026-10-07T13:50:00+08:00",
    notes: "Vehicles stalled · keep lane clear for responders",
  },
  {
    id: "fl-nangka-chapel",
    name: "Sheet flood · Holy Family Chapel area",
    place: "Tomas P. Go Road approach",
    purokHint: "Purok 4",
    severity: "warning",
    lat: 10.36855,
    lng: 123.96185,
    depthCm: 35,
    reportedAt: "2026-10-07T13:10:00+08:00",
    notes: "Runoff from upstream · chapel grounds still usable as staging",
  },
  {
    id: "fl-nangka-hall-approach",
    name: "Watch · barangay hall approach",
    place: "Nangka Barangay Hall frontage",
    purokHint: "Purok 1",
    severity: "watch",
    lat: 10.37075,
    lng: 123.95915,
    depthCm: 15,
    reportedAt: "2026-10-07T11:30:00+08:00",
    notes: "Slow drain · keep access clear for command ops",
  },
];

export function floodSeverityLabel(s: FloodSeverity): string {
  switch (s) {
    case "critical":
      return "Critical";
    case "warning":
      return "Warning";
    default:
      return "Watch";
  }
}
