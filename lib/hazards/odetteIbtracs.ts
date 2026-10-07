import type { TyphoonSample, TyphoonTrackPoint } from "@/lib/hazards/typhoonSamples";

/**
 * Typhoon Odette (international: Rai) — IBTrACS v04r01 best track.
 * SID: 2021346N05145 · WP basin · Dec 2021.
 *
 * Source: NOAA NCEI IBTrACS
 * https://www.ncei.noaa.gov/products/international-best-track-archive
 * CSV: ibtracs.WP.list.v04r01.csv (6-hourly synoptic points, USA 1-min winds).
 *
 * Local name Odette (PAGASA). Landfall sequence included Carcar, Cebu
 * ~16 Dec 2021 22:00 PHT. Consolacion / Nangka were flood-prone and heavily
 * damaged (LGU / news sitreps) — household pins remain demo, track is real.
 */

const KT_TO_KMH = 1.852;

function ktToKmh(kt: number): number {
  return Math.round(kt * KT_TO_KMH);
}

/** 6-hourly USA best-track points from approach through Cebu exit. */
export const ODETTE_IBTRACS_POINTS = [
  { iso: "2021-12-14T00:00:00Z", lat: 7.3, lng: 137.0, usaWindKt: 50, sshs: 0 },
  { iso: "2021-12-14T06:00:00Z", lat: 7.8, lng: 135.8, usaWindKt: 55, sshs: 0 },
  { iso: "2021-12-14T12:00:00Z", lat: 8.2, lng: 134.5, usaWindKt: 60, sshs: 0 },
  { iso: "2021-12-14T18:00:00Z", lat: 8.7, lng: 133.4, usaWindKt: 65, sshs: 1 },
  { iso: "2021-12-15T00:00:00Z", lat: 8.8, lng: 132.3, usaWindKt: 70, sshs: 1 },
  { iso: "2021-12-15T06:00:00Z", lat: 9.0, lng: 131.2, usaWindKt: 75, sshs: 1 },
  { iso: "2021-12-15T12:00:00Z", lat: 9.1, lng: 130.1, usaWindKt: 90, sshs: 2 },
  { iso: "2021-12-15T18:00:00Z", lat: 9.4, lng: 128.9, usaWindKt: 125, sshs: 4 },
  { iso: "2021-12-16T00:00:00Z", lat: 9.7, lng: 127.6, usaWindKt: 150, sshs: 5 },
  { iso: "2021-12-16T06:00:00Z", lat: 10.0, lng: 126.0, usaWindKt: 135, sshs: 4 },
  { iso: "2021-12-16T12:00:00Z", lat: 10.1, lng: 124.2, usaWindKt: 120, sshs: 4 },
  { iso: "2021-12-16T18:00:00Z", lat: 10.1, lng: 122.5, usaWindKt: 110, sshs: 3 },
  { iso: "2021-12-17T00:00:00Z", lat: 10.1, lng: 121.0, usaWindKt: 95, sshs: 2 },
  { iso: "2021-12-17T06:00:00Z", lat: 10.3, lng: 119.9, usaWindKt: 85, sshs: 2 },
  { iso: "2021-12-17T12:00:00Z", lat: 10.4, lng: 118.6, usaWindKt: 90, sshs: 2 },
  { iso: "2021-12-18T00:00:00Z", lat: 10.9, lng: 116.0, usaWindKt: 100, sshs: 3 },
] as const;

export const ODETTE_SOURCE =
  "NOAA IBTrACS v04r01 · SID 2021346N05145 (RAI / Odette) · 6-hourly USA winds";

function labelFor(iso: string, sshs: number): string {
  const local = new Date(iso).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const cat =
    sshs >= 5
      ? "Cat 5"
      : sshs >= 4
        ? "Cat 4"
        : sshs >= 3
          ? "Cat 3"
          : sshs >= 1
            ? `Cat ${sshs}`
            : "TS";
  return `${local} PHT · ${cat}`;
}

export function odetteTrack(): TyphoonTrackPoint[] {
  return ODETTE_IBTRACS_POINTS.map((p) => ({
    lat: p.lat,
    lng: p.lng,
    at: p.iso,
    label: labelFor(p.iso, p.sshs),
  }));
}

/** Haversine km from Nangka hall. */
function distKmToNangka(lat: number, lng: number): number {
  const R = 6371;
  const a = { lat: 10.3708662, lng: 123.9590464 };
  const dLat = ((lat - a.lat) * Math.PI) / 180;
  const dLng = ((lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

type PhaseEye = {
  iso: string;
  lat: number;
  lng: number;
  usaWindKt: number;
  sshs: number;
};

function pointAt(iso: string): PhaseEye {
  const hit = ODETTE_IBTRACS_POINTS.find((p) => p.iso === iso);
  if (!hit) throw new Error(`Odette point missing: ${iso}`);
  return hit;
}

/**
 * Before — 15 Dec 20:00 PHT (12:00 UTC): still east, intensifying toward Visayas.
 * During — 16 Dec 20:00 PHT (12:00 UTC): eye near Bohol/Cebu; Carcar landfall ~2h later.
 * After — 17 Dec 14:00 PHT (06:00 UTC): west of Negros, exiting toward Sulu Sea.
 */
export function odetteTyphoonForPhase(
  phase: "before" | "during" | "after",
): TyphoonSample {
  const track = odetteTrack();
  const eye =
    phase === "before"
      ? pointAt("2021-12-15T12:00:00Z")
      : phase === "during"
        ? pointAt("2021-12-16T12:00:00Z")
        : pointAt("2021-12-17T06:00:00Z");

  const distanceKm = Math.round(distKmToNangka(eye.lat, eye.lng));
  const maxWindsKmh = ktToKmh(eye.usaWindKt);

  if (phase === "before") {
    return {
      id: "ty-odette-before",
      name: "Typhoon Odette (Rai)",
      internationalName: "Rai",
      category: eye.sshs >= 4 ? "super_typhoon" : "typhoon",
      lat: eye.lat,
      lng: eye.lng,
      maxWindsKmh,
      movement: "WNW · approaching Visayas (IBTrACS)",
      distanceKm,
      etaNote: "Historical · ~24–30 hrs before Cebu landfall window",
      reportedAt: eye.iso,
      notes: `${ODETTE_SOURCE}. Pre-landfall snapshot. Consolacion LGU flagged Nangka as flood-prone ahead of Odette.`,
      track,
      windRadiiKm: { gale: 300, storm: 170, typhoon: 90 },
    };
  }

  if (phase === "during") {
    return {
      id: "ty-odette-during",
      name: "Typhoon Odette · eye near Cebu",
      internationalName: "Rai",
      category: "super_typhoon",
      lat: eye.lat,
      lng: eye.lng,
      maxWindsKmh,
      movement: "West · crossing Visayas (IBTrACS)",
      distanceKm,
      etaNote: "Historical · ~2 hrs before Carcar, Cebu landfall (22:00 PHT)",
      reportedAt: eye.iso,
      notes: `${ODETTE_SOURCE}. Peak USA winds earlier same day 150 kt (~${ktToKmh(150)} km/h). Consolacion: thousands of homes damaged (news / DSWD sitreps).`,
      track,
      windRadiiKm: { gale: 280, storm: 150, typhoon: 75 },
    };
  }

  return {
    id: "ty-odette-after",
    name: "Odette · west of Negros",
    internationalName: "Rai",
    category: "typhoon",
    lat: eye.lat,
    lng: eye.lng,
    maxWindsKmh,
    movement: "WNW · exiting toward Sulu Sea (IBTrACS)",
    distanceKm,
    etaNote: "Historical · storm core has passed Metro Cebu",
    reportedAt: eye.iso,
    notes: `${ODETTE_SOURCE}. Recovery focus: welfare checks, debris, residual flood. Track remains the observed Odette path.`,
    track,
    windRadiiKm: { gale: 200, storm: 100, typhoon: 45 },
  };
}
