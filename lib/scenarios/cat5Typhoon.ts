import type {
  AssistEscapeRoute,
  AssistHouseholdAction,
} from "@/lib/ai/assistTypes";
import { buildEscapeRoutes } from "@/lib/ai/escapeRoutes";
import type { FireSample } from "@/lib/hazards/fireSamples";
import {
  CEBU_FLOOD_SAMPLES,
  type FloodSample,
} from "@/lib/hazards/floodSamples";
import { tinoTyphoonForPhase } from "@/lib/hazards/tinoIbtracs";
import { CEBU_HOUSEHOLDS } from "@/lib/households/seed";
import type { Household } from "@/lib/households/types";
import type {
  ScenarioBundle,
  ScenarioHouseholdNeed,
  ScenarioReportPin,
} from "@/lib/scenarios/types";

/** Public-map household ids must match PublicSituationMap seedAsHouseholds. */
function publicHouseholds(): Household[] {
  const now = "2026-10-08T00:00:00+08:00";
  return CEBU_HOUSEHOLDS.map((h, i) => ({
    id: `public-seed-${i}`,
    ownerName: h.ownerName,
    address: h.address,
    purok: h.purok,
    phone: h.phone,
    email: h.email,
    notes: h.notes,
    lat: h.lat ?? null,
    lng: h.lng ?? null,
    officerUid: "public",
    orgName: "Brgy. Nangka MDRRMO",
    createdAt: now,
    updatedAt: now,
  }));
}

const HOUSEHOLDS = publicHouseholds();

function need(
  index: number,
  action: AssistHouseholdAction,
  extra?: Partial<ScenarioHouseholdNeed>,
): ScenarioHouseholdNeed {
  const h = HOUSEHOLDS[index]!;
  return {
    householdId: action.householdId,
    ownerName: h.ownerName,
    purok: h.purok,
    priority: action.priority,
    reason: action.reason,
    ...extra,
  };
}

function action(
  index: number,
  priority: AssistHouseholdAction["priority"],
  reason: string,
): AssistHouseholdAction {
  return {
    householdId: `public-seed-${index}`,
    priority,
    reason,
  };
}

function withEscapes(
  actions: AssistHouseholdAction[],
  floods: FloodSample[],
): AssistEscapeRoute[] {
  return buildEscapeRoutes(actions, HOUSEHOLDS, floods, []);
}

/** Real Tino (Rai) eye snapshots from NOAA IBTrACS. */
const BEFORE_TYPHOONS = [tinoTyphoonForPhase("before")];
const DURING_TYPHOONS = [tinoTyphoonForPhase("during")];
const AFTER_TYPHOONS = [tinoTyphoonForPhase("after")];

/** Flood footprints are AI-predicted on triage — not pre-baked on the scenario. */
const BEFORE_FLOODS: FloodSample[] = [];

const AFTER_FLOODS: FloodSample[] = [
  {
    ...CEBU_FLOOD_SAMPLES[0]!,
    id: "fl-after-east",
    severity: "warning",
    depthCm: 45,
    notes:
      "Post-Tino residual inundation · town reported thousands of damaged homes",
    reportedAt: "2021-12-17T14:00:00+08:00",
  },
  {
    ...CEBU_FLOOD_SAMPLES[1]!,
    id: "fl-after-singko",
    severity: "watch",
    depthCm: 20,
    notes: "Ponding / debris after landfall",
    reportedAt: "2021-12-17T13:30:00+08:00",
  },
];

const AFTER_FIRES: FireSample[] = [
  {
    id: "fire-access-transformer",
    name: "Electrical fire · downed line",
    place: "Purok Singko mid Access Road",
    purokHint: "Purok 5",
    severity: "critical",
    lat: 10.3702,
    lng: 123.9635,
    reportedAt: "2026-10-08T15:55:00+08:00",
    notes: "Sparking transformer · keep 50 m clear · BFP notified",
  },
  {
    id: "fire-debris-purok4",
    name: "Debris fire · Tomas P. Go Road",
    place: "Near Holy Family Chapel staging",
    purokHint: "Purok 4",
    severity: "warning",
    lat: 10.3687,
    lng: 123.9615,
    reportedAt: "2026-10-08T16:10:00+08:00",
    notes: "Residents burning wet debris · smoke hazard",
  },
];

const DURING_REPORTS: ScenarioReportPin[] = [
  {
    id: "rpt-block-access-east",
    title: "Road blocked · fallen tree",
    kind: "blockage",
    lat: 10.3686,
    lng: 123.9658,
    purokHint: "Purok 6",
    sourceLabel: "Image report · live",
    notes: "Tree across both lanes · no through traffic",
    reportedAt: "2026-10-08T01:45:00+08:00",
    mediaUrl: "/reports/road-block-access-east.jpg",
    href: "/reports/rpt-block-access-east",
  },
  {
    id: "rpt-block-singko",
    title: "Fallen tree · Access Road",
    kind: "blockage",
    lat: 10.3704,
    lng: 123.9629,
    purokHint: "Purok 4",
    sourceLabel: "Image report · live",
    notes: "Tree across both lanes · motorcycle only",
    reportedAt: "2026-10-08T01:20:00+08:00",
    mediaUrl: "/reports/fallen-tree-access-road.webp",
    href: "/reports/rpt-block-singko",
  },
  {
    // Inside elev flood wash (not dry chapel lot) so the pin sits on blue tiles.
    id: "rpt-flood-chapel",
    title: "Flood road · chapel approach",
    kind: "flood",
    lat: 10.36995,
    lng: 123.96755,
    purokHint: "Purok 6",
    sourceLabel: "Image report · live",
    notes: "Flash flood across both lanes · road impassable · east of chapel toward Laray / EC corridor",
    reportedAt: "2026-10-08T00:55:00+08:00",
    mediaUrl: "/reports/flood-road-chapel.png",
    href: "/reports/rpt-flood-chapel",
  },
  {
    id: "rpt-laray-flood-debris",
    title: "Homes destroyed · Laray Road flood",
    kind: "flood",
    // East corridor · Laray / Harrison approach to Consolacion EC.
    lat: 10.37025,
    lng: 123.96855,
    purokHint: "Purok 6",
    sourceLabel: "Image report · live",
    notes:
      "Laray Road near Consolacion Evacuation Center · riverside blocks leveled · mud & debris · approaches may be impassable",
    reportedAt: "2026-10-08T02:05:00+08:00",
    mediaUrl: "/reports/laray-road-flood-debris.jpg",
    href: "/reports/rpt-laray-flood-debris",
  },
  {
    id: "rpt-laray-embankment",
    title: "Debris · Laray embankment",
    kind: "blockage",
    lat: 10.36985,
    lng: 123.96895,
    purokHint: "Purok 6",
    sourceLabel: "Image report · live",
    notes:
      "Laray Road river wall · wreckage blocking land-side access · high muddy water · near Consolacion EC",
    reportedAt: "2026-10-08T02:12:00+08:00",
    mediaUrl: "/reports/laray-road-embankment.jpg",
    href: "/reports/rpt-laray-embankment",
  },
  {
    id: "rpt-sm-consolacion-atrium",
    title: "SM Consolacion · atrium flooded",
    kind: "flood",
    // Pin from map: SM City Consolacion footprint.
    lat: 10.379876090660447,
    lng: 123.96408121585092,
    purokHint: "Poblacion Occidental",
    sourceLabel: "Image report · live",
    notes:
      "Ground floor atrium under muddy floodwater · escalator base submerged · vehicle in water · mall closed",
    reportedAt: "2026-10-08T02:20:00+08:00",
    mediaUrl: "/reports/sm-consolacion-flood-atrium.jpg",
    href: "/reports/rpt-sm-consolacion-atrium",
  },
  {
    id: "rpt-sm-consolacion-ground",
    title: "SM Consolacion · ground floor inundated",
    kind: "flood",
    lat: 10.37995,
    lng: 123.96422,
    purokHint: "Poblacion Occidental",
    sourceLabel: "Image report · live",
    notes:
      "Interior flood to mid-shutter · floating debris · foodcourt / stores inaccessible · power down",
    reportedAt: "2026-10-08T02:28:00+08:00",
    mediaUrl: "/reports/sm-consolacion-flood-ground.jpg",
    href: "/reports/rpt-sm-consolacion-ground",
  },
  {
    id: "rpt-sm-consolacion-highway",
    title: "SM Consolacion · highway wreck & debris",
    kind: "blockage",
    lat: 10.37972,
    lng: 123.96395,
    purokHint: "Poblacion Occidental",
    sourceLabel: "Image report · live",
    notes:
      "Cebu North Road outside SM · overturned car · barriers displaced · styrofoam / debris blocking lanes · traffic backed up",
    reportedAt: "2026-10-08T02:35:00+08:00",
    mediaUrl: "/reports/sm-consolacion-highway-wreck.jpg",
    href: "/reports/rpt-sm-consolacion-highway",
  },
  // EC occupancy pins stay on After / facilities layer — During focuses on flood.
];

const AFTER_REPORTS: ScenarioReportPin[] = [
  {
    id: "rpt-after-block-east",
    title: "Live blockage · mud & debris",
    kind: "blockage",
    lat: 10.3685,
    lng: 123.9659,
    purokHint: "Purok 6",
    sourceLabel: "Image report · live",
    notes: "Still closed · waiting for backhoe",
    reportedAt: "2026-10-08T16:05:00+08:00",
  },
  {
    id: "rpt-after-block-north",
    title: "Live blockage · collapsed fence",
    kind: "blockage",
    lat: 10.3722,
    lng: 123.9593,
    purokHint: "Purok 3",
    sourceLabel: "Image report · live",
    notes: "School lane partially blocked",
    reportedAt: "2026-10-08T15:50:00+08:00",
  },
  {
    id: "rpt-after-fire",
    title: "Fire reported · transformer",
    kind: "fire",
    lat: 10.3702,
    lng: 123.9635,
    purokHint: "Purok 5",
    sourceLabel: "Image report · live",
    notes: "Matches fire layer · keep clear",
    reportedAt: "2026-10-08T15:58:00+08:00",
  },
  {
    id: "rpt-after-welfare",
    title: "No contact · elderly household",
    kind: "welfare",
    lat: 10.3710086,
    lng: 123.9593892,
    purokHint: "Purok 1",
    sourceLabel: "Barangay roster check",
    notes: "Ana Cruz · last ping before landfall",
    reportedAt: "2026-10-08T16:20:00+08:00",
  },
  {
    id: "rpt-after-free-wifi",
    title: "Free Wi‑Fi here · Nangka Barangay Hall",
    kind: "welfare",
    lat: 10.37095,
    lng: 123.9592,
    purokHint: "Purok 1",
    sourceLabel: "Barangay recovery desk · field report",
    notes:
      "Open hotspot after Tino · charge phones / message family · open while hall has generator power · not an evacuation shelter",
    reportedAt: "2026-10-08T17:05:00+08:00",
    mediaUrl: "/reports/free-wifi-nangka.png",
    href: "/reports/rpt-after-free-wifi",
  },
  {
    id: "rpt-after-free-generator",
    title: "Free generator here · Nangka Barangay Hall",
    kind: "welfare",
    lat: 10.37078,
    lng: 123.95928,
    purokHint: "Purok 1",
    sourceLabel: "Barangay recovery desk · field report",
    notes:
      "Community genset running after Tino · free phone / power-bank charging · limited fuel · queue at hall desk · not for home hookups",
    reportedAt: "2026-10-08T17:20:00+08:00",
    mediaUrl: "/reports/free-generator-nangka.png",
    href: "/reports/rpt-after-free-generator",
  },
];

const BEFORE_ACTIONS: AssistHouseholdAction[] = [
  action(
    10,
    "evacuate",
    "Tino approaching · Purok 6 flood-prone (LGU list) · no upper floor",
  ),
  action(7, "evacuate", "Pregnant · preemptive move before Tino landfall window"),
  action(3, "evacuate", "PWD / wheelchair · move early while roads are clear"),
  action(2, "evacuate", "Flood-prone single-storey · Nangka on Consolacion flood list"),
  action(11, "prepare", "3 children · go-bag · stage at elementary if signal rises"),
  action(1, "prepare", "Elderly in care · meds + early transfer to hall"),
  action(5, "prepare", "Infant · formula stock · avoid waiting for landfall"),
  action(6, "monitor", "Ground-floor store · watch flood watch upgrades"),
];

const DURING_ACTIONS: AssistHouseholdAction[] = [
  action(10, "evacuate", "Tino impact · critical flood · Access Road blocked"),
  action(7, "evacuate", "Sheet flood at chapel · pregnant · move to shelter now"),
  action(3, "evacuate", "PWD · rising water + fallen tree blocks west exit"),
  action(2, "evacuate", "Single-storey in flood corridor · knee-deep ponding"),
  action(9, "evacuate", "East lane inundated · ground floor store flooded"),
  action(8, "prepare", "Neighborhood hub · generator · assist neighbors then shelter"),
  action(4, "prepare", "2-storey host · take in nearby evacuees at school"),
  action(1, "prepare", "Elderly · destructive winds · escort to barangay hall"),
  action(0, "monitor", "Tanod post · hold unless conditions worsen"),
];

const AFTER_ACTIONS: AssistHouseholdAction[] = [
  action(10, "evacuate", "Still displaced post-Tino · residual flood"),
  action(7, "evacuate", "Displaced · chapel staging · needs shelter assignment"),
  action(1, "monitor", "Welfare check · elderly · no contact since landfall"),
  action(3, "monitor", "Welfare check · PWD household · confirm meds & mobility"),
  action(5, "monitor", "Welfare check · infant · formula & clean water"),
  action(11, "monitor", "Welfare check · 3 children · school lane partially blocked"),
  action(8, "prepare", "Generator hub · support clearing team · watch fire zone"),
  action(9, "prepare", "Near transformer fire · stay clear until BFP clears"),
];

function buildNeeds(
  actions: AssistHouseholdAction[],
  opts?: {
    blockedIds?: Set<string>;
    checkIds?: Set<string>;
  },
): ScenarioHouseholdNeed[] {
  return actions.map((a) => {
    const index = Number(a.householdId.replace("public-seed-", ""));
    return need(index, a, {
      blocked: opts?.blockedIds?.has(a.householdId) ?? false,
      needsCheck: opts?.checkIds?.has(a.householdId) ?? false,
    });
  });
}

/** Pill label only — map data for nostorm comes from liveOpsScenarioBundle. */
export const CAT5_NOSTORM: ScenarioBundle = {
  phase: "nostorm",
  label: "Today · live",
  shortLabel: "No storm",
  eyebrow: "Live operations · no simulation",
  blurb:
    "Today's map - live weather, reports, and roster. Switch to Before / During / After for the Tino drill.",
  typhoons: [],
  floods: [],
  landslides: [],
  fires: [],
  reportPins: [],
  actions: [],
  needs: [],
  escapes: [],
};

export const CAT5_BEFORE: ScenarioBundle = {
  phase: "before",
  label: "Before Tino",
  shortLabel: "Before",
  eyebrow: "Tino simulation · Rai · 15 Dec 2021",
  blurb:
    "Typhoon Tino approaching Visayas (IBTrACS track). Run triage for AI flood footprints + household priorities — high lots shelter in place.",
  typhoons: BEFORE_TYPHOONS,
  floods: BEFORE_FLOODS,
  landslides: [],
  fires: [],
  reportPins: [],
  actions: BEFORE_ACTIONS,
  needs: buildNeeds(BEFORE_ACTIONS),
  escapes: withEscapes(BEFORE_ACTIONS, BEFORE_FLOODS),
};

export const CAT5_DURING: ScenarioBundle = {
  phase: "during",
  label: "During Tino",
  shortLabel: "During",
  eyebrow: "Tino simulation · Rai · 16 Dec 2021",
  blurb:
    "Eye near Cebu (~2 hrs before Carcar landfall). Flood and field reports play out on the observed Tino track.",
  typhoons: DURING_TYPHOONS,
  floods: CEBU_FLOOD_SAMPLES,
  landslides: [],
  fires: [],
  reportPins: DURING_REPORTS,
  actions: DURING_ACTIONS,
  needs: buildNeeds(DURING_ACTIONS, {
    blockedIds: new Set([
      "public-seed-10",
      "public-seed-7",
      "public-seed-3",
      "public-seed-2",
      "public-seed-9",
    ]),
  }),
  escapes: withEscapes(DURING_ACTIONS, CEBU_FLOOD_SAMPLES),
};

export const CAT5_AFTER: ScenarioBundle = {
  phase: "after",
  label: "After Tino",
  shortLabel: "After",
  eyebrow: "Tino simulation · Rai · 17 Dec 2021",
  blurb:
    "Storm core west of Negros. Recovery phase: residual flood/fire, welfare checks — Consolacion took heavy housing damage after Tino.",
  typhoons: AFTER_TYPHOONS,
  floods: AFTER_FLOODS,
  landslides: [],
  fires: AFTER_FIRES,
  reportPins: AFTER_REPORTS,
  actions: AFTER_ACTIONS,
  needs: buildNeeds(AFTER_ACTIONS, {
    blockedIds: new Set(["public-seed-10", "public-seed-9", "public-seed-11"]),
    checkIds: new Set([
      "public-seed-1",
      "public-seed-3",
      "public-seed-5",
      "public-seed-11",
    ]),
  }),
  escapes: withEscapes(
    AFTER_ACTIONS.filter((a) => a.priority === "evacuate"),
    AFTER_FLOODS,
  ),
};

export const CAT5_SCENARIOS: Record<
  ScenarioBundle["phase"],
  ScenarioBundle
> = {
  nostorm: CAT5_NOSTORM,
  before: CAT5_BEFORE,
  during: CAT5_DURING,
  after: CAT5_AFTER,
};

export function getCat5Scenario(
  phase: ScenarioBundle["phase"],
): ScenarioBundle {
  return CAT5_SCENARIOS[phase];
}

/** Remap public-seed-* ids → seed-* (or any prefix) for the officer roster. */
export function remapScenarioHouseholdIds(
  bundle: ScenarioBundle,
  toId: (index: number) => string,
): ScenarioBundle {
  const mapId = (id: string) => {
    const n = Number(id.replace(/^public-seed-/, ""));
    return Number.isFinite(n) ? toId(n) : id;
  };
  return {
    ...bundle,
    actions: bundle.actions.map((a) => ({
      ...a,
      householdId: mapId(a.householdId),
    })),
    needs: bundle.needs.map((n) => ({
      ...n,
      householdId: mapId(n.householdId),
    })),
    escapes: bundle.escapes.map((e) => ({
      ...e,
      householdId: mapId(e.householdId),
    })),
  };
}
