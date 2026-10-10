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
  if (raw.trim().startsWith("+") && digits.length >= 11 && digits.length <= 15) {
    return `+${digits}`;
  }
  return null;
}
