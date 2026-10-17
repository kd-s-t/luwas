import { NextResponse } from "next/server";
import { validateHazardReport } from "@/lib/ai/validateHazardReport";
import {
  downloadGuestMediaBytes,
  getGuestReportDoc,
  patchGuestReportFields,
} from "@/lib/reports/serverGuestWrite";
import { computeReportTrust } from "@/lib/reports/trustScore";
import type {
  ReportHazardHint,
  ReportMediaSource,
  ReportMediaType,
  ReportStatus,
} from "@/lib/reports/types";
import { refineReportTitle } from "@/lib/reports/types";

export const runtime = "nodejs";
/** Guest AI can take 20s+ with photo + Gemini. */
export const maxDuration = 60;

const LEGACY_GUEST_REPORT_ID = /^LUW-\d{6}-\d{4}$/i;
const PLACE_GUEST_REPORT_ID =
  /^[A-Z]{2,4}-[A-Z0-9]{2,8}-[A-Z0-9]{2,10}-\d{6}-\d{4}$/i;

type Body = {
  reportId: string;
  /** Optional overrides; server prefers the stored report when omitted. */
  title?: string;
  notes?: string;
  hazardHint?: ReportHazardHint;
  mediaType?: ReportMediaType;
  mediaMime?: string;
  mediaBase64?: string;
  voiceTranscript?: string;
  fileName?: string;
};

function isGuestReportId(id: string): boolean {
  return (
    LEGACY_GUEST_REPORT_ID.test(id) || PLACE_GUEST_REPORT_ID.test(id)
  );
}

function mediaPathFileName(mediaPath: string): string | undefined {
  const part = mediaPath.split("/").pop()?.trim();
  return part || undefined;
}

/**
 * Run Gemini (or local fallback) for a guest report and persist the verdict
 * server-side so browser navigation cannot drop the write-back.
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const reportId =
    typeof body.reportId === "string" ? body.reportId.trim() : "";
  if (!reportId || !isGuestReportId(reportId)) {
    return NextResponse.json({ error: "guest reportId required" }, { status: 400 });
  }

  let existing: Record<string, unknown> | null;
  try {
    existing = await getGuestReportDoc(reportId);
  } catch (err) {
    console.error("[guest-validate] read failed", err);
    return NextResponse.json({ error: "Failed to read report" }, { status: 502 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const citizenUid = String(existing.citizenUid ?? "");
  if (citizenUid !== "web-guest" && citizenUid !== "ios-guest") {
    return NextResponse.json({ error: "Not a guest report" }, { status: 403 });
  }

  // Already validated — idempotent success for retries / keepalive duplicates.
  if (existing.aiVerdict != null && existing.aiReason != null) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reportId,
      source: existing.aiSource ?? null,
      verdict: existing.aiVerdict,
    });
  }

  const title =
    (typeof body.title === "string" && body.title.trim()) ||
    String(existing.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const notes =
    (typeof body.notes === "string" ? body.notes.trim() : "") ||
    String(existing.notes ?? "");
  const hazardHint =
    body.hazardHint ??
    (existing.hazardHint as ReportHazardHint | undefined) ??
    "other";
  const mediaType =
    body.mediaType === "video" || existing.mediaType === "video"
      ? "video"
      : "photo";
  const mediaMime =
    (typeof body.mediaMime === "string" && body.mediaMime) ||
    String(existing.mediaMime ?? "") ||
    (mediaType === "video" ? "video/mp4" : "image/jpeg");
  const voiceTranscript =
    (typeof body.voiceTranscript === "string" && body.voiceTranscript.trim()) ||
    (typeof existing.voiceTranscript === "string"
      ? existing.voiceTranscript.trim()
      : "") ||
    undefined;

  let mediaBase64 = body.mediaBase64?.trim() || undefined;
  let resolvedMime = mediaMime;
  if (!mediaBase64 && mediaType === "photo") {
    const mediaPath = String(existing.mediaPath ?? "").trim();
    if (mediaPath) {
      try {
        const downloaded = await downloadGuestMediaBytes(mediaPath);
        if (downloaded && downloaded.bytes.length > 0) {
          // Cap inline size for Gemini (~4MB request budget).
          if (downloaded.bytes.length <= 4 * 1024 * 1024) {
            mediaBase64 = downloaded.bytes.toString("base64");
            resolvedMime = downloaded.contentType || mediaMime;
          }
        }
      } catch (err) {
        console.error("[guest-validate] media download failed", err);
      }
    }
  }

  const ai = await validateHazardReport({
    title,
    notes,
    hazardHint,
    mediaType,
    mediaMime: resolvedMime,
    mediaBase64,
    voiceTranscript,
    fileName: body.fileName || mediaPathFileName(String(existing.mediaPath ?? "")),
  });

  // AI legit → Verified (legit). Guests no longer stay in Queue when models agree.
  const status: ReportStatus =
    ai.verdict === "rejected"
      ? "rejected"
      : ai.verdict === "needs_review"
        ? "needs_review"
        : "legit";

  const mediaSource =
    (existing.mediaSource as ReportMediaSource | null | undefined) ??
    "desktop-file";
  const lat =
    typeof existing.lat === "number" && Number.isFinite(existing.lat)
      ? existing.lat
      : null;
  const lng =
    typeof existing.lng === "number" && Number.isFinite(existing.lng)
      ? existing.lng
      : null;
  const locationAccuracyM =
    typeof existing.locationAccuracyM === "number" &&
    Number.isFinite(existing.locationAccuracyM)
      ? existing.locationAccuracyM
      : null;
  const phone =
    typeof existing.reporterPhone === "string"
      ? existing.reporterPhone
      : null;

  const trust = computeReportTrust({
    registered: false,
    idVerified: false,
    email: null,
    phone,
    emailVerified: false,
    mediaSource,
    lat,
    lng,
    locationAccuracyM,
    aiConfidence: ai.confidence,
    aiVerdict: ai.verdict,
    vertexClass: ai.vertexClass,
    vertexConfidence: ai.vertexConfidence,
    vertexLocationPlaceId: ai.vertexLocationPlaceId,
    vertexLocationLabel: ai.vertexLocationLabel,
    vertexLocationConfidence: ai.vertexLocationConfidence,
  });

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status,
    aiVerdict: ai.verdict,
    aiConfidence: ai.confidence,
    aiReason: ai.reason,
    aiSource: ai.source,
    aiModel: ai.model,
    aiPriority: ai.priority,
    aiPriorityFactors: ai.priorityFactors,
    vertexClass: ai.vertexClass,
    vertexConfidence: ai.vertexConfidence,
    vertexLocationLabel: ai.vertexLocationLabel,
    vertexLocationConfidence: ai.vertexLocationConfidence,
    vertexLocationPlaceId: ai.vertexLocationPlaceId,
    vertexLocationPlaceLabel: ai.vertexLocationPlaceLabel,
    validatedAt: now,
    updatedAt: now,
    trustScore: trust.total,
    trustBreakdown: trust,
  };
  const detectedHint = ai.hazardHint || null;
  const nextTitle = detectedHint
    ? refineReportTitle(title, detectedHint)
    : title;
  if (detectedHint) {
    patch.hazardHint = detectedHint;
  }
  if (nextTitle !== title) {
    patch.title = nextTitle;
  }

  try {
    await patchGuestReportFields(reportId, patch);
  } catch (err) {
    console.error("[guest-validate] write failed", err);
    return NextResponse.json(
      { error: "Failed to write AI verdict" },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    reportId,
    status,
    verdict: ai.verdict,
    confidence: ai.confidence,
    source: ai.source,
    model: ai.model,
    reason: ai.reason,
    hazardHint: detectedHint,
    title: nextTitle,
    priority: ai.priority,
    vertexClass: ai.vertexClass,
    vertexConfidence: ai.vertexConfidence,
    vertexSource: ai.vertexSource,
  });
}
