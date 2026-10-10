import type { ReportMediaSource } from "@/lib/reports/types";

/**
 * Report trust stack (max 100).
 *
 * Identity + contact are floors, not “half true.”
 * Field capture is the big jump; AI is the last 20%.
 *
 * Caps: identity 20 · contact 15 · capture 45 · AI 20
 * → registered+ID+contacts+tight field capture = 80 before AI
 * → + AI = up to 100
 */
export const TRUST_CAPS = {
  identity: 20,
  contact: 15,
  capture: 45,
  ai: 20,
} as const;

export type ReportTrustBreakdown = {
  identity: number;
  contact: number;
  capture: number;
  ai: number;
  total: number;
};

export type TrustScoreInput = {
  /** Signed-in citizen / officer filing the report. */
  registered: boolean;
  idVerified: boolean;
  email: string | null | undefined;
  phone: string | null | undefined;
  /** Firebase emailVerified when available. */
  emailVerified?: boolean;
  mediaSource: ReportMediaSource | null | undefined;
  lat: number | null | undefined;
  lng: number | null | undefined;
  /** GPS accuracy in meters (lower = better). */
  locationAccuracyM: number | null | undefined;
  /** Model confidence 0–1 after AI validate; omit before AI runs. */
  aiConfidence?: number | null;
  /** If AI rejected hard, clamp AI slice to 0. */
  aiVerdict?: "legit" | "rejected" | "needs_review" | null;
};

function hasUsableEmail(email: string | null | undefined): boolean {
  const e = email?.trim() ?? "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function hasUsablePhone(phone: string | null | undefined): boolean {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 10;
}

function scoreIdentity(input: TrustScoreInput): number {
  if (!input.registered) return 0;
  if (input.idVerified) return TRUST_CAPS.identity;
  // Registered but ID not verified yet — partial.
  return Math.round(TRUST_CAPS.identity * 0.55);
}

function scoreContact(input: TrustScoreInput): number {
  const emailOk = hasUsableEmail(input.email);
  const phoneOk = hasUsablePhone(input.phone);
  if (!emailOk && !phoneOk) return 0;
  // Full contact slice needs both; emailVerified preferred when present.
  if (emailOk && phoneOk) {
    if (input.emailVerified === false) {
      return Math.round(TRUST_CAPS.contact * 0.7);
    }
    return TRUST_CAPS.contact;
  }
  return Math.round(TRUST_CAPS.contact * 0.45);
}

function scoreCapture(input: TrustScoreInput): number {
  const hasGps =
    typeof input.lat === "number" &&
    typeof input.lng === "number" &&
    Number.isFinite(input.lat) &&
    Number.isFinite(input.lng);
  const mobile = input.mediaSource === "mobile-camera";
  const accuracy =
    typeof input.locationAccuracyM === "number" &&
    Number.isFinite(input.locationAccuracyM)
      ? input.locationAccuracyM
      : null;

  if (mobile && hasGps) {
    // Tight field fix — full capture cap (~80% stack with identity+contact).
    if (accuracy != null && accuracy <= 50) return TRUST_CAPS.capture;
    if (accuracy != null && accuracy <= 120) {
      return Math.round(TRUST_CAPS.capture * 0.85);
    }
    // GPS present but coarse / unknown accuracy.
    return Math.round(TRUST_CAPS.capture * 0.72);
  }
  if (mobile && !hasGps) return Math.round(TRUST_CAPS.capture * 0.45);
  if (!mobile && hasGps) return Math.round(TRUST_CAPS.capture * 0.4);
  return 0;
}

function scoreAi(input: TrustScoreInput): number {
  if (input.aiConfidence == null || !Number.isFinite(input.aiConfidence)) {
    return 0;
  }
  if (input.aiVerdict === "rejected") return 0;
  const c = Math.min(1, Math.max(0, input.aiConfidence));
  if (input.aiVerdict === "needs_review") {
    return Math.round(TRUST_CAPS.ai * c * 0.55);
  }
  return Math.round(TRUST_CAPS.ai * c);
}

/** Compute trust 0–100 with per-signal breakdown. */
export function computeReportTrust(input: TrustScoreInput): ReportTrustBreakdown {
  const identity = scoreIdentity(input);
  const contact = scoreContact(input);
  const capture = scoreCapture(input);
  const ai = scoreAi(input);
  const total = Math.min(
    100,
    Math.max(0, identity + contact + capture + ai),
  );
  return { identity, contact, capture, ai, total };
}

export function trustLabel(total: number): string {
  if (total >= 80) return "High trust";
  if (total >= 55) return "Moderate trust";
  if (total >= 30) return "Low trust";
  return "Untrusted";
}

export function formatTrustBreakdown(b: ReportTrustBreakdown): string {
  return `ID ${b.identity}/${TRUST_CAPS.identity} · contact ${b.contact}/${TRUST_CAPS.contact} · capture ${b.capture}/${TRUST_CAPS.capture} · AI ${b.ai}/${TRUST_CAPS.ai}`;
}
