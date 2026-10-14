/** Normalize PH mobile / landline to E.164 (+63…). Returns null if unusable. */
export function toE164Ph(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  // Never auto-dial national emergency short codes.
  if (digits === "911" || digits === "117") return null;

  if (digits.startsWith("63") && (digits.length === 12 || digits.length === 11)) {
    return `+${digits}`;
  }
  // Mobile: 09xxxxxxxxx
  if (digits.startsWith("0") && digits.length === 11 && digits[1] === "9") {
    return `+63${digits.slice(1)}`;
  }
  // Landline: 0 + area (2–3) + local — e.g. (032) 346-2847 → 0323462847
  if (
    digits.startsWith("0") &&
    digits.length >= 9 &&
    digits.length <= 10 &&
    digits[1] !== "9"
  ) {
    return `+63${digits.slice(1)}`;
  }
  if (digits.length === 10 && digits.startsWith("9")) {
    return `+63${digits}`;
  }
  // Area+local without trunk 0 — e.g. 323462847
  if (
    !digits.startsWith("0") &&
    !digits.startsWith("9") &&
    digits.length >= 8 &&
    digits.length <= 9
  ) {
    return `+63${digits}`;
  }
  // PH only — reject other country codes.
  if (raw.trim().startsWith("+") && digits.startsWith("63") && digits.length >= 11) {
    return `+${digits}`;
  }
  return null;
}

/** PH mobile only: +639XXXXXXXXX (10 digits after +63, starting with 9). */
export function toE164PhMobile(raw: string | null | undefined): string | null {
  const e164 = toE164Ph(raw);
  if (!e164 || !e164.startsWith("+63")) return null;
  const local = e164.slice(3);
  if (local.length === 10 && local.startsWith("9")) return `+63${local}`;
  return null;
}

/**
 * Keep the field locked to +63 while typing.
 * Accepts 09… / 9… / 63… paste and rewrites to +63…
 */
export function formatPhMobileInput(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("63")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (!digits) return "+63";
  return `+63${digits}`;
}
