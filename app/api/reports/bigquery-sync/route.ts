import { NextResponse } from "next/server";
import { upsertHazardReportToBigQuery } from "@/lib/bigquery/hazardReports";
import { EMPTY_REACTION_COUNTS } from "@/lib/reports/socialTypes";
import type { HazardReport } from "@/lib/reports/types";

export const runtime = "nodejs";

type Body = {
  report?: Partial<HazardReport> & { id?: string };
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const r = body.report;
  if (!r?.id || typeof r.id !== "string") {
    return NextResponse.json({ error: "report.id required" }, { status: 400 });
  }

  const report = {
    id: r.id,
    citizenUid: String(r.citizenUid ?? ""),
    citizenName: String(r.citizenName ?? ""),
    citizenPurok: String(r.citizenPurok ?? ""),
    barangay: String(r.barangay ?? ""),
    lgu: String(r.lgu ?? ""),
    citizenPhotoURL: r.citizenPhotoURL ?? null,
    title: String(r.title ?? ""),
    notes: String(r.notes ?? ""),
    hazardHint: (r.hazardHint ?? "other") as HazardReport["hazardHint"],
    mediaType: (r.mediaType ?? "photo") as HazardReport["mediaType"],
    mediaPath: String(r.mediaPath ?? ""),
    mediaUrl: String(r.mediaUrl ?? ""),
    mediaMime: String(r.mediaMime ?? ""),
    mediaSource: r.mediaSource ?? null,
    voiceNoteLabel: r.voiceNoteLabel ?? null,
    voicePath: r.voicePath ?? null,
    voiceUrl: r.voiceUrl ?? null,
    voiceMime: r.voiceMime ?? null,
    voiceTranscript: r.voiceTranscript ?? null,
    lat: typeof r.lat === "number" ? r.lat : null,
    lng: typeof r.lng === "number" ? r.lng : null,
    locationAccuracyM:
      typeof r.locationAccuracyM === "number" ? r.locationAccuracyM : null,
    locationLabel: r.locationLabel ?? null,
    device: r.device ?? null,
    ipAddress: r.ipAddress ?? null,
    status: (r.status ?? "queued") as HazardReport["status"],
    aiVerdict: r.aiVerdict ?? null,
    aiConfidence: typeof r.aiConfidence === "number" ? r.aiConfidence : null,
    aiReason: r.aiReason ?? null,
    aiSource: r.aiSource ?? null,
    aiModel: r.aiModel ?? null,
    vertexClass: r.vertexClass ?? null,
    vertexConfidence:
      typeof r.vertexConfidence === "number" ? r.vertexConfidence : null,
    validatedAt: r.validatedAt ?? null,
    investigatorUid: r.investigatorUid ?? null,
    investigatorName: r.investigatorName ?? null,
    investigatedAt: r.investigatedAt ?? null,
    autoResponderCallAt: r.autoResponderCallAt ?? null,
    dispatchLog: r.dispatchLog ?? null,
    reporterIdVerified: Boolean(r.reporterIdVerified),
    reporterEmail: r.reporterEmail ?? null,
    reporterPhone: r.reporterPhone ?? null,
    reporterEmailVerified: Boolean(r.reporterEmailVerified),
    trustScore: typeof r.trustScore === "number" ? r.trustScore : null,
    trustBreakdown: r.trustBreakdown ?? null,
    reactionCounts: r.reactionCounts ?? { ...EMPTY_REACTION_COUNTS },
    commentCount: typeof r.commentCount === "number" ? r.commentCount : 0,
    createdAt: String(r.createdAt ?? new Date().toISOString()),
    updatedAt: String(r.updatedAt ?? new Date().toISOString()),
  } satisfies HazardReport;

  const result = await upsertHazardReportToBigQuery(report);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 502 },
    );
  }
  return NextResponse.json({
    ok: true,
    skipped: "skipped" in result ? result.skipped : undefined,
  });
}
