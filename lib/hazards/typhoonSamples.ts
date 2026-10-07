export type TyphoonCategory =
  | "tropical_depression"
  | "tropical_storm"
  | "severe_tropical_storm"
  | "typhoon"
  | "super_typhoon";

export type TyphoonSample = {
  id: string;
  name: string;
  internationalName: string;
  category: TyphoonCategory;
  /** Approximate center of circulation */
  lat: number;
  lng: number;
  maxWindsKmh: number;
  movement: string;
  distanceKm: number;
  etaNote: string;
  reportedAt: string;
  notes: string;
};

/**
 * Demo tropical cyclone affecting Consolacion / Metro Cebu.
 * Not live PAGASA/JTWC — for command-center demos.
 * Distances measured from Brgy. Nangka hall (~10.371, 123.959).
 */
export const CEBU_TYPHOON_SAMPLES: TyphoonSample[] = [
  {
    id: "ty-basyang-demo",
    name: "Typhoon Basyang (demo)",
    internationalName: "Demo cyclone",
    category: "typhoon",
    lat: 10.55,
    lng: 125.1,
    maxWindsKmh: 140,
    movement: "WNW at 15 km/h",
    distanceKm: 130,
    etaNote: "Closest approach ~18–24 hrs (demo)",
    reportedAt: "2026-10-07T10:00:00+08:00",
    notes:
      "Signal likely over eastern Cebu · prepare evacuation for Purok 4–6 flood zones",
  },
  {
    id: "ty-outer-bands",
    name: "Outer rainbands over Consolacion",
    internationalName: "Basyang feeder band",
    category: "severe_tropical_storm",
    lat: 10.42,
    lng: 124.25,
    maxWindsKmh: 95,
    movement: "West · embedded in outer circulation",
    distanceKm: 32,
    etaNote: "Heavy rain already affecting Nangka (demo)",
    reportedAt: "2026-10-07T13:00:00+08:00",
    notes: "Gusty winds + continuous rain · landslide & flood watch active",
  },
];

export function typhoonCategoryLabel(c: TyphoonCategory): string {
  switch (c) {
    case "super_typhoon":
      return "Super typhoon";
    case "typhoon":
      return "Typhoon";
    case "severe_tropical_storm":
      return "Severe tropical storm";
    case "tropical_storm":
      return "Tropical storm";
    default:
      return "Tropical depression";
  }
}
