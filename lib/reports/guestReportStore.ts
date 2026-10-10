const STORAGE_KEY = "luwas.guestReportIds";
const MAX_IDS = 20;

function readIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

function writeIds(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, MAX_IDS)));
}

/** Persist a guest report reference (newest first). */
export function saveGuestReportId(reportId: string) {
  const id = reportId.trim();
  if (!id) return;
  const next = [id, ...readIds().filter((x) => x !== id)];
  writeIds(next);
}

export function listGuestReportIds(): string[] {
  return readIds();
}

export function latestGuestReportId(): string | null {
  return readIds()[0] ?? null;
}
