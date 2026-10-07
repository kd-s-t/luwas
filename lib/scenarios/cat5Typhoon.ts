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
import { odetteTyphoonForPhase } from "@/lib/hazards/odetteIbtracs";
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

/** Real Odette (Rai) eye snapshots from NOAA IBTrACS. */
const BEFORE_TYPHOONS = [odetteTyphoonForPhase("before")];
const DURING_TYPHOONS = [odetteTyphoonForPhase("during")];
const AFTER_TYPHOONS = [odetteTyphoonForPhase("after")];

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
    reportedAt: "2021-12-15T20:00:00+08:00",
    notes:
      "Pre-Odette · Nangka listed flood-prone by Consolacion LGU (CDN, 15 Dec 2021) · demo pin",
  },
];

const AFTER_FLOODS: FloodSample[] = [
  {
    ...CEBU_FLOOD_SAMPLES[0]!,
    id: "fl-after-east",
    severity: "warning",
    depthCm: 45,
    notes:
      "Post-Odette residual inundation (demo pin) · town reported thousands of damaged homes",
    reportedAt: "2021-12-17T14:00:00+08:00",
  },
  {
    ...CEBU_FLOOD_SAMPLES[1]!,
    id: "fl-after-singko",
    severity: "watch",
    depthCm: 20,
    notes: "Ponding / debris (demo pin)",
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
    id: "rpt-flood-chapel",
    title: "Flood road · chapel approach",
    kind: "flood",
    lat: 10.36855,
    lng: 123.96185,
    purokHint: "Purok 4",
    sourceLabel: "Image report · live",
    notes: "Flash flood across both lanes · road impassable",
    reportedAt: "2026-10-08T00:55:00+08:00",
    mediaUrl: "/reports/flood-road-chapel.png",
    href: "/reports/rpt-flood-chapel",
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
  action(
    10,
    "evacuate",
    "Odette approaching · Purok 6 flood-prone (LGU list) · no upper floor",
  ),
  action(7, "evacuate", "Pregnant · preemptive move before Odette landfall window"),
  action(3, "evacuate", "PWD / wheelchair · move early while roads are clear"),
  action(2, "evacuate", "Flood-prone single-storey · Nangka on Consolacion flood list"),
  action(11, "prepare", "3 children · go-bag · stage at elementary if signal rises"),
  action(1, "prepare", "Elderly in care · meds + early transfer to hall"),
  action(5, "prepare", "Infant · formula stock · avoid waiting for landfall"),
  action(6, "monitor", "Ground-floor store · watch flood watch upgrades"),
];

const DURING_ACTIONS: AssistHouseholdAction[] = [
  action(10, "evacuate", "Odette impact · critical flood · Access Road blocked (demo)"),
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
  action(10, "evacuate", "Still displaced post-Odette · residual flood"),
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
  label: "Before Odette",
  shortLabel: "Before",
  eyebrow: "Historical · Odette (Rai) · 15 Dec 2021",
  blurb:
    "Real IBTrACS track of Typhoon Odette approaching Visayas. Preemptive list for flood-prone Nangka households (demo roster on a real storm path).",
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
  label: "During Odette",
  shortLabel: "During",
  eyebrow: "Historical · Odette (Rai) · 16 Dec 2021",
  blurb:
    "Real eye position near Cebu (~2 hrs before Carcar landfall). Flood / landslide / report pins are demo overlays on the observed track.",
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
  label: "After Odette",
  shortLabel: "After",
  eyebrow: "Historical · Odette (Rai) · 17 Dec 2021",
  blurb:
    "Storm core west of Negros on the real track. Recovery: residual flood/fire demo pins + welfare checks. Consolacion had mass housing damage after Odette.",
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
