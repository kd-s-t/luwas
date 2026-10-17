import {
  DEFAULT_REPORT_BARANGAY,
  DEFAULT_REPORT_LGU,
} from "@/lib/reports/barangayScope";

/**
 * Place-prefixed report ids:
 *   CEB-CON-NANG-261017-0001
 *   {province}-{lgu}-{barangay}-{YYMMDD}-{####}
 *
 * Legacy guest ids (`LUW-YYMMDD-####`) still validate for track / upload.
 */

/** Province / region for this product scope. */
export const REPORT_PROVINCE_CODE = "CEB";

/** Curated LGU short codes. */
const LGU_CODES: Record<string, string> = {
  consolacion: "CON",
  "cebu city": "CC",
  "cebu-city": "CC",
  mandaue: "MAN",
  "mandaue city": "MAN",
  "mandaue-city": "MAN",
  "lapu-lapu": "LLC",
  "lapu-lapu city": "LLC",
  "lapu-lapu-city": "LLC",
  talisay: "TAL",
  "talisay city": "TAL",
  "talisay-city": "TAL",
  danao: "DAN",
  toledo: "TOL",
  carcar: "CAR",
  bogo: "BOG",
  naga: "NAGA",
  "city of naga": "NAGA",
};

/** Curated barangay short codes (fallback: first 4 letters). */
const BARANGAY_CODES: Record<string, string> = {
  nangka: "NANG",
  apas: "APAS",
  tayud: "TAYU",
  pulpogan: "PULP",
  cansaga: "CANS",
  casili: "CASI",
  "poblacion occidental": "POBO",
  "poblacion oriental": "POBR",
  lamac: "LAMA",
  jugan: "JUGA",
  lahug: "LAHU",
  mabolo: "MABO",
  pardo: "PARD",
  talamban: "TALA",
  tipolo: "TIPO",
};

/** Full place id: CEB-CON-NANG-261017-0001 */
export const PLACE_REPORT_ID_RE =
  /^[A-Z]{2,4}-[A-Z0-9]{2,8}-[A-Z0-9]{2,10}-\d{6}-\d{4}$/;

/** Legacy guest id: LUW-261017-0001 */
export const LEGACY_GUEST_REPORT_ID_RE = /^LUW-\d{6}-\d{4}$/;

function slugKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, " ")
    .replace(/[^a-z0-9\s-]/g, "");
}

function codeFromName(value: string, max = 4): string {
  const letters = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (letters.length >= 2) return letters.slice(0, max);
  return (letters + "XX").slice(0, max);
}

export function lguReportCode(lgu: string): string {
  const key = slugKey(lgu);
  return LGU_CODES[key] ?? codeFromName(key.replace(/\s+/g, ""), 4);
}

export function barangayReportCode(barangay: string): string {
  const key = slugKey(barangay);
  return BARANGAY_CODES[key] ?? codeFromName(key.replace(/\s+/g, ""), 4);
}

/** e.g. CEB-CON-NANG */
export function reportPlacePrefix(
  barangay: string = DEFAULT_REPORT_BARANGAY,
  lgu: string = DEFAULT_REPORT_LGU,
): string {
  return `${REPORT_PROVINCE_CODE}-${lguReportCode(lgu)}-${barangayReportCode(barangay)}`;
}

export function reportIdDayStamp(date: Date = new Date()): string {
  return date.toISOString().slice(2, 10).replace(/-/g, "");
}

function randomSeq(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export type NewPlaceReportIdInput = {
  barangay?: string;
  lgu?: string;
  /** Fixed sequence (padded to 4). Random 1000-9999 when omitted. */
  seq?: number | string;
  date?: Date;
};

/** Build CEB-CON-NANG-YYMMDD-#### */
export function newPlaceReportId(input: NewPlaceReportIdInput = {}): string {
  const prefix = reportPlacePrefix(
    input.barangay?.trim() || DEFAULT_REPORT_BARANGAY,
    input.lgu?.trim() || DEFAULT_REPORT_LGU,
  );
  const day = reportIdDayStamp(input.date);
  const seq =
    input.seq != null
      ? String(input.seq).replace(/\D/g, "").padStart(4, "0").slice(-4)
      : randomSeq();
  return `${prefix}-${day}-${seq}`;
}

/** @deprecated Prefer newPlaceReportId — kept as alias for guest create call sites. */
export function newGuestReportId(
  place?: { barangay?: string; lgu?: string },
): string {
  return newPlaceReportId({
    barangay: place?.barangay,
    lgu: place?.lgu,
  });
}

export function isPlaceReportId(id: string): boolean {
  return PLACE_REPORT_ID_RE.test(id.trim().toUpperCase());
}

export function isLegacyGuestReportId(id: string): boolean {
  return LEGACY_GUEST_REPORT_ID_RE.test(id.trim().toUpperCase());
}

/** Evac / desk supply request: REQ-#### */
export const REQUEST_REPORT_ID_RE = /^REQ-\d{4}$/;

export function newRequestReportId(): string {
  return `REQ-${randomSeq()}`;
}

export function isRequestReportId(id: string): boolean {
  return REQUEST_REPORT_ID_RE.test(id.trim().toUpperCase());
}

/** Guest track / upload: place-prefixed or legacy LUW-*. */
export function isGuestReportId(id: string): boolean {
  const raw = id.trim().toUpperCase();
  return isPlaceReportId(raw) || isLegacyGuestReportId(raw);
}

export function normalizeReportId(id: string): string {
  const raw = id.trim();
  if (isGuestReportId(raw) || isRequestReportId(raw)) return raw.toUpperCase();
  return raw;
}

/** Nangka default prefix used by demo seeds. */
export const NANGKA_REPORT_PREFIX = reportPlacePrefix(
  DEFAULT_REPORT_BARANGAY,
  DEFAULT_REPORT_LGU,
);

/** Apas (Cebu City) prefix. */
export const APAS_REPORT_PREFIX = reportPlacePrefix("Apas", "Cebu City");
