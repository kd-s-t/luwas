export type LandslideSeverity = "watch" | "warning" | "critical";

export type LandslideSample = {
  id: string;
  name: string;
  place: string;
  purokHint: string;
  severity: LandslideSeverity;
  lat: number;
  lng: number;
  reportedAt: string;
  notes: string;
  /** Optional field photo shown in map popup / seeded reports. */
  mediaUrl?: string;
};

/**
 * Landslide samples for Tino During — cleared for the Nangka flood drill
 * (flood wash is the focus; slide pins cluttered the map).
 */
export const CEBU_LANDSLIDE_SAMPLES: LandslideSample[] = [];

export function landslideSeverityLabel(s: LandslideSeverity): string {
  switch (s) {
    case "critical":
      return "Critical";
    case "warning":
      return "Warning";
    default:
      return "Watch";
  }
}
