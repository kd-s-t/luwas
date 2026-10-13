import type { ReactionCounts } from "@/lib/reports/socialTypes";
import type { ReportTrustBreakdown } from "@/lib/reports/trustScore";

export type ReportMediaType = "photo" | "video";

/** How media entered the form — camera-first field vs desk file upload. */
export type ReportMediaSource = "mobile-camera" | "desktop-file";

export type ReportHazardHint =
  | "flood"
  | "landslide"
  | "typhoon"
  | "fire"
  | "crime"
  | "accident"
  | "blockage"
  | "evac"
  | "other";

/**
 * Situation is locked to Tino (Rai) / Cat 5 peak (CAT5_DURING).
 * Show storm name + SSHS category on typhoon reports.
 */
export function hazardHintLabel(hint: ReportHazardHint): string {
  switch (hint) {
    case "typhoon":
      return "Typhoon Tino · Cat 5";
    case "flood":
      return "Flood";
    case "landslide":
      return "Landslide";
    case "fire":
      return "Fire";
    case "crime":
      return "Crime";
    case "accident":
      return "Accident";
    case "blockage":
      return "Road blockage";
    case "evac":
      return "Evacuation center";
    default:
      return "Other";
  }
}

/**
 * Queue-first statuses for high upload volume.
 * queued → validating → legit | rejected | needs_review | failed
 */
export type ReportStatus =
  | "queued"
  | "validating"
  | "legit"
  | "rejected"
  | "needs_review"
  | "failed";

export type HazardReport = {
  id: string;
  citizenUid: string;
  citizenName: string;
  citizenPurok: string;
  /** Barangay the report belongs to (officer queues filter on this). */
  barangay: string;
  lgu: string;
  citizenPhotoURL: string | null;
  title: string;
  notes: string;
  hazardHint: ReportHazardHint;
  mediaType: ReportMediaType;
  mediaPath: string;
  mediaUrl: string;
  /** Optional MIME for Gemini (e.g. image/jpeg, video/mp4). */
  mediaMime: string;
  /** mobile-camera = live field capture; desktop-file = ops / relay upload. */
  mediaSource: ReportMediaSource | null;
  /** Optional citizen voice note attached to the report. */
  voiceNoteLabel: string | null;
  voicePath: string | null;
  voiceUrl: string | null;
  voiceMime: string | null;
  /** Speech-to-text of the voice note (Gemini or local fallback). */
  voiceTranscript: string | null;
  lat: number | null;
  lng: number | null;
  /** Auto-captured GPS accuracy in meters, when available. */
  locationAccuracyM: number | null;
  /** Human-readable auto location line (coords or unavailable). */
  locationLabel: string | null;
  /** Auto device summary from user-agent. */
  device: string | null;
  /** Auto client IP from request headers. */
  ipAddress: string | null;
  status: ReportStatus;
  aiVerdict: "legit" | "rejected" | "needs_review" | null;
  aiConfidence: number | null;
  aiReason: string | null;
  aiSource: "gemini" | "local" | null;
  aiModel: string | null;
  /** Vertex AutoML top class (e.g. flood, accident, unrelated). */
  vertexClass: string | null;
  vertexConfidence: number | null;
  validatedAt: string | null;
  /** When set, nearest responders were already auto-dialed for this legit report. */
  autoResponderCallAt: string | null;
  /** Reporter signals used for trust scoring. */
  reporterIdVerified: boolean;
  reporterEmail: string | null;
  reporterPhone: string | null;
  reporterEmailVerified: boolean;
  /** 0–100 composite trust (identity + contact + capture + AI). */
  trustScore: number | null;
  trustBreakdown: ReportTrustBreakdown | null;
  reactionCounts: ReactionCounts;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
};
