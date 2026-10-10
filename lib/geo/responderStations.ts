import { distKm } from "@/lib/geo/bearing";
import { slugify } from "@/lib/geo/cebuBarangays";
import type { MapArea } from "@/lib/geo/mapAreas";

/**
 * Nearby emergency responders for Cebu barangays.
 *
 * PNP / BFP are usually city or municipal stations that cover many barangays.
 * A barangay may also have a tanod outpost or community precinct — not always.
 *
 * Contact numbers are curated from public LGU / hotline directories (see
 * `source` on each station). Verify before operational use — numbers change.
 */

export type ResponderKind = "hotline" | "pnp" | "bfp" | "hospital" | "tanod";

export type ResponderStation = {
  id: string;
  kind: ResponderKind;
  name: string;
  /** Where the facility sits (barangay / area within the LGU). */
  seat: string;
  /** Short coverage note for residents. */
  covers: string;
  notes?: string;
  /** Landline(s), display form e.g. "(032) 346-2847" */
  phones?: string[];
  /** Mobile / globe / smart hotlines */
  mobiles?: string[];
  email?: string;
  address?: string;
  /** Map pin when known (approx public listing). */
  lat?: number;
  lng?: number;
  /** Where the contact was taken from (for audit). */
  source?: string;
};

/** Map pin for BFP / hospital (shown on every barangay situation map). */
export type ResponderMapPin = {
  id: string;
  kind: "bfp" | "hospital";
  name: string;
  lat: number;
  lng: number;
  phones: string[];
  seat: string;
  covers: string;
  notes?: string;
};

/** Approximate LGU seat when a station has no explicit lat/lng. */
const LGU_MAP_CENTER: Record<string, { lat: number; lng: number }> = {
  consolacion: { lat: 10.3765, lng: 123.9582 },
  "cebu-city": { lat: 10.3157, lng: 123.8854 },
  "mandaue-city": { lat: 10.3231, lng: 123.9223 },
  "lapu-lapu-city": { lat: 10.3103, lng: 123.9494 },
  talisay: { lat: 10.2447, lng: 123.8494 },
  naga: { lat: 10.2089, lng: 123.7581 },
  carcar: { lat: 10.1061, lng: 123.6402 },
  danao: { lat: 10.5208, lng: 124.0271 },
  toledo: { lat: 10.3773, lng: 123.6386 },
  bogo: { lat: 11.0487, lng: 124.0054 },
  liloan: { lat: 10.3991, lng: 123.9992 },
  minglanilla: { lat: 10.245, lng: 123.796 },
  compostela: { lat: 10.455, lng: 124.012 },
  cordova: { lat: 10.2632, lng: 123.9604 },
};

type StationInput = Omit<ResponderStation, "id" | "kind">;

type LguStations = {
  pnp: StationInput[];
  bfp: StationInput[];
  /** Hospitals / RHUs with public ER or desk lines */
  hospitals?: StationInput[];
  /** Barangay slug → local tanod / community outposts */
  tanodByBarangay?: Record<string, StationInput[]>;
};

/** Curated stations for metro / ops-focus LGUs. */
const CURATED: Record<string, LguStations> = {
  consolacion: {
    pnp: [
      {
        name: "Consolacion Municipal Police Station",
        seat: "Poblacion Oriental",
        covers: "All Consolacion barangays",
        address: "Old Municipal Hall, M. Pepito St, Consolacion, Cebu 6001",
        phones: ["(032) 346-2847", "(032) 349-6543", "(032) 423-7028"],
        mobiles: ["0998 598 6391"],
        notes: "PNP · municipal station (not one per barangay) · open 24h",
        source:
          "Consolacion LGU directory + Pulpogan barangay hotlines + public listings",
      },
      {
        name: "Consolacion Police Community Precinct · Tayud",
        seat: "Tayud",
        covers: "Eastern barangays (Tayud, Pitogo, Polog, nearby)",
        notes:
          "Community precinct · supports municipal PS · call Consolacion MPS if no local line",
        phones: ["(032) 346-2847"],
        source: "Routes through Consolacion MPS hotline",
      },
    ],
    bfp: [
      {
        name: "Consolacion Fire Station (BFP)",
        seat: "Poblacion Occidental",
        covers: "All Consolacion barangays",
        phones: ["(032) 344-8299", "(032) 423-5053"],
        mobiles: ["0954 193 9101"],
        lat: 10.3768,
        lng: 123.9571,
        notes: "BFP · one municipal fire station for the whole LGU",
        source: "Consolacion LGU directory + Pulpogan barangay hotlines",
      },
    ],
    hospitals: [
      {
        name: "Mendero Medical Center",
        seat: "Pitogo",
        covers: "Consolacion and north Cebu corridor · tertiary hospital",
        address: "Cebu North Road / A. Tan St, Brgy. Pitogo, Consolacion, Cebu",
        phones: [
          "(032) 236-0091",
          "(032) 239-4356",
          "(032) 239-7151",
          "(032) 239-7152",
        ],
        lat: 10.3628,
        lng: 123.9815,
        notes: "Private hospital · ER / admissions",
        source: "CDN / Yellow Pages PH / PhilHealth Konsulta listings",
      },
      {
        name: "Consolacion Municipal Health Center / RHU",
        seat: "Poblacion (Central Nautical Hwy)",
        covers: "Municipal primary care · not a full tertiary ER",
        address: "Central Nautical Hwy, Consolacion, Cebu 6001",
        phones: ["(032) 231-7105"],
        lat: 10.3775,
        lng: 123.9598,
        notes: "LGU health center · dial 911 for life-threatening emergencies",
        source: "Public place listings (verify with Municipal Health Office)",
      },
    ],
    tanodByBarangay: {
      nangka: [
        {
          name: "Nangka Barangay Hall",
          seat: "Nangka",
          covers: "Brgy. Nangka puroks · hall / tanod desk",
          notes:
            "Barangay command desk · escalate life threats to Consolacion MPS / 911",
          phones: ["(032) 346-2847"],
          source: "Escalates to Consolacion MPS",
        },
      ],
      tayud: [
        {
          name: "Tayud Barangay Tanod Outpost",
          seat: "Tayud",
          covers: "Brgy. Tayud",
          notes: "Coordinates with Consolacion MPS / PCP Tayud",
          phones: ["(032) 346-2847"],
          source: "Escalates to Consolacion MPS",
        },
      ],
      pulpogan: [
        {
          name: "Pulpogan Barangay Hall / Tanod",
          seat: "Pulpogan",
          covers: "Brgy. Pulpogan",
          phones: ["(032) 326-8113"],
          email: "barangaypulpogan@gmail.com",
          notes: "Barangay contact · not a PNP station",
          source: "pulpoganconsolacion.com contact page",
        },
      ],
      "poblacion-oriental": [
        {
          name: "Poblacion Oriental Tanod Desk",
          seat: "Poblacion Oriental",
          covers: "Poblacion Oriental",
          notes: "Near municipal compound",
          phones: ["(032) 346-2847"],
          source: "Escalates to Consolacion MPS",
        },
      ],
    },
  },
  "cebu-city": {
    pnp: [
      {
        name: "Cebu City Police Office (CCPO)",
        seat: "Camp Sotero Cabahug, Gorordo Ave",
        covers: "Citywide command · precincts below",
        address: "Camp Sotero Cabahug, Gorordo Ave, Cebu City 6000",
        phones: ["(032) 233-6795", "(032) 233-0762"],
        notes: "PNP · city police office · emergency also 911 / 166",
        source: "Public CCPO / PRO-7 directories",
      },
      {
        name: "Police Station 1 · Parian / Downtown",
        seat: "Parian",
        covers: "Downtown / port-side barangays",
        phones: ["(032) 254-5002", "(032) 255-8404"],
        mobiles: ["0916 421 6215"],
        source: "Cebu City police station directory (public listings)",
      },
      {
        name: "Police Station 3 · Waterfront",
        seat: "Waterfront / north reclamation",
        covers: "Waterfront corridor barangays",
        phones: ["(032) 254-8968"],
        source: "Cebu City police station directory (public listings)",
      },
      {
        name: "Police Station 4 · Mabolo",
        seat: "Mabolo",
        covers: "Mabolo, nearby north districts",
        phones: ["(032) 412-8262"],
        source: "Cebu City police station directory (public listings)",
      },
      {
        name: "Police Station 6 · San Nicolas",
        seat: "San Nicolas",
        covers: "San Nicolas and adjacent barangays",
        phones: ["(032) 261-9788"],
        source: "Cebu City police station directory (public listings)",
      },
      {
        name: "Police Station 8 · Talamban",
        seat: "Talamban",
        covers: "Talamban and northern mountain barangays",
        phones: ["(032) 344-7400"],
        source: "Cebu City police station directory (public listings)",
      },
      {
        name: "Cebu Police Provincial Office (CPPO)",
        seat: "Lahug / Sudlon",
        covers: "Provincial coordination (not a barangay precinct)",
        address: "Doña Modesta Gaisano St, Sudlon, Lahug, Cebu City",
        phones: ["(032) 236-8685", "(032) 256-0116", "(032) 256-0117"],
        mobiles: ["0916 971 8869", "0917 305 7740"],
        notes: "Provincial office · use city stations for local emergencies",
        source: "CPPO public listings",
      },
    ],
    bfp: [
      {
        name: "Cebu City Fire Station (BFP)",
        seat: "Cebu City",
        covers: "Citywide · sub-stations by district",
        phones: ["(032) 256-0541"],
        lat: 10.3092,
        lng: 123.8934,
        notes: "BFP · dial 911 for fire emergencies",
        source: "Public BFP / Cebu emergency hotline lists",
      },
      {
        name: "BFP Sub-Station · Mabolo / North",
        seat: "Mabolo area",
        covers: "Northern urban barangays",
        phones: ["(032) 256-0541"],
        lat: 10.3275,
        lng: 123.9158,
        notes: "Sub-station · confirm via Cebu City Fire Office if no answer",
        source: "Coverage note · city BFP network",
      },
    ],
    hospitals: [
      {
        name: "Vicente Sotto Memorial Medical Center (VSMMC)",
        seat: "Sambag II",
        covers: "DOH tertiary / trauma referral · citywide & region",
        address: "B. Rodriguez St, Sambag II, Cebu City 6000",
        phones: ["(032) 253-9891", "(032) 382-5514"],
        mobiles: ["0949 886 5964", "0920 970 7617"],
        lat: 10.3086,
        lng: 123.8917,
        notes: "Public tertiary · ER · also dial 911 for medical dispatch",
        source: "DOH-7 emergency directory / VSMMC public contacts",
      },
      {
        name: "Cebu City Medical Center",
        seat: "Cebu City",
        covers: "City public hospital · trauma / IM desks",
        phones: ["(032) 254-1058", "(032) 516-3934"],
        mobiles: ["0943 340 2070"],
        lat: 10.2958,
        lng: 123.8972,
        notes: "Public city hospital · ER desk",
        source: "Sugbo.ph hospital hotline list (public, verify)",
      },
    ],
  },
  "mandaue-city": {
    pnp: [
      {
        name: "Mandaue City Police Office (MCPO)",
        seat: "Centro",
        covers: "All Mandaue barangays",
        phones: ["(032) 344-3364", "(032) 344-8466", "(032) 344-1200"],
        mobiles: ["0928 890 7047"],
        notes: "PNP · city station with precinct support",
        source: "mandauecity.gov.ph emergency hotlines",
      },
      {
        name: "Mandaue Police Station 1",
        seat: "Centro / PS-1 area",
        covers: "Central precinct barangays",
        phones: ["(032) 239-8754"],
        source: "mandauecity.gov.ph emergency hotlines",
      },
      {
        name: "Mandaue Police Station 2",
        seat: "PS-2 area",
        covers: "Station 2 coverage",
        phones: ["(032) 328-0673"],
        source: "mandauecity.gov.ph emergency hotlines",
      },
      {
        name: "Mandaue Police Station 3",
        seat: "PS-3 area",
        covers: "Station 3 coverage",
        phones: ["(032) 239-8752"],
        source: "mandauecity.gov.ph emergency hotlines",
      },
      {
        name: "Mandaue PCP · Tipolo / North Reclamation",
        seat: "Tipolo",
        covers: "Tipolo, Banilad edge, NRH corridor",
        phones: ["(032) 344-3364"],
        notes: "Community precinct · use MCPO if local line busy",
        source: "Routes through MCPO hotline",
      },
    ],
    bfp: [
      {
        name: "Mandaue City Fire Station (BFP)",
        seat: "Centro",
        covers: "All Mandaue barangays",
        phones: ["(032) 344-4747", "(032) 344-3364"],
        lat: 10.3231,
        lng: 123.9223,
        source: "mandauecity.gov.ph emergency hotlines",
      },
    ],
    hospitals: [
      {
        name: "Mandaue City Hospital / City Health network",
        seat: "Mandaue City",
        covers: "City public health · escalate trauma to tertiary hospitals",
        phones: ["911"],
        lat: 10.3255,
        lng: 123.925,
        notes: "Use 911 for ambulance / trauma · confirm desk with LGU",
        source: "Fallback · verify with Mandaue CHO",
      },
    ],
  },
  "lapu-lapu-city": {
    pnp: [
      {
        name: "Lapu-Lapu City Police Station",
        seat: "Poblacion",
        covers: "Mactan island barangays",
        phones: ["(032) 341-1311"],
        notes: "PNP · city station · also dial 911",
        source: "Public Lapu-Lapu emergency hotline lists",
      },
      {
        name: "PCP · Mactan–Cebu Airport corridor",
        seat: "Basak / airport area",
        covers: "Airport-adjacent barangays",
        phones: ["(032) 341-1311"],
        notes: "Supports city PS · confirm local desk via main station",
        source: "Routes through Lapu-Lapu CPS",
      },
    ],
    bfp: [
      {
        name: "Lapu-Lapu City Fire Station (BFP)",
        seat: "Poblacion",
        covers: "All Lapu-Lapu barangays",
        phones: ["(032) 340-0252"],
        lat: 10.3103,
        lng: 123.9494,
        source: "Public Lapu-Lapu emergency hotline lists",
      },
    ],
    hospitals: [
      {
        name: "Lapu-Lapu City Hospital / Mactan medical desks",
        seat: "Poblacion / Mactan",
        covers: "Island residents · major trauma may transfer to Cebu City",
        phones: ["911", "(032) 340-0252"],
        lat: 10.312,
        lng: 123.951,
        notes: "Dial 911 for medical emergencies",
        source: "Public emergency lists · verify locally",
      },
    ],
  },
  talisay: {
    pnp: [
      {
        name: "Talisay City Police Station",
        seat: "Poblacion",
        covers: "All Talisay barangays",
        notes: "PNP · verify current desk line with city hall / 911",
      },
    ],
    bfp: [
      {
        name: "Talisay City Fire Station (BFP)",
        seat: "Poblacion",
        covers: "All Talisay barangays",
      },
    ],
  },
  liloan: {
    pnp: [
      {
        name: "Liloan Municipal Police Station",
        seat: "Poblacion",
        covers: "All Liloan barangays",
      },
    ],
    bfp: [
      {
        name: "Liloan Fire Station (BFP)",
        seat: "Poblacion",
        covers: "All Liloan barangays",
      },
    ],
  },
  minglanilla: {
    pnp: [
      {
        name: "Minglanilla Municipal Police Station",
        seat: "Poblacion",
        covers: "All Minglanilla barangays",
      },
    ],
    bfp: [
      {
        name: "Minglanilla Fire Station (BFP)",
        seat: "Poblacion",
        covers: "All Minglanilla barangays",
      },
    ],
  },
  compostela: {
    pnp: [
      {
        name: "Compostela Municipal Police Station",
        seat: "Poblacion",
        covers: "All Compostela barangays",
      },
    ],
    bfp: [
      {
        name: "Compostela Fire Station (BFP)",
        seat: "Poblacion",
        covers: "All Compostela barangays",
      },
    ],
  },
  cordova: {
    pnp: [
      {
        name: "Cordova Municipal Police Station",
        seat: "Poblacion",
        covers: "All Cordova barangays",
      },
    ],
    bfp: [
      {
        name: "Cordova Fire Station (BFP)",
        seat: "Poblacion",
        covers: "All Cordova barangays",
      },
    ],
  },
  naga: {
    pnp: [
      {
        name: "City of Naga Police Station",
        seat: "Poblacion",
        covers: "All Naga barangays",
      },
    ],
    bfp: [
      {
        name: "City of Naga Fire Station (BFP)",
        seat: "Poblacion",
        covers: "All Naga barangays",
      },
    ],
  },
  danao: {
    pnp: [
      {
        name: "Danao City Police Station",
        seat: "Poblacion",
        covers: "All Danao barangays",
      },
    ],
    bfp: [
      {
        name: "Danao City Fire Station (BFP)",
        seat: "Poblacion",
        covers: "All Danao barangays",
      },
    ],
  },
  toledo: {
    pnp: [
      {
        name: "Toledo City Police Station",
        seat: "Poblacion",
        covers: "All Toledo barangays",
      },
    ],
    bfp: [
      {
        name: "Toledo City Fire Station (BFP)",
        seat: "Poblacion",
        covers: "All Toledo barangays",
      },
    ],
  },
  carcar: {
    pnp: [
      {
        name: "Carcar City Police Station",
        seat: "Poblacion",
        covers: "All Carcar barangays",
      },
    ],
    bfp: [
      {
        name: "Carcar City Fire Station (BFP)",
        seat: "Poblacion",
        covers: "All Carcar barangays",
      },
    ],
  },
  bogo: {
    pnp: [
      {
        name: "Bogo City Police Station",
        seat: "Poblacion",
        covers: "All Bogo barangays",
      },
    ],
    bfp: [
      {
        name: "Bogo City Fire Station (BFP)",
        seat: "Poblacion",
        covers: "All Bogo barangays",
      },
    ],
  },
};

/** Shared national / regional lines shown with every LGU pack. */
export const UNIVERSAL_EMERGENCY_LINES: StationInput[] = [
  {
    name: "National Emergency Hotline",
    seat: "Nationwide",
    covers: "Police · fire · medical dispatch",
    phones: ["911"],
    notes: "Primary emergency number in the Philippines",
    source: "National emergency hotline",
  },
];

function defaultStations(lguName: string): LguStations {
  const kindWord = /city/i.test(lguName) ? "City" : "Municipal";
  return {
    pnp: [
      {
        name: `${lguName} ${kindWord} Police Station`,
        seat: "Poblacion",
        covers: `All ${lguName} barangays`,
        phones: ["911"],
        notes:
          "PNP · typical city/municipal station · public desk line not yet verified; dial 911 in emergencies",
        source: "Fallback · contact not yet curated",
      },
    ],
    bfp: [
      {
        name: `${lguName} Fire Station (BFP)`,
        seat: "Poblacion",
        covers: `All ${lguName} barangays`,
        phones: ["911"],
        notes: "BFP · dial 911 for fire emergencies if local line unknown",
        source: "Fallback · contact not yet curated",
      },
    ],
  };
}

function withIds(
  kind: ResponderKind,
  lguSlug: string,
  rows: StationInput[],
  suffix = "",
): ResponderStation[] {
  return rows.map((row, i) => ({
    ...row,
    kind,
    id: `${lguSlug}-${kind}${suffix}-${i + 1}`,
  }));
}

export function responderKindLabel(kind: ResponderKind): string {
  switch (kind) {
    case "hotline":
      return "Emergency hotline";
    case "pnp":
      return "Police (PNP)";
    case "bfp":
      return "Fire (BFP)";
    case "hospital":
      return "Hospital / health";
    case "tanod":
      return "Barangay tanod";
  }
}

/** Digits-only for tel: links (keeps leading 0 for PH mobiles). */
export function phoneToTelHref(display: string): string {
  const digits = display.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return `tel:${digits}`;
  if (digits.startsWith("63") && digits.length >= 11) return `tel:+${digits}`;
  if (digits.startsWith("0")) return `tel:+63${digits.slice(1)}`;
  if (digits === "911" || digits === "117" || digits === "166") {
    return `tel:${digits}`;
  }
  return `tel:+63${digits}`;
}

/** Strip province suffix / Brgy. prefix so email sample ctx matches curated keys. */
export function resolveLguSlug(lguName: string): string {
  const head = lguName.split(",")[0]?.trim() || lguName;
  const slug = slugify(head);
  if (CURATED[slug]) return slug;
  const full = slugify(lguName);
  if (CURATED[full]) return full;
  return slug;
}

export function resolveBarangaySlug(barangayName: string): string {
  return slugify(
    barangayName.replace(/^(brgy\.?|barangay)\s+/i, "").trim(),
  );
}

/** Stations that cover a barangay: LGU PNP/BFP + local tanod if known. */
export function respondersForBarangay(
  lguName: string,
  barangayName: string,
): ResponderStation[] {
  const lguSlug = resolveLguSlug(lguName);
  const brgySlug = resolveBarangaySlug(barangayName);
  const displayLgu = lguName.split(",")[0]?.trim() || lguName;
  const pack = CURATED[lguSlug] ?? defaultStations(displayLgu);

  const list: ResponderStation[] = [
    ...withIds("hotline", "ph", UNIVERSAL_EMERGENCY_LINES, "-911"),
    ...withIds("pnp", lguSlug, pack.pnp),
    ...withIds("bfp", lguSlug, pack.bfp),
    ...withIds("hospital", lguSlug, pack.hospitals ?? []),
  ];

  const tanod = pack.tanodByBarangay?.[brgySlug];
  if (tanod?.length) {
    list.push(...withIds("tanod", lguSlug, tanod, `-${brgySlug}`));
  }

  return list;
}

/** LGU-level PNP + BFP + hospitals (for directory cards). */
export function respondersForLgu(lguName: string): ResponderStation[] {
  const lguSlug = resolveLguSlug(lguName);
  const displayLgu = lguName.split(",")[0]?.trim() || lguName;
  const pack = CURATED[lguSlug] ?? defaultStations(displayLgu);
  return [
    ...withIds("hotline", "ph", UNIVERSAL_EMERGENCY_LINES, "-911"),
    ...withIds("pnp", lguSlug, pack.pnp),
    ...withIds("bfp", lguSlug, pack.bfp),
    ...withIds("hospital", lguSlug, pack.hospitals ?? []),
  ];
}

/** Primary BFP station covering a barangay (prefer one with a listed phone). */
export function bfpForBarangay(
  lguName: string,
  barangayName: string,
): ResponderStation | undefined {
  const bfp = respondersForBarangay(lguName, barangayName).filter(
    (s) => s.kind === "bfp",
  );
  return (
    bfp.find((s) => (s.phones?.length ?? 0) + (s.mobiles?.length ?? 0) > 0) ??
    bfp[0]
  );
}

export function stationPhoneList(station: ResponderStation): string[] {
  return [...(station.phones ?? []), ...(station.mobiles ?? [])];
}

function pinCoords(
  lguSlug: string,
  station: StationInput,
  index: number,
): { lat: number; lng: number } | null {
  if (typeof station.lat === "number" && typeof station.lng === "number") {
    return { lat: station.lat, lng: station.lng };
  }
  const center = LGU_MAP_CENTER[lguSlug];
  if (!center) return null;
  // Slight offset so multiple facilities at the same LGU seat don't stack.
  const jitter = (index + 1) * 0.0022;
  return { lat: center.lat + jitter * 0.35, lng: center.lng + jitter };
}

/**
 * BFP + hospital pins near a barangay — includes other LGUs within range
 * so metro stations stay visible outside “your” barangay.
 */
export function responderMapPinsNear(
  area: MapArea,
  maxKm = 28,
): ResponderMapPin[] {
  const ownSlug = resolveLguSlug(area.lgu);
  const pins: ResponderMapPin[] = [];

  for (const [lguSlug, pack] of Object.entries(CURATED)) {
    const groups: { kind: "bfp" | "hospital"; rows: StationInput[] }[] = [
      { kind: "bfp", rows: pack.bfp },
      { kind: "hospital", rows: pack.hospitals ?? [] },
    ];
    for (const { kind, rows } of groups) {
      rows.forEach((row, i) => {
        const coords = pinCoords(lguSlug, row, i + (kind === "hospital" ? 3 : 0));
        if (!coords) return;
        const phones = [...(row.phones ?? []), ...(row.mobiles ?? [])];
        if (phones.length === 0) phones.push("911");
        const km = distKm(area.center, coords);
        if (lguSlug !== ownSlug && km > maxKm) return;
        pins.push({
          id: `${lguSlug}-${kind}-${i + 1}`,
          kind,
          name: row.name.replace(/\s*\(BFP\)\s*$/i, "").trim(),
          lat: coords.lat,
          lng: coords.lng,
          phones,
          seat: row.seat,
          covers: row.covers,
          notes: row.notes,
        });
      });
    }
  }

  // Always ensure own-LGU BFP exists (fallback pack when not curated).
  if (!pins.some((p) => p.kind === "bfp" && p.id.startsWith(`${ownSlug}-`))) {
    const display = area.lgu.split(",")[0]?.trim() || area.lgu;
    const fallback = defaultStations(display).bfp[0];
    const coords = pinCoords(ownSlug, fallback, 0) ?? area.center;
    pins.push({
      id: `${ownSlug}-bfp-fallback`,
      kind: "bfp",
      name: fallback.name.replace(/\s*\(BFP\)\s*$/i, "").trim(),
      lat: coords.lat,
      lng: coords.lng,
      phones: fallback.phones?.length ? fallback.phones : ["911"],
      seat: fallback.seat,
      covers: fallback.covers,
      notes: fallback.notes,
    });
  }

  return pins.sort((a, b) => {
    const da = distKm(area.center, a);
    const db = distKm(area.center, b);
    return da - db;
  });
}
