import type {
  AssistEscapeRoute,
  AssistHouseholdAction,
  AssistPriority,
} from "@/lib/ai/assistTypes";
import type { FireSample } from "@/lib/hazards/fireSamples";
import type { FloodSample } from "@/lib/hazards/floodSamples";
import type { LandslideSample } from "@/lib/hazards/landslideSamples";
import type { TyphoonSample } from "@/lib/hazards/typhoonSamples";

export type DrrmScenarioPhase = "before" | "during" | "after";

/** Field / image report pin on the map (blockage, fire, welfare, EC status). */
export type ScenarioReportPin = {
  id: string;
  title: string;
  kind:
    | "blockage"
    | "flood"
    | "fire"
    | "landslide"
    | "warning"
    | "welfare"
    | "evac_status";
  lat: number;
  lng: number;
  purokHint: string;
  /** e.g. "Image report · live" */
  sourceLabel: string;
  notes: string;
  reportedAt: string;
  /** Public media path — also used when seeding Firestore. */
  mediaUrl?: string;
  /** Deep link; defaults to `/reports/{id}` when mediaUrl is set. */
  href?: string;
  /** Linked evacuation facility (for population status reports). */
  safePointId?: string;
  /** People currently inside the EC (gov field staff count). */
  occupancy?: number;
  /** Stated shelter capacity. */
  capacity?: number;
};

export type ScenarioHouseholdNeed = {
  householdId: string;
  ownerName: string;
  purok: string;
  priority: AssistPriority;
  reason: string;
  /** After-phase: needs barangay welfare check */
  needsCheck?: boolean;
  /** Blocked by flood / debris / report pin */
  blocked?: boolean;
};

export type ScenarioBundle = {
  phase: DrrmScenarioPhase;
  label: string;
  shortLabel: string;
  blurb: string;
  /** Eyebrow above the map title */
  eyebrow: string;
  typhoons: TyphoonSample[];
  floods: FloodSample[];
  landslides: LandslideSample[];
  fires: FireSample[];
  reportPins: ScenarioReportPin[];
  actions: AssistHouseholdAction[];
  needs: ScenarioHouseholdNeed[];
  escapes: AssistEscapeRoute[];
};

export const SCENARIO_PHASES: DrrmScenarioPhase[] = [
  "before",
  "during",
  "after",
];
