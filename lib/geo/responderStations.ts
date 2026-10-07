import { slugify } from "@/lib/geo/cebuBarangays";

/**
 * Nearby emergency responders for Cebu barangays.
 *
 * PNP / BFP are usually city or municipal stations that cover many barangays.
 * A barangay may also have a tanod outpost or community precinct — not always.
 *
 * Contact numbers are curated from public LGU / hotline directories (see
 * `source` on each station). Verify before operational use — numbers change.
 */

export type ResponderKind = "hotline" | "pnp" | "bfp" | "tanod";

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
  /** Where the contact was taken from (for audit). */
  source?: string;
};

type StationInput = Omit<ResponderStation, "id" | "kind">;

type LguStations = {
  pnp: StationInput[];
  bfp: StationInput[];
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
        notes: "BFP · one municipal fire station for the whole LGU",
        source: "Consolacion LGU directory + Pulpogan barangay hotlines",
      },
    ],
    tanodByBarangay: {
      nangka: [
        {
          name: "Nangka Barangay Tanod Outpost",
          seat: "Nangka (near barangay hall)",
          covers: "Brgy. Nangka puroks",
          notes:
            "Local peace & order · not a full PNP station · use barangay hall / MPS for urgent cases",
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
        notes: "BFP · dial 911 for fire emergencies",
        source: "Public BFP / Cebu emergency hotline lists",
      },
      {
        name: "BFP Sub-Station · Mabolo / North",
        seat: "Mabolo area",
        covers: "Northern urban barangays",
        notes: "Sub-station · confirm via Cebu City Fire Office if no answer",
        source: "Coverage note · city BFP network",
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
        source: "mandauecity.gov.ph emergency hotlines",
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
        source: "Public Lapu-Lapu emergency hotline lists",
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

/** Stations that cover a barangay: LGU PNP/BFP + local tanod if known. */
export function respondersForBarangay(
  lguName: string,
  barangayName: string,
): ResponderStation[] {
  const lguSlug = slugify(lguName);
  const brgySlug = slugify(barangayName);
  const pack = CURATED[lguSlug] ?? defaultStations(lguName);

  const list: ResponderStation[] = [
    ...withIds("hotline", "ph", UNIVERSAL_EMERGENCY_LINES, "-911"),
    ...withIds("pnp", lguSlug, pack.pnp),
    ...withIds("bfp", lguSlug, pack.bfp),
  ];

  const tanod = pack.tanodByBarangay?.[brgySlug];
  if (tanod?.length) {
    list.push(...withIds("tanod", lguSlug, tanod, `-${brgySlug}`));
  }

  return list;
}

/** LGU-level PNP + BFP only (for directory cards). */
export function respondersForLgu(lguName: string): ResponderStation[] {
  const lguSlug = slugify(lguName);
  const pack = CURATED[lguSlug] ?? defaultStations(lguName);
  return [
    ...withIds("hotline", "ph", UNIVERSAL_EMERGENCY_LINES, "-911"),
    ...withIds("pnp", lguSlug, pack.pnp),
    ...withIds("bfp", lguSlug, pack.bfp),
  ];
}
