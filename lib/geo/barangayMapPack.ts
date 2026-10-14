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
import { cebuEeHazardsNear } from "@/lib/geo/cebuEeHazards";

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
  /** True when this brgy has no curated Tino layers yet. */
  empty: boolean;
};

/**
 * Empty hazard pack — still shows command hall + LGU ECs/schools
 * so every barangay has facility pins (no Nangka hazard leak).
 * Fills nearby EE Cebu hazards when `npm run ee:hazards` cache exists.
 */
export function emptyPack(area: MapArea): BarangayMapPack {
  const ee = cebuEeHazardsNear(area, 8);
  const hasEe =
    ee.floods.length + ee.landslides.length + ee.fires.length > 0;
  return {
    areaId: area.id,
    floods: ee.floods,
    landslides: ee.landslides,
    typhoons: [],
    fires: ee.fires,
    reportPins: [],
    safePoints: safePointsForArea(area),
    responders: responderMapPinsNear(area),
    scenarioActions: [],
    scenarioEscapes: [],
    empty: !hasEe,
  };
}

/** Nangka = full Tino scenario pack; other brgys = facilities + EE hazards. */
export function getBarangayMapPack(
  area: MapArea,
  scenario: ScenarioBundle,
): BarangayMapPack {
  if (!isNangkaOpsArea(area)) return emptyPack(area);
  const ee = cebuEeHazardsNear(area, 6);
  return {
    areaId: area.id,
    floods: scenario.floods.length ? scenario.floods : ee.floods,
    landslides: scenario.landslides.length
      ? scenario.landslides
      : ee.landslides,
    typhoons: scenario.typhoons,
    fires: scenario.fires.length ? scenario.fires : ee.fires,
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
