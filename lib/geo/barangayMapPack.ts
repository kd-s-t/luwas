import type {
  AssistEscapeRoute,
  AssistHouseholdAction,
} from "@/lib/ai/assistTypes";
import { distKm } from "@/lib/geo/bearing";
import {
  DEFAULT_MAP_AREA,
  isNangkaOpsArea,
  mapAreaId,
  resolveKnownMapArea,
  type MapArea,
  type MapAreaOption,
} from "@/lib/geo/mapAreas";
import {
  responderMapPinsNear,
  type ResponderMapPin,
} from "@/lib/geo/responderStations";
import {
  NANGKA_SAFE_POINTS,
  safePointsForArea,
  type SafePoint,
} from "@/lib/geo/safePoints";
import type { FireSample } from "@/lib/hazards/fireSamples";
import type { FloodSample } from "@/lib/hazards/floodSamples";
import type { LandslideSample } from "@/lib/hazards/landslideSamples";
import type { TyphoonSample } from "@/lib/hazards/typhoonSamples";
import type { Household } from "@/lib/households/types";
import type { ReportScope } from "@/lib/reports/barangayScope";
import type { ScenarioBundle, ScenarioReportPin } from "@/lib/scenarios/types";

export type BarangayMapPack = {
  areaId: string;
  floods: FloodSample[];
  landslides: LandslideSample[];
  typhoons: TyphoonSample[];
  fires: FireSample[];
  reportPins: ScenarioReportPin[];
  safePoints: SafePoint[];
  /** BFP + hospitals (own LGU + nearby metro) with phone numbers. */
  responders: ResponderMapPin[];
  scenarioActions: AssistHouseholdAction[];
  scenarioEscapes: AssistEscapeRoute[];
  /** True when this brgy has no curated Odette layers yet. */
  empty: boolean;
};

/**
 * Empty hazard pack — still shows command hall + LGU ECs/schools
 * so every barangay has facility pins (no Nangka hazard leak).
 */
export function emptyPack(area: MapArea): BarangayMapPack {
  return {
    areaId: area.id,
    floods: [],
    landslides: [],
    typhoons: [],
    fires: [],
    reportPins: [],
    safePoints: safePointsForArea(area),
    responders: responderMapPinsNear(area),
    scenarioActions: [],
    scenarioEscapes: [],
    empty: true,
  };
}

/** Nangka = full Odette scenario pack; every other brgy = facilities + empty hazards. */
export function getBarangayMapPack(
  area: MapArea,
  scenario: ScenarioBundle,
): BarangayMapPack {
  if (!isNangkaOpsArea(area)) return emptyPack(area);
  return {
    areaId: area.id,
    floods: scenario.floods,
    landslides: scenario.landslides,
    typhoons: scenario.typhoons,
    fires: scenario.fires,
    reportPins: scenario.reportPins,
    safePoints: NANGKA_SAFE_POINTS,
    responders: responderMapPinsNear(area),
    scenarioActions: scenario.actions,
    scenarioEscapes: scenario.escapes,
    empty: false,
  };
}

/** Keep roster pins inside the selected barangay radius. */
export function householdsInArea(
  households: Household[],
  area: MapArea,
  maxKm = 2.5,
): Household[] {
  return households.filter((h) => {
    if (h.lat == null || h.lng == null) return false;
    return distKm(area.center, { lat: h.lat, lng: h.lng }) <= maxKm;
  });
}

/** Resolve command default map from officer report scope. */
export function mapAreaFromReportScope(scope: ReportScope): MapArea {
  if (scope.mode === "barangay") {
    const option: MapAreaOption = {
      id: mapAreaId(scope.lgu, scope.barangay),
      barangay: scope.barangay,
      lgu: scope.lgu,
      name: `Brgy. ${scope.barangay}, ${scope.lgu}, Cebu`,
      label: `${scope.barangay} · ${scope.lgu}`,
    };
    return resolveKnownMapArea(option);
  }
  // LGU-wide officers still open on Nangka ops (demo) until multi-brgy packs exist.
  return DEFAULT_MAP_AREA;
}
