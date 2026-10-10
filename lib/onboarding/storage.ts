import {
  deleteOnboardedBarangay as deleteRemote,
  fetchOnboardedBarangays,
  upsertOnboardedBarangay,
} from "@/lib/onboarding/api";
import type { OnboardedBarangay } from "@/lib/onboarding/types";

const STORAGE_KEY = "luwas.onboarded.barangays.v1";

function readCache(): OnboardedBarangay[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is OnboardedBarangay =>
        Boolean(row && typeof row === "object" && "id" in row),
    );
  } catch {
    return [];
  }
}

function writeCache(rows: OnboardedBarangay[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

/** Sync read from local cache (hydrated from Firestore on login / onboard). */
export function listOnboardedBarangays(): OnboardedBarangay[] {
  return readCache().sort((a, b) => b.activatedAt.localeCompare(a.activatedAt));
}

export function getOnboardedBarangay(id: string): OnboardedBarangay | null {
  return readCache().find((r) => r.id === id) ?? null;
}

/** Write-through: cache + Firestore. */
export async function saveOnboardedBarangay(
  row: OnboardedBarangay,
): Promise<void> {
  const rows = readCache().filter((r) => r.id !== row.id);
  rows.push(row);
  writeCache(rows);
  try {
    await upsertOnboardedBarangay(row);
  } catch (err) {
    console.warn("[onboarding] Firestore save failed; kept local cache", err);
  }
}

export async function removeOnboardedBarangay(id: string): Promise<void> {
  writeCache(readCache().filter((r) => r.id !== id));
  try {
    await deleteRemote(id);
  } catch (err) {
    console.warn("[onboarding] Firestore delete failed; kept local cache", err);
  }
}

/** Pull Firestore barangays into the local cache (call after auth). */
export async function hydrateOnboardedBarangays(): Promise<OnboardedBarangay[]> {
  try {
    const remote = await fetchOnboardedBarangays();
    if (remote.length > 0) {
      writeCache(remote);
      return remote;
    }
  } catch (err) {
    console.warn("[onboarding] Firestore hydrate failed; using cache", err);
  }
  return listOnboardedBarangays();
}
