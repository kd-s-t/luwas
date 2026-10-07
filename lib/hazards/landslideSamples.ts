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
};

/**
 * Demo landslide samples on slopes toward Cebu North Road / Nangka edge.
 * Not live MGB events — sample incidents for command-center demos.
 */
export const CEBU_LANDSLIDE_SAMPLES: LandslideSample[] = [
  {
    id: "ls-nangka-north-road",
    name: "Slope crack · toward Cebu North Road",
    place: "Cut slope NW of barangay hall",
    purokHint: "Purok 3",
    severity: "warning",
    lat: 10.3732,
    lng: 123.9574,
    reportedAt: "2026-10-06T08:40:00+08:00",
    notes: "Fresh tension cracks after overnight rain · monitor alley access",
  },
  {
    id: "ls-nangka-cansaga-edge",
    name: "Debris slide · western edge",
    place: "Steep lot near Cansaga / North Road approach",
    purokHint: "Purok 2",
    severity: "critical",
    lat: 10.3742,
    lng: 123.9562,
    reportedAt: "2026-10-07T05:15:00+08:00",
    notes: "Mud/debris reached lane · 2 houses advised to evacuate to hall",
  },
  {
    id: "ls-nangka-school-cut",
    name: "Watch · school hillside cut",
    place: "Retaining area near Nangka Elementary",
    purokHint: "Purok 3",
    severity: "watch",
    lat: 10.3726,
    lng: 123.9585,
    reportedAt: "2026-10-05T16:20:00+08:00",
    notes: "Minor seepage · monitor if rain continues",
  },
  {
    id: "ls-nangka-east-bank",
    name: "Bank failure · eastern drainage",
    place: "Undercut bank, Purok 6 low stretch",
    purokHint: "Purok 6",
    severity: "warning",
    lat: 10.3682,
    lng: 123.9664,
    reportedAt: "2026-10-07T11:05:00+08:00",
    notes: "Bank undercut · flood + slide compound risk",
  },
  {
    id: "ls-nangka-purok-singko",
    name: "Rockfall watch · Purok Singko rise",
    place: "Raised lot above Access Road",
    purokHint: "Purok 5",
    severity: "watch",
    lat: 10.3711,
    lng: 123.9638,
    reportedAt: "2026-10-04T09:00:00+08:00",
    notes: "Loose fill after heavy rain · tanods on standby",
  },
];

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
