import type { ReactionCounts } from "@/lib/reports/socialTypes";
import type { ReportTrustBreakdown } from "@/lib/reports/trustScore";

export type ReportMediaType = "photo" | "video";

/** How media entered the form — camera-first field vs desk file upload. */
export type ReportMediaSource = "mobile-camera" | "desktop-file";

/** Officer on-site photos of what is happening (images only). */
export type FieldEvidenceImage = {
  mediaPath: string;
  mediaUrl: string;
  mediaMime: string;
  uploadedAt: string;
  uploadedByUid: string | null;
  uploadedByName: string | null;
};

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

/** Officer assigned to investigate / respond on an incident. */
export type ReportAssignee = {
  uid: string;
  name: string;
  assignedAt: string;
};

/** Gemini resource / response priority for an incident report. */
export type ReportPriority = "critical" | "high" | "medium" | "low";

/** Why Gemini chose a priority (resource allocation factors). */
export type ReportPriorityFactors = {
  immediateSeverity: string;
  peopleAffected: string;
  existingCoverage: string;
  deliveryFeasibility: string;
  evidenceQuality: string;
};

export function reportPriorityLabel(priority: ReportPriority): string {
  switch (priority) {
    case "critical":
      return "P1 Critical";
    case "high":
      return "P2 High";
    case "medium":
      return "P3 Medium";
    case "low":
      return "P4 Low";
  }
}

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

/** Intent/draft placeholders — replace with AI hazard label when detected. */
const GENERIC_REPORT_TITLES = new Set([
  "I need help",
  "Someone else needs help",
  "Hazard report",
  "Hazard report for someone else",
]);

/**
 * After Vertex / Gemini: replace intent placeholders with the detected hazard
 * (e.g. "I need help" → "Fire").
 */
export function refineReportTitle(
  title: string,
  hazardHint: ReportHazardHint | null | undefined,
): string {
  if (!hazardHint || hazardHint === "other") return title;
  const label = hazardHintLabel(hazardHint);
  const trimmed = title.trim();
  if (!trimmed || GENERIC_REPORT_TITLES.has(trimmed)) {
    return label;
  }
  // iOS / ingest place titles: "Help needed · Brgy. X"
  const placeMatch = trimmed.match(/^(Help needed|Hazard)\s*·\s*(.+)$/i);
  if (placeMatch) {
    return `${label} · ${placeMatch[2].trim()}`;
  }
  // Intent phrase buried in a short title.
  if (/^(i need help|someone else needs help|help needed)\b/i.test(trimmed)) {
    return label;
  }
  return title;
}

/**
 * Ops pipeline:
 * queue → assigned → verified (legit) → dispatched → done
 * Side paths: needs_review / validating / failed / rejected
 */
export type ReportStatus =
  | "draft"
  | "queued"
  | "validating"
  | "assigned"
  | "legit"
  | "dispatched"
  | "done"
  | "rejected"
  | "needs_review"
  | "failed";

/** Happy-path pipeline after intake. */
export const REPORT_PIPELINE: ReportStatus[] = [
  "queued",
  "assigned",
  "legit",
  "dispatched",
  "done",
];

/** In-progress citizen wizard step persisted on draft reports. */
export type ReportDraftStep = "situation" | "location" | "review";

/** Audit of responder outreach after a report is verified/legit. */
export type ReportDispatchLog = {
  at: string;
  /** Station / unit labels that received a voice call. */
  called: string[];
  /** Station / unit labels that received SMS. */
  texted: string[];
  /** Short one-line summary for list UIs. */
  summary: string;
};

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
  /** Gemini (or local fallback) response priority. */
  aiPriority: ReportPriority | null;
  /** Factor notes behind aiPriority. */
  aiPriorityFactors: ReportPriorityFactors | null;
  /** Vertex AutoML / vision top class (e.g. flood, accident, unrelated). */
  vertexClass: string | null;
  vertexConfidence: number | null;
  /** Visual place from Vertex Gemini (free-text). */
  vertexLocationLabel: string | null;
  vertexLocationConfidence: number | null;
  /** Curated place id when vision label matched a service-area place. */
  vertexLocationPlaceId: string | null;
  vertexLocationPlaceLabel: string | null;
  validatedAt: string | null;
  /**
   * Officers assigned to this incident (multi-assign).
   * `investigatorUid` / `investigatorName` mirror the lead (first) assignee.
   */
  assignees: ReportAssignee[];
  /** Lead investigator (first assignee). Kept for older readers. */
  investigatorUid: string | null;
  investigatorName: string | null;
  investigatedAt: string | null;
  /** When set, nearest responders were already auto-dialed for this legit report. */
  autoResponderCallAt: string | null;
  /** When the ops status moved to dispatched (board “out” timer). */
  dispatchedAt: string | null;
  /** Who was called / texted after verification (dispatch audit). */
  dispatchLog: ReportDispatchLog | null;
  /** Officer manually checked “Dispatch someone” on the incident checklist. */
  manualDispatchChecked: boolean;
  /** On-site photos uploaded by the investigator (images only). */
  fieldEvidence: FieldEvidenceImage[];
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
  /** Wizard progress while status is draft (optional on older docs). */
  draftStep?: ReportDraftStep | null;
  draftIntent?: "needHelp" | "reportHazard" | null;
  draftReportFor?: "myself" | "someoneElse" | null;
  createdAt: string;
  updatedAt: string;
};
