/** Device-local report reference ids (guest + signed-in). */
const STORAGE_KEY = "ugnai.guestReportIds";
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

/** YYMMDD + sequence from place-prefixed / LUW ids → newest first. */
export function compareGuestReportIdsNewestFirst(a: string, b: string): number {
  const parse = (id: string): { day: number; seq: number } => {
    const m = id.trim().toUpperCase().match(/(\d{6})-(\d{4,})$/);
    if (!m) return { day: 0, seq: 0 };
    return { day: Number(m[1]), seq: Number(m[2]) };
  };
  const pa = parse(a);
  const pb = parse(b);
  if (pa.day !== pb.day) return pb.day - pa.day;
  if (pa.seq !== pb.seq) return pb.seq - pa.seq;
  return b.localeCompare(a);
}

/** Persist a report reference on this device. Does not reshuffle on re-open. */
export function saveGuestReportId(reportId: string) {
  const id = reportId.trim();
  if (!id) return;
  const existing = readIds();
  if (existing.includes(id)) return;
  writeIds([id, ...existing].slice(0, MAX_IDS));
}

/** Drop a reference that is no longer on the server (or was only a draft). */
export function removeGuestReportId(reportId: string) {
  const id = reportId.trim();
  if (!id) return;
  writeIds(readIds().filter((x) => x !== id));
}

export function listGuestReportIds(): string[] {
  return [...readIds()].sort(compareGuestReportIdsNewestFirst);
}

export function hasGuestReportId(reportId: string): boolean {
  const id = reportId.trim();
  if (!id) return false;
  return readIds().includes(id);
}

export function latestGuestReportId(): string | null {
  return listGuestReportIds()[0] ?? null;
}
