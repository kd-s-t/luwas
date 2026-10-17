import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { validateHazardReport } from "@/lib/ai/validateHazardReport";
import { upsertHazardReportToBigQuery } from "@/lib/bigquery/hazardReports";
import {
  DEFAULT_REPORT_BARANGAY,
  DEFAULT_REPORT_LGU,
  placeFromCoords,
} from "@/lib/reports/barangayScope";
import {
  isGuestReportId,
  newPlaceReportId,
  normalizeReportId,
} from "@/lib/reports/reportId";
import {
  firestoreEmulatorHost,
  putGuestReportDoc,
  uploadGuestMediaBytes,
} from "@/lib/reports/serverGuestWrite";
import { EMPTY_REACTION_COUNTS } from "@/lib/reports/socialTypes";
import { sanitizeGuestReporterPhone } from "@/lib/auth/demoAccount";
import { computeReportTrust } from "@/lib/reports/trustScore";
import type {
  HazardReport,
  ReportHazardHint,
  ReportStatus,
} from "@/lib/reports/types";
import { refineReportTitle } from "@/lib/reports/types";

export const runtime = "nodejs";

type Body = {
  reference?: string;
  situation?: string;
  placeLabel?: string;
  landmark?: string;
  latitude?: number | null;
  longitude?: number | null;
  approximateLocation?: boolean;
  mobileNumber?: string;
  photoNames?: string[];
  intent?: string;
  aiCategory?: string;
  aiVerdict?: string;
  aiConfidence?: number;
  aiReason?: string;
  vertexClass?: string;
  vertexConfidence?: number;
  citizenName?: string;
  citizenPurok?: string;
  /** `ios` (default) or `web` guest — no login. */
  source?: string;
  /** Optional photo from web guest (base64, no data: prefix). */
  mediaBase64?: string;
  mediaMime?: string;
  /** Optional voice note label + audio from web guest. */
  voiceNoteLabel?: string;
  voiceBase64?: string;
  voiceMime?: string;
  voiceTranscript?: string;
};

function hazardFromText(text: string, category?: string): ReportHazardHint {
  const t = `${text} ${category ?? ""}`.toLowerCase();
  if (t.includes("flood") || t.includes("baha")) return "flood";
  if (t.includes("landslide") || t.includes("guho") || t.includes("gusaw"))
    return "landslide";
  if (
    /road.?block|blockage|blocked road|fallen tree|debris|impassable|hindi.?makadaan|road closed|access road/.test(
      t,
    )
  )
    return "blockage";
  if (t.includes("fire") || t.includes("sunog")) return "fire";
  if (
    /crime|hold.?up|robbery|theft|nakaw|assault|stab|shoot|gunshot|snatch/.test(
      t,
    )
  )
    return "crime";
  if (
    /accident|banggaan|crash|collision|vehicular|hit.?and.?run|road.?crash/.test(
      t,
    )
  )
    return "accident";
  if (
    t.includes("typhoon") ||
    t.includes("bagyo") ||
    t.includes("tino") ||
    t.includes("wind")
  )
    return "typhoon";
  if (t.includes("evac") || t.includes("shelter")) return "evac";
  return "other";
}

function projectId(): string {
  return process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || "demo-dro";
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const situationRaw =
    typeof body.situation === "string" ? body.situation.trim() : "";

  const lat = typeof body.latitude === "number" ? body.latitude : null;
  const lng = typeof body.longitude === "number" ? body.longitude : null;
  const resolvedPlace =
    placeFromCoords(lat, lng) ?? {
      barangay: DEFAULT_REPORT_BARANGAY,
      lgu: DEFAULT_REPORT_LGU,
    };

  const referenceRaw =
    typeof body.reference === "string" ? body.reference.trim() : "";
  const reference = isGuestReportId(referenceRaw)
    ? normalizeReportId(referenceRaw)
    : newPlaceReportId({
        barangay: resolvedPlace.barangay,
        lgu: resolvedPlace.lgu,
      });
  const placeLabel =
    typeof body.placeLabel === "string" && body.placeLabel.trim()
      ? body.placeLabel.trim()
      : `Brgy. ${resolvedPlace.barangay}, ${resolvedPlace.lgu}`;
  const landmark =
    typeof body.landmark === "string" ? body.landmark.trim() : "";
  const phone =
    sanitizeGuestReporterPhone(
      typeof body.mobileNumber === "string" ? body.mobileNumber.trim() : "",
    ) ?? "";
  const photoNames = Array.isArray(body.photoNames)
    ? body.photoNames.map(String).filter(Boolean)
    : [];
  const source = body.source === "web" ? "web" : "ios";
  const citizenUid = source === "web" ? "web-guest" : "ios-guest";
  const citizenName =
    typeof body.citizenName === "string" && body.citizenName.trim()
      ? body.citizenName.trim()
      : source === "web"
        ? "Guest"
        : "iOS guest";
  const citizenPurok =
    typeof body.citizenPurok === "string" && body.citizenPurok.trim()
      ? body.citizenPurok.trim()
      : source === "web"
        ? "No login"
        : "Field";

  const voiceNoteLabel =
    typeof body.voiceNoteLabel === "string" ? body.voiceNoteLabel.trim() : "";
  const voiceTranscript =
    typeof body.voiceTranscript === "string"
      ? body.voiceTranscript.trim()
      : "";

  // Situation text is optional on web; pad from place / voice / intent.
  const situation =
    situationRaw.length >= 12
      ? situationRaw
      : [
          situationRaw,
          voiceTranscript ? `Voice: ${voiceTranscript}` : "",
          body.intent === "needHelp" ? "I need help" : "Hazard report",
          `Near ${placeLabel}`,
        ]
          .filter(Boolean)
          .join(". ")
          .trim();

  if (situation.length < 12) {
    return NextResponse.json(
      { error: "situation or place required" },
      { status: 400 },
    );
  }

  const hazardHint = hazardFromText(
    `${situation} ${voiceTranscript}`,
    body.aiCategory,
  );
  const title =
    body.intent === "needHelp"
      ? `Help needed · ${placeLabel}`
      : `Hazard · ${placeLabel}`;
  const notes = [
    situationRaw || situation,
    landmark ? `Landmark: ${landmark}` : "",
    voiceNoteLabel ? `Voice: ${voiceNoteLabel}` : "",
    voiceTranscript ? `Transcript: ${voiceTranscript}` : "",
    body.intent === "needHelp"
      ? "Intent: I need help"
      : body.intent === "reportHazard"
        ? "Intent: Report a hazard"
        : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const mediaMimeRaw =
    typeof body.mediaMime === "string" && body.mediaMime.trim()
      ? body.mediaMime.trim()
      : "image/jpeg";

  const now = new Date().toISOString();
  let mediaUrl = "";
  let mediaMime = "";
  let mediaPath = "";

  const rawB64 =
    typeof body.mediaBase64 === "string" ? body.mediaBase64.trim() : "";
  const useEmuFs = Boolean(firestoreEmulatorHost());
  // Photo is optional. Never substitute bundled demo scenes for missing photos.
  if (rawB64) {
    const ext =
      mediaMimeRaw.includes("png")
        ? "png"
        : mediaMimeRaw.includes("webp")
          ? "webp"
          : mediaMimeRaw.includes("gif")
            ? "gif"
            : "jpg";
    const bytes = Buffer.from(rawB64, "base64");
    if (bytes.length < 32) {
      return NextResponse.json(
        { error: "Photo data is empty or invalid" },
        { status: 400 },
      );
    }
    if (useEmuFs) {
      const relDir = path.join("reports", "guest");
      const fileName = `${reference}.${ext}`;
      const absDir = path.join(process.cwd(), "public", relDir);
      await mkdir(absDir, { recursive: true });
      await writeFile(path.join(absDir, fileName), bytes);
      mediaUrl = `/${relDir}/${fileName}`;
      mediaMime = mediaMimeRaw;
      mediaPath = mediaUrl;
    } else {
      try {
        const uploaded = await uploadGuestMediaBytes({
          objectPath: `reports/web-guest/${reference}/photo.${ext}`,
          bytes,
          contentType: mediaMimeRaw,
        });
        mediaUrl = uploaded.mediaUrl;
        mediaPath = uploaded.mediaPath;
        mediaMime = mediaMimeRaw;
      } catch (err) {
        console.error("[ios-ingest] guest photo upload failed", err);
        return NextResponse.json(
          {
            error:
              err instanceof Error
                ? err.message
                : "Failed to upload report photo",
          },
          { status: 502 },
        );
      }
    }
  }

  let voiceUrl: string | null = null;
  let voicePath: string | null = null;
  let voiceMimeOut: string | null = null;
  const voiceB64 =
    typeof body.voiceBase64 === "string" ? body.voiceBase64.trim() : "";
  const voiceMimeRaw =
    typeof body.voiceMime === "string" && body.voiceMime.trim()
      ? body.voiceMime.trim()
      : "audio/webm";
  if (voiceB64) {
    const ext =
      voiceMimeRaw.includes("mp4") || voiceMimeRaw.includes("aac")
        ? "m4a"
        : voiceMimeRaw.includes("ogg")
          ? "ogg"
          : "webm";
    const bytes = Buffer.from(voiceB64, "base64");
    if (useEmuFs) {
      const relDir = path.join("reports", "guest");
      const fileName = `${reference}-voice.${ext}`;
      const absDir = path.join(process.cwd(), "public", relDir);
      await mkdir(absDir, { recursive: true });
      await writeFile(path.join(absDir, fileName), bytes);
      voiceUrl = `/${relDir}/${fileName}`;
      voicePath = voiceUrl;
      voiceMimeOut = voiceMimeRaw;
    } else {
      try {
        const uploaded = await uploadGuestMediaBytes({
          objectPath: `reports/web-guest/${reference}/voice.${ext}`,
          bytes,
          contentType: voiceMimeRaw,
        });
        voiceUrl = uploaded.mediaUrl;
        voicePath = uploaded.mediaPath;
        voiceMimeOut = voiceMimeRaw;
      } catch (err) {
        console.error("[ios-ingest] guest voice upload failed", err);
      }
    }
  }

  const place = resolvedPlace;

  // Prod: Gemini (photo bytes when present). Local rules only if Gemini fails / key missing.
  const ai = await validateHazardReport({
    title,
    notes,
    hazardHint,
    mediaType: "photo",
    mediaMime: mediaMime || mediaMimeRaw,
    mediaBase64: rawB64 || undefined,
    fileName: photoNames[0] ?? `${source}-photo.jpg`,
  });
  const detectedHint = ai.hazardHint || hazardHint;
  const displayTitle = refineReportTitle(title, detectedHint);
  const aiVerdict = ai.verdict;
  const aiConfidence = ai.confidence;
  const aiReason = `[${source}] ${ai.reason}`;
  const aiSource = ai.source;
  const aiModel = ai.model ?? `${source}-${ai.source}`;
  const vertexClass = ai.vertexClass;
  const vertexConfidence = ai.vertexConfidence;
  const vertexLocationLabel = ai.vertexLocationLabel;
  const vertexLocationConfidence = ai.vertexLocationConfidence;
  const vertexLocationPlaceId = ai.vertexLocationPlaceId;
  const vertexLocationPlaceLabel = ai.vertexLocationPlaceLabel;

  // AI legit → Verified. needs_review / rejected stay for officer triage.
  const status: ReportStatus =
    aiVerdict === "rejected"
      ? "rejected"
      : aiVerdict === "needs_review"
        ? "needs_review"
        : "legit";

  const trust = computeReportTrust({
    registered: false,
    idVerified: false,
    email: null,
    phone: phone || null,
    emailVerified: false,
    mediaSource: "mobile-camera",
    lat,
    lng,
    locationAccuracyM: body.approximateLocation ? 120 : 35,
    aiConfidence,
    aiVerdict,
    vertexClass,
    vertexConfidence,
    vertexLocationPlaceId,
    vertexLocationLabel,
    vertexLocationConfidence,
  });

  const payload: Record<string, unknown> = {
    citizenUid,
    citizenName,
    citizenPurok,
    barangay: place.barangay,
    lgu: place.lgu,
    citizenPhotoURL: null,
    title: displayTitle,
    notes,
    hazardHint: detectedHint,
    mediaType: "photo",
    mediaPath,
    mediaUrl,
    mediaMime,
    mediaSource: source === "web" ? "desktop-file" : "mobile-camera",
    voiceNoteLabel: voiceNoteLabel || null,
    voicePath,
    voiceUrl,
    voiceMime: voiceMimeOut,
    voiceTranscript: voiceTranscript || null,
    lat,
    lng,
    locationAccuracyM: body.approximateLocation ? 120 : 35,
    locationLabel: placeLabel,
    device: source === "web" ? "web-ugnai-citizen" : "ios-ugnai-citizen",
    ipAddress: null,
    reporterIdVerified: false,
    reporterEmail: null,
    reporterPhone: phone || null,
    reporterEmailVerified: false,
    trustScore: trust.total,
    trustBreakdown: trust,
    status,
    aiVerdict,
    aiConfidence,
    aiReason,
    aiSource,
    aiModel,
    aiPriority: ai.priority,
    aiPriorityFactors: ai.priorityFactors,
    vertexClass,
    vertexConfidence,
    vertexLocationLabel,
    vertexLocationConfidence,
    vertexLocationPlaceId,
    vertexLocationPlaceLabel,
    validatedAt: now,
    autoResponderCallAt: null,
    dispatchedAt: null,
    dispatchLog: null,
    manualDispatchChecked: false,
    fieldEvidence: [],
    reactionCounts: { ...EMPTY_REACTION_COUNTS },
    commentCount: 0,
    source,
    iosReference: reference,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await putGuestReportDoc(reference, payload);
  } catch (err) {
    console.error("[ios-ingest] Firestore write failed", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to write report to Firestore",
      },
      { status: 502 },
    );
  }

  // Mirror final AI verdicts into BigQuery (skipped when not configured).
  void upsertHazardReportToBigQuery({
    id: reference,
    citizenUid: String(payload.citizenUid ?? ""),
    citizenName: String(payload.citizenName ?? ""),
    citizenPurok: String(payload.citizenPurok ?? ""),
    barangay: place.barangay,
    lgu: place.lgu,
    citizenPhotoURL: null,
    title: displayTitle,
    notes,
    hazardHint: detectedHint,
    mediaType: "photo",
    mediaPath,
    mediaUrl,
    mediaMime,
    mediaSource: source === "web" ? "desktop-file" : "mobile-camera",
    voiceNoteLabel: voiceNoteLabel || null,
    voicePath,
    voiceUrl,
    voiceMime: voiceMimeOut,
    voiceTranscript: voiceTranscript || null,
    lat,
    lng,
    locationAccuracyM: body.approximateLocation ? 120 : 35,
    locationLabel: placeLabel,
    device: source === "web" ? "web-ugnai-citizen" : "ios-ugnai-citizen",
    ipAddress: null,
    status,
    aiVerdict,
    aiConfidence,
    aiReason: String(payload.aiReason ?? ""),
    aiSource,
    aiModel: String(payload.aiModel ?? ""),
    aiPriority: ai.priority,
    aiPriorityFactors: ai.priorityFactors,
    vertexClass,
    vertexConfidence,
    vertexLocationLabel,
    vertexLocationConfidence,
    vertexLocationPlaceId,
    vertexLocationPlaceLabel,
    validatedAt: now,
    assignees: [],
    investigatorUid: null,
    investigatorName: null,
    investigatedAt: null,
    autoResponderCallAt: null,
    dispatchedAt: null,
    dispatchLog: null,
    manualDispatchChecked: false,
    fieldEvidence: [],
    reporterIdVerified: false,
    reporterEmail: null,
    reporterPhone: phone || null,
    reporterEmailVerified: false,
    trustScore: trust.total,
    trustBreakdown: trust,
    reactionCounts: { ...EMPTY_REACTION_COUNTS },
    commentCount: 0,
    createdAt: now,
    updatedAt: now,
  } satisfies HazardReport);

  return NextResponse.json({
    ok: true,
    id: reference,
    status,
    aiVerdict,
    saved: true,
    database: `firestore://${projectId()}/reports/${reference}`,
    message: "Report saved to Firestore and queued for barangay review",
  });
}
