export type FireSeverity = "watch" | "warning" | "critical";

export type FireSample = {
  id: string;
  name: string;
  place: string;
  purokHint: string;
  severity: FireSeverity;
  lat: number;
  lng: number;
  reportedAt: string;
  notes: string;
};

export function fireSeverityLabel(s: FireSeverity): string {
  switch (s) {
    case "critical":
      return "Critical";
    case "warning":
      return "Warning";
    default:
      return "Watch";
  }
}
