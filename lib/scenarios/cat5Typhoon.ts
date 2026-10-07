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
import { CEBU_LANDSLIDE_SAMPLES } from "@/lib/hazards/landslideSamples";
import type { TyphoonSample } from "@/lib/hazards/typhoonSamples";
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
  return buildEscapeRoutes(
    actions,
    HOUSEHOLDS,
    floods,
    CEBU_LANDSLIDE_SAMPLES,
  );
}

/** Forecast / observed eye path for Super Typhoon Ramil (demo). */
const RAMIL_TRACK = [
  {
    lat: 11.15,
    lng: 126.55,
    label: "Observed · +36h",
    at: "2026-10-06T06:00:00+08:00",
  },
  {
    lat: 10.95,
    lng: 125.85,
    label: "Observed · +24h",
    at: "2026-10-06T18:00:00+08:00",
  },
  {
    lat: 10.72,
    lng: 125.15,
    label: "Forecast · +12h",
    at: "2026-10-07T06:00:00+08:00",
  },
  {
    lat: 10.48,
    lng: 124.35,
    label: "Forecast · landfall approach",
    at: "2026-10-07T18:00:00+08:00",
  },
  {
    lat: 10.38,
    lng: 123.96,
    label: "Forecast · over Consolacion",
    at: "2026-10-08T02:00:00+08:00",
  },
  {
    lat: 10.22,
    lng: 123.15,
    label: "Forecast · exit west",
    at: "2026-10-08T14:00:00+08:00",
  },
] as const;

const BEFORE_TYPHOONS: TyphoonSample[] = [
  {
    id: "ty-ramil-before",
    name: "Super Typhoon Ramil (Cat 5)",
    internationalName: "Ramil",
    category: "super_typhoon",
    lat: 10.72,
    lng: 125.15,
    maxWindsKmh: 220,
    movement: "WNW at 18 km/h",
    distanceKm: 145,
    etaNote: "Dangerous winds possible in 12–18 hrs (demo)",
    reportedAt: "2026-10-07T06:00:00+08:00",
    notes:
      "Cat 5 · forecast cone toward eastern Cebu · preemptive evac for flood-prone and vulnerable households",
    track: [...RAMIL_TRACK],
    windRadiiKm: { gale: 320, storm: 180, typhoon: 95 },
  },
];

const DURING_TYPHOONS: TyphoonSample[] = [
  {
    id: "ty-ramil-during",
    name: "Super Typhoon Ramil · eye",
    internationalName: "Ramil",
    category: "super_typhoon",
    lat: 10.42,
    lng: 124.18,
    maxWindsKmh: 205,
    movement: "West at 16 km/h · eye wall approaching",
    distanceKm: 28,
    etaNote: "Eye wall / destructive winds now (demo)",
    reportedAt: "2026-10-08T01:30:00+08:00",
    notes:
      "Landfall impact window · flood + landslide + blockage reports active in Nangka",
    track: RAMIL_TRACK.map((p, i) =>
      i <= 3 ? { ...p, label: p.label.replace("Forecast", "Track") } : p,
    ),
    windRadiiKm: { gale: 280, storm: 150, typhoon: 75 },
  },
];

const AFTER_TYPHOONS: TyphoonSample[] = [
  {
    id: "ty-ramil-after",
    name: "Ex-Ramil · remnant low",
    internationalName: "Ramil (remnant)",
    category: "tropical_storm",
    lat: 10.18,
    lng: 122.85,
    maxWindsKmh: 65,
    movement: "WSW · exiting Visayas",
    distanceKm: 135,
    etaNote: "Storm passed · residual rain possible",
    reportedAt: "2026-10-08T16:00:00+08:00",
    notes: "Focus shifts to welfare checks, debris fires, and road clearing",
    track: [...RAMIL_TRACK],
    windRadiiKm: { gale: 120, storm: 50, typhoon: 20 },
  },
];

const BEFORE_FLOODS: FloodSample[] = [
  {
    id: "fl-before-watch-east",
    name: "Flood watch · eastern Access Road",
    place: "Low stretch, Purok 6",
    purokHint: "Purok 6",
    severity: "watch",
    lat: 10.3684,
    lng: 123.9661,
    depthCm: 5,
    reportedAt: "2026-10-07T06:30:00+08:00",
    notes: "Pre-landfall · canal already high · preemptive move recommended",
  },
];

const AFTER_FLOODS: FloodSample[] = [
  {
    ...CEBU_FLOOD_SAMPLES[0]!,
    id: "fl-after-east",
    severity: "warning",
    depthCm: 45,
    notes: "Water receding · still impassable for small vehicles",
    reportedAt: "2026-10-08T15:40:00+08:00",
  },
  {
    ...CEBU_FLOOD_SAMPLES[1]!,
    id: "fl-after-singko",
    severity: "watch",
    depthCm: 20,
    notes: "Ponding left · debris in drain",
    reportedAt: "2026-10-08T15:20:00+08:00",
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
    notes: "Sparking transformer · keep 50 m clear · BFP notified (demo)",
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
    title: "Road blocked · waist-deep flood",
    kind: "blockage",
    lat: 10.3686,
    lng: 123.9658,
    purokHint: "Purok 6",
    sourceLabel: "Image report · live",
    notes: "Citizen photo · jeep stalled · no through traffic",
    reportedAt: "2026-10-08T01:45:00+08:00",
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
  },
  {
    id: "rpt-flood-chapel",
    title: "Flooding · chapel approach",
    kind: "flood",
    lat: 10.36855,
    lng: 123.96185,
    purokHint: "Purok 4",
    sourceLabel: "Image report · live",
    notes: "Knee-deep runoff · staging still usable uphill",
    reportedAt: "2026-10-08T00:55:00+08:00",
  },
  {
    id: "rpt-warn-wind",
    title: "Warning · flying roof sheet",
    kind: "warning",
    lat: 10.3712,
    lng: 123.9594,
    purokHint: "Purok 1",
    sourceLabel: "Image report · live",
    notes: "G.I. sheet hazard near Sto. Niño Chapel",
    reportedAt: "2026-10-08T01:05:00+08:00",
  },
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
];

const BEFORE_ACTIONS: AssistHouseholdAction[] = [
  action(10, "evacuate", "Cat 5 track over Purok 6 · high flood risk · no upper floor"),
  action(7, "evacuate", "Pregnant · priority preemptive evacuation before landfall"),
  action(3, "evacuate", "PWD / wheelchair · move early while roads are clear"),
  action(2, "evacuate", "Flood-prone single-storey · inside forecast wind field"),
  action(11, "prepare", "3 children · pack go-bag · stage at elementary if signal rises"),
  action(1, "prepare", "Elderly in care · meds + early transfer to hall"),
  action(5, "prepare", "Infant · formula stock · avoid waiting for landfall"),
  action(6, "monitor", "Ground-floor store · watch flood watch upgrades"),
];

const DURING_ACTIONS: AssistHouseholdAction[] = [
  action(10, "evacuate", "Critical flood · blocked Access Road · image report confirms"),
  action(7, "evacuate", "Sheet flood at chapel · pregnant · move to shelter now"),
  action(3, "evacuate", "PWD · rising water + fallen tree blocks west exit"),
  action(2, "evacuate", "Single-storey in flood corridor · knee-deep ponding"),
  action(9, "evacuate", "East lane inundated · ground floor store flooded"),
  action(8, "prepare", "Neighborhood hub · generator · assist neighbors then shelter"),
  action(4, "prepare", "2-storey host · take in nearby evacuees at school"),
  action(1, "prepare", "Elderly · winds near hall · escort to barangay hall"),
  action(0, "monitor", "Tanod post · hold position unless eye wall intensifies"),
];

const AFTER_ACTIONS: AssistHouseholdAction[] = [
  action(10, "evacuate", "Still displaced · home unlivable · residual flood"),
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

export const CAT5_BEFORE: ScenarioBundle = {
  phase: "before",
  label: "Before landfall",
  shortLabel: "Before",
  eyebrow: "Scenario · incoming Cat 5",
  blurb:
    "Forecast track of Super Typhoon Ramil. Preemptive list: who must evacuate or prepare before roads close.",
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
  label: "During impact",
  shortLabel: "During",
  eyebrow: "Scenario · landfall window",
  blurb:
    "Eye, wind field, floods, and live image reports. Who needs help — and who is blocked by flood or debris.",
  typhoons: DURING_TYPHOONS,
  floods: CEBU_FLOOD_SAMPLES,
  landslides: CEBU_LANDSLIDE_SAMPLES,
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
  label: "After the storm",
  shortLabel: "After",
  eyebrow: "Scenario · recovery & checks",
  blurb:
    "Residual flood and fire. Image reports show live blockages. Barangay roster: who still needs help or a welfare check.",
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
