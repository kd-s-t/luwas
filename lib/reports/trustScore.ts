import type { ReportMediaSource } from "@/lib/reports/types";

/**
 * Report trust stack (max 100).
 *
 * Caps: identity 15 · contact 10 · capture 45 · Vertex 10 · Gemini 20
 * → registered+ID+contacts+tight field capture = 70 before AI models
 * → + Vertex vision + Gemini = up to 100
 */
export const TRUST_CAPS = {
  identity: 15,
  contact: 10,
  capture: 45,
  vertex: 10,
  ai: 20,
} as const;

export type ReportTrustBreakdown = {
  identity: number;
  contact: number;
  capture: number;
  /** Vertex image class (+ location when available). */
  vertex: number;
  /** Gemini (or local) verdict confidence. */
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
  /** Vertex hazard class (e.g. fire, flood, unrelated). */
  vertexClass?: string | null;
  /** Vertex class confidence 0–1. */
  vertexConfidence?: number | null;
  /** Curated place id when Vertex matched a service-area place. */
  vertexLocationPlaceId?: string | null;
  /** Free-text place from Vertex vision. */
  vertexLocationLabel?: string | null;
  vertexLocationConfidence?: number | null;
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
    // Tight field fix — full capture cap.
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

function scoreVertex(input: TrustScoreInput): number {
  const cls = input.vertexClass?.trim().toLowerCase() ?? "";
  const conf = input.vertexConfidence;
  if (!cls || conf == null || !Number.isFinite(conf)) return 0;
  const c = Math.min(1, Math.max(0, conf));
  // Unrelated photo = weak trust for a hazard claim.
  if (cls === "unrelated") {
    return Math.round(TRUST_CAPS.vertex * c * 0.2);
  }
  let score = TRUST_CAPS.vertex * c;
  if (input.vertexLocationPlaceId) {
    score = Math.min(TRUST_CAPS.vertex, score + 1);
  } else if (
    input.vertexLocationLabel?.trim() &&
    (input.vertexLocationConfidence ?? 0) >= 0.5
  ) {
    score = Math.min(TRUST_CAPS.vertex, score + 0.5);
  }
  return Math.round(score);
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
  const vertex = scoreVertex(input);
  const ai = scoreAi(input);
  const total = Math.min(
    100,
    Math.max(0, identity + contact + capture + vertex + ai),
  );
  return { identity, contact, capture, vertex, ai, total };
}

export function trustLabel(total: number): string {
  if (total >= 80) return "High trust";
  if (total >= 55) return "Moderate trust";
  if (total >= 30) return "Low trust";
  return "Untrusted";
}

export function formatTrustBreakdown(b: ReportTrustBreakdown): string {
  const vertex = typeof b.vertex === "number" ? b.vertex : 0;
  return `ID ${b.identity}/${TRUST_CAPS.identity} · contact ${b.contact}/${TRUST_CAPS.contact} · allow location · mobile camera ${b.capture}/${TRUST_CAPS.capture} · Vertex ${vertex}/${TRUST_CAPS.vertex} · Gemini ${b.ai}/${TRUST_CAPS.ai}`;
}
