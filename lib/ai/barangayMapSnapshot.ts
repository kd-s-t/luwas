import type {
  AssistEscapeRoute,
  AssistHouseholdAction,
  AssistResult,
} from "@/lib/ai/assistTypes";
import type { FloodSample } from "@/lib/hazards/floodSamples";
import type { Household } from "@/lib/households/types";
import { DEFAULT_MAP_AREA } from "@/lib/geo/mapAreas";

const LEGACY_NANGKA_KEY = "luwas.nangka.publicMap.v1";
const KEY_PREFIX = "luwas.barangay.publicMap.v1:";

export type BarangayMapSnapshot = {
  areaId: string;
  updatedAt: string;
  predictedFloods: FloodSample[];
  escapes: AssistEscapeRoute[];
  /** Optional — older snapshots omit this; homepage falls back to localAssist. */
  actions?: AssistHouseholdAction[];
};

function storageKey(areaId: string) {
  return `${KEY_PREFIX}${areaId}`;
}

function isSnapshot(value: unknown): value is BarangayMapSnapshot {
  if (!value || typeof value !== "object") return false;
  const v = value as BarangayMapSnapshot;
  return (
    typeof v.areaId === "string" &&
    typeof v.updatedAt === "string" &&
    Array.isArray(v.predictedFloods) &&
    Array.isArray(v.escapes)
  );
}

function migrateLegacyNangka(): BarangayMapSnapshot | null {
  try {
    const raw = window.localStorage.getItem(LEGACY_NANGKA_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      updatedAt?: string;
      predictedFloods?: FloodSample[];
      escapes?: AssistEscapeRoute[];
    };
    if (!Array.isArray(parsed.predictedFloods) || !Array.isArray(parsed.escapes)) {
      return null;
    }
    const snap: BarangayMapSnapshot = {
      areaId: DEFAULT_MAP_AREA.id,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      predictedFloods: parsed.predictedFloods,
      escapes: parsed.escapes,
    };
    window.localStorage.setItem(
      storageKey(DEFAULT_MAP_AREA.id),
      JSON.stringify(snap),
    );
    window.localStorage.removeItem(LEGACY_NANGKA_KEY);
    return snap;
  } catch {
    return null;
  }
}

/** Persist command-center triage layers for a barangay map (homepage sync). */
export function saveBarangayMapSnapshot(
  areaId: string,
  assist: AssistResult,
  _households: Household[] = [],
): void {
  void _households;
  if (typeof window === "undefined") return;
  const payload: BarangayMapSnapshot = {
    areaId,
    updatedAt: new Date().toISOString(),
    predictedFloods: assist.predictedFloods ?? [],
    escapes: assist.escapes ?? [],
    actions: assist.actions ?? [],
  };
  try {
    window.localStorage.setItem(storageKey(areaId), JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function clearBarangayMapSnapshot(areaId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(areaId));
    if (areaId === DEFAULT_MAP_AREA.id) {
      window.localStorage.removeItem(LEGACY_NANGKA_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function loadBarangayMapSnapshot(
  areaId: string,
): BarangayMapSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(areaId));
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      return isSnapshot(parsed) ? parsed : null;
    }
    if (areaId === DEFAULT_MAP_AREA.id) {
      return migrateLegacyNangka();
    }
    return null;
  } catch {
    return null;
  }
}

/** @deprecated Use saveBarangayMapSnapshot(DEFAULT_MAP_AREA.id, …) */
export function saveNangkaMapSnapshot(
  assist: AssistResult,
  households: Household[] = [],
): void {
  saveBarangayMapSnapshot(DEFAULT_MAP_AREA.id, assist, households);
}

/** @deprecated */
export function clearNangkaMapSnapshot(): void {
  clearBarangayMapSnapshot(DEFAULT_MAP_AREA.id);
}

/** @deprecated */
export function loadNangkaMapSnapshot(): BarangayMapSnapshot | null {
  return loadBarangayMapSnapshot(DEFAULT_MAP_AREA.id);
}
