/**
 * Seed catalog of Cebu-area evacuation centers.
 *
 * LUWAS does NOT yet ingest Google Places / a full provincial EC feed.
 * Entries below are only places we can pin with a public coordinate source
 * (Google Places plus-code, OSM, or LGU-published site).
 *
 * Many names from a Google “evacuation center” search (Cordova, Pitogo Liloan,
 * Bantayan, Badian, …) are NOT here until we have lat/lng — do not invent pins.
 */

export type CebuEvacCenter = {
  id: string;
  name: string;
  lgu: string;
  lat: number;
  lng: number;
  /** Public source for the coordinate. */
  source: string;
  open24h?: boolean;
  notes?: string;
};

export const CEBU_EVAC_CENTERS: CebuEvacCenter[] = [
  {
    id: "evac-consolacion-1",
    name: "Consolacion Evacuation Center",
    lgu: "Consolacion",
    lat: 10.370577,
    lng: 123.96926,
    source: "Google Places · plus code 9XC9+CPX · Nangka",
    open24h: true,
  },
  {
    id: "evac-consolacion-2",
    name: "Consolacion Evacuation Center 2",
    lgu: "Consolacion",
    // Same Google Places cluster as Center 1 (~50–80 m; listings ~650 m / ~700 m).
    lat: 10.37105,
    lng: 123.96875,
    source: "Google Places cluster next to 9XC9+CPX (paired municipal EC)",
    open24h: true,
  },
  {
    id: "evac-nangka-elem",
    name: "Nangka Elementary School",
    lgu: "Consolacion",
    lat: 10.3721058,
    lng: 123.9590862,
    source: "OSM Nominatim · LGU Nangka EC list (with barangay gymnasium)",
  },
  {
    id: "evac-cordova",
    name: "Cordova Evacuation Center",
    lgu: "Cordova",
    lat: 10.263237,
    lng: 123.960359,
    source: "Google Places · plus code 7X76+74X",
    notes: "~12 km from Nangka — not a default Nangka escape target",
  },
];

/** ECs useful for Brgy. Nangka escape routing (same LGU / walking distance). */
export const NANGKA_ROUTE_EVAC_CENTERS: CebuEvacCenter[] =
  CEBU_EVAC_CENTERS.filter((e) =>
    ["evac-consolacion-1", "evac-consolacion-2", "evac-nangka-elem"].includes(
      e.id,
    ),
  );
