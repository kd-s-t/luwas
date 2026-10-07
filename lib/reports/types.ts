import type { ReactionCounts } from "@/lib/reports/socialTypes";

export type ReportMediaType = "photo" | "video";

export type ReportHazardHint =
  | "flood"
  | "landslide"
  | "typhoon"
  | "fire"
  | "other";

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
  citizenPhotoURL: string | null;
  title: string;
  notes: string;
  hazardHint: ReportHazardHint;
  mediaType: ReportMediaType;
  mediaPath: string;
  mediaUrl: string;
  /** Optional MIME for Gemini (e.g. image/jpeg, video/mp4). */
  mediaMime: string;
  lat: number | null;
  lng: number | null;
  status: ReportStatus;
  aiVerdict: "legit" | "rejected" | "needs_review" | null;
  aiConfidence: number | null;
  aiReason: string | null;
  aiSource: "gemini" | "local" | null;
  aiModel: string | null;
  validatedAt: string | null;
  reactionCounts: ReactionCounts;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
};
