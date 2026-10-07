import { slugify } from "@/lib/geo/cebuBarangays";

/**
 * Nearby emergency responders for Cebu barangays.
 *
 * PNP / BFP are usually city or municipal stations that cover many barangays.
 * A barangay may also have a tanod outpost or community precinct — not always.
 */

export type ResponderKind = "pnp" | "bfp" | "tanod";

export type ResponderStation = {
  id: string;
  kind: ResponderKind;
  name: string;
  /** Where the facility sits (barangay / area within the LGU). */
  seat: string;
  /** Short coverage note for residents. */
  covers: string;
  notes?: string;
};

type LguStations = {
  pnp: Omit<ResponderStation, "id" | "kind">[];
  bfp: Omit<ResponderStation, "id" | "kind">[];
  /** Barangay slug → local tanod / community outposts */
  tanodByBarangay?: Record<
    string,
    Omit<ResponderStation, "id" | "kind">[]
  >;
};

/** Curated stations for metro / ops-focus LGUs. */
const CURATED: Record<string, LguStations> = {
  consolacion: {
    pnp: [
      {
        name: "Consolacion Municipal Police Station",
        seat: "Poblacion Oriental",
        covers: "All Consolacion barangays",
        notes: "PNP · municipal station (not one per barangay)",
      },
      {
        name: "Consolacion Police Community Precinct · Tayud",
        seat: "Tayud",
        covers: "Eastern barangays (Tayud, Pitogo, Polog, nearby)",
        notes: "Community precinct · supports municipal PS",
      },
    ],
    bfp: [
      {
        name: "Consolacion Fire Station (BFP)",
        seat: "Poblacion Occidental",
        covers: "All Consolacion barangays",
        notes: "BFP · one municipal fire station for the whole LGU",
      },
    ],
    tanodByBarangay: {
      nangka: [
        {
          name: "Nangka Barangay Tanod Outpost",
          seat: "Nangka (near barangay hall)",
          covers: "Brgy. Nangka puroks",
          notes: "Local peace & order · not a full PNP station",
        },
      ],
      tayud: [
        {
          name: "Tayud Barangay Tanod Outpost",
          seat: "Tayud",
          covers: "Brgy. Tayud",
          notes: "Coordinates with Consolacion MPS / PCP Tayud",
        },
      ],
      "poblacion-oriental": [
        {
          name: "Poblacion Oriental Tanod Desk",
          seat: "Poblacion Oriental",
          covers: "Poblacion Oriental",
          notes: "Near municipal compound",
        },
      ],
    },
  },
  "cebu-city": {
    pnp: [
      {
        name: "Cebu City Police Office (CCPO)",
        seat: "Cebu City",
        covers: "Citywide command · precincts below",
        notes: "PNP · city police office",
      },
      {
        name: "Police Station 1 · Carbon / Downtown",
        seat: "Central Business District",
        covers: "Downtown / port-side barangays",
      },
      {
        name: "Police Station 3 · Mabolo",
        seat: "Mabolo",
        covers: "Mabolo, nearby north districts",
      },
      {
        name: "Police Station 6 · Lahug",
        seat: "Lahug",
        covers: "Lahug, uptown / IT Park area",
      },
      {
        name: "Police Station 8 · Talamban",
        seat: "Talamban",
        covers: "Talamban and northern mountain barangays",
      },
    ],
    bfp: [
      {
        name: "Cebu City Fire Station (BFP)",
        seat: "Cebu City",
        covers: "Citywide · sub-stations by district",
        notes: "BFP · municipal/city fire service",
      },
      {
        name: "BFP Sub-Station · Mabolo / North",
        seat: "Mabolo area",
        covers: "Northern urban barangays",
      },
    ],
  },
  "mandaue-city": {
    pnp: [
      {
        name: "Mandaue City Police Station",
        seat: "Centro",
        covers: "All Mandaue barangays",
        notes: "PNP · city station with precinct support",
      },
      {
        name: "Mandaue PCP · Tipolo / North Reclamation",
        seat: "Tipolo",
        covers: "Tipolo, Banilad edge, NRH corridor",
      },
    ],
    bfp: [
      {
        name: "Mandaue City Fire Station (BFP)",
        seat: "Centro",
        covers: "All Mandaue barangays",
      },
    ],
  },
  "lapu-lapu-city": {
    pnp: [
      {
        name: "Lapu-Lapu City Police Station",
        seat: "Poblacion",
        covers: "Mactan island barangays",
        notes: "PNP · city station",
      },
      {
        name: "PCP · Mactan–Cebu Airport corridor",
        seat: "Basak / airport area",
        covers: "Airport-adjacent barangays",
      },
    ],
    bfp: [
      {
        name: "Lapu-Lapu City Fire Station (BFP)",
        seat: "Poblacion",
        covers: "All Lapu-Lapu barangays",
      },
    ],
  },
  talisay: {
    pnp: [
      {
        name: "Talisay City Police Station",
        seat: "Poblacion",
        covers: "All Talisay barangays",
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

function defaultStations(lguName: string): LguStations {
  const kindWord = /city/i.test(lguName) ? "City" : "Municipal";
  return {
    pnp: [
      {
        name: `${lguName} ${kindWord} Police Station`,
        seat: "Poblacion",
        covers: `All ${lguName} barangays`,
        notes: "PNP · typical city/municipal station covering many barangays",
      },
    ],
    bfp: [
      {
        name: `${lguName} Fire Station (BFP)`,
        seat: "Poblacion",
        covers: `All ${lguName} barangays`,
        notes: "BFP · one station usually covers the whole LGU",
      },
    ],
  };
}

function withIds(
  kind: ResponderKind,
  lguSlug: string,
  rows: Omit<ResponderStation, "id" | "kind">[],
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
    case "pnp":
      return "Police (PNP)";
    case "bfp":
      return "Fire (BFP)";
    case "tanod":
      return "Barangay tanod";
  }
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
    ...withIds("pnp", lguSlug, pack.pnp),
    ...withIds("bfp", lguSlug, pack.bfp),
  ];
}
