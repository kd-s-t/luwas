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
import { NANGKA_SAFE_POINTS, type SafePoint } from "@/lib/geo/safePoints";
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
  scenarioActions: AssistHouseholdAction[];
  scenarioEscapes: AssistEscapeRoute[];
  /** True when this brgy has no curated Odette layers yet. */
  empty: boolean;
};

/** Empty ops pack — hall pin at center only (no Nangka leak). */
export function emptyPack(area: MapArea): BarangayMapPack {
  return {
    areaId: area.id,
    floods: [],
    landslides: [],
    typhoons: [],
    fires: [],
    reportPins: [],
    safePoints: [
      {
        id: `hall-${area.id.replace(/\//g, "-")}`,
        name: `Brgy. ${area.barangay} Hall`,
        kind: "hall",
        lat: area.center.lat,
        lng: area.center.lng,
        elevM: 0,
        isEvacCenter: false,
        notes: "Command desk · no local hazard layers loaded yet",
      },
    ],
    scenarioActions: [],
    scenarioEscapes: [],
    empty: true,
  };
}

/** Nangka = full Odette scenario pack; every other brgy = empty own pack. */
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
