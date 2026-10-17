import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import {
  DEFAULT_REPORT_BARANGAY,
  DEFAULT_REPORT_LGU,
  placeFromCoords,
  resolveReportPlace,
} from "@/lib/reports/barangayScope";
import { mapDispatchLog } from "@/lib/reports/dispatchLog";
import { resolveReportMediaUrl } from "@/lib/reports/mediaUrl";
import { mapReportAssignees } from "@/lib/reports/assignees";
import {
  parsePriorityFactors,
  parseReportPriority,
} from "@/lib/reports/priority";
import { EMPTY_REACTION_COUNTS } from "@/lib/reports/socialTypes";
import { computeReportTrust } from "@/lib/reports/trustScore";
import type {
  FieldEvidenceImage,
  HazardReport,
  ReportAssignee,
  ReportDraftStep,
  ReportHazardHint,
  ReportMediaSource,
  ReportMediaType,
  ReportPriority,
  ReportPriorityFactors,
  ReportStatus,
} from "@/lib/reports/types";
import { compressReportImage } from "@/lib/reports/upload";
import { sanitizeGuestReporterPhone } from "@/lib/auth/demoAccount";
import type { UserProfile } from "@/lib/auth/types";
import { isCitizen, isOfficer } from "@/lib/auth/types";
import {
  newGuestReportId,
  newPlaceReportId,
} from "@/lib/reports/reportId";
import { isStockReportMediaUrl } from "@/lib/reports/stockMedia";

export { newGuestReportId, newPlaceReportId } from "@/lib/reports/reportId";

const COL = "reports";
const GUEST_UID = "web-guest";

function mapCitizenPurok(raw: unknown): string {
  const value = String(raw ?? "").trim();
  if (value === "Demo · no login" || value === "Demo · no login.") {
    return "no login";
  }
  return value;
}

function mapFieldEvidence(raw: unknown): FieldEvidenceImage[] {
  if (!Array.isArray(raw)) return [];
  const out: FieldEvidenceImage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const mediaUrl = resolveReportMediaUrl(String(row.mediaUrl ?? ""));
    const mediaPath = String(row.mediaPath ?? "");
    if (!mediaUrl || !mediaPath) continue;
    out.push({
      mediaPath,
      mediaUrl,
      mediaMime: String(row.mediaMime ?? "image/jpeg"),
      uploadedAt: String(row.uploadedAt ?? ""),
      uploadedByUid:
        row.uploadedByUid != null ? String(row.uploadedByUid) : null,
      uploadedByName:
        row.uploadedByName != null ? String(row.uploadedByName) : null,
    });
  }
  return out;
}

function mapReport(id: string, data: Record<string, unknown>): HazardReport {
  const counts = data.reactionCounts as
    | { like?: number; helpful?: number; concern?: number }
    | undefined;
  const place = resolveReportPlace({
    barangay: data.barangay != null ? String(data.barangay) : "",
    lgu: data.lgu != null ? String(data.lgu) : "",
    citizenPurok: String(data.citizenPurok ?? ""),
    lat: typeof data.lat === "number" ? data.lat : null,
    lng: typeof data.lng === "number" ? data.lng : null,
  });
  const mediaSource = (data.mediaSource as ReportMediaSource) ?? null;
  const lat = typeof data.lat === "number" ? data.lat : null;
  const lng = typeof data.lng === "number" ? data.lng : null;
  const locationAccuracyM =
    typeof data.locationAccuracyM === "number"
      ? data.locationAccuracyM
      : null;
  const aiConfidence =
    typeof data.aiConfidence === "number" ? data.aiConfidence : null;
  const aiVerdict = (data.aiVerdict as HazardReport["aiVerdict"]) ?? null;
  const reporterIdVerified = Boolean(data.reporterIdVerified);
  const reporterEmail =
    data.reporterEmail != null ? String(data.reporterEmail) : null;
  const citizenUid = String(data.citizenUid ?? "");
  const rawPhone =
    data.reporterPhone != null ? String(data.reporterPhone) : null;
  const reporterPhone =
    citizenUid === GUEST_UID
      ? sanitizeGuestReporterPhone(rawPhone)
      : rawPhone;
  const reporterEmailVerified = Boolean(data.reporterEmailVerified);
  const trustInput = {
    registered: Boolean(citizenUid) && citizenUid !== GUEST_UID,
    idVerified: reporterIdVerified,
    email: citizenUid === GUEST_UID ? null : reporterEmail,
    phone: reporterPhone,
    emailVerified: reporterEmailVerified,
    mediaSource,
    lat,
    lng,
    locationAccuracyM,
    aiConfidence,
    aiVerdict,
  };
  // Always recompute so TRUST_CAPS changes apply on read.
  const trustBreakdown = computeReportTrust(trustInput);
  const trustScore = trustBreakdown.total;
  return {
    id,
    citizenUid,
    citizenName: String(data.citizenName ?? ""),
    citizenPurok: mapCitizenPurok(data.citizenPurok),
    barangay: place.barangay,
    lgu: place.lgu,
    citizenPhotoURL:
      data.citizenPhotoURL != null ? String(data.citizenPhotoURL) : null,
    title: String(data.title ?? ""),
    notes: String(data.notes ?? ""),
    hazardHint: (data.hazardHint as ReportHazardHint) ?? "other",
    mediaType: (data.mediaType as ReportMediaType) ?? "photo",
    mediaPath: String(data.mediaPath ?? ""),
    mediaUrl: resolveReportMediaUrl(String(data.mediaUrl ?? "")),
    mediaMime: String(data.mediaMime ?? ""),
    mediaSource,
    voiceNoteLabel:
      data.voiceNoteLabel != null ? String(data.voiceNoteLabel) : null,
    voicePath: data.voicePath != null ? String(data.voicePath) : null,
    voiceUrl:
      data.voiceUrl != null
        ? resolveReportMediaUrl(String(data.voiceUrl))
        : null,
    voiceMime: data.voiceMime != null ? String(data.voiceMime) : null,
    voiceTranscript:
      data.voiceTranscript != null ? String(data.voiceTranscript) : null,
    lat,
    lng,
    locationAccuracyM,
    locationLabel:
      data.locationLabel != null ? String(data.locationLabel) : null,
    device: data.device != null ? String(data.device) : null,
    ipAddress: data.ipAddress != null ? String(data.ipAddress) : null,
    status: (data.status as ReportStatus) ?? "queued",
    aiVerdict,
    aiConfidence,
    aiReason: data.aiReason != null ? String(data.aiReason) : null,
    aiSource: (data.aiSource as HazardReport["aiSource"]) ?? null,
    aiModel: data.aiModel != null ? String(data.aiModel) : null,
    aiPriority: parseReportPriority(data.aiPriority),
    aiPriorityFactors: parsePriorityFactors(data.aiPriorityFactors),
    vertexClass: data.vertexClass != null ? String(data.vertexClass) : null,
    vertexConfidence:
      typeof data.vertexConfidence === "number"
        ? data.vertexConfidence
        : data.vertexConfidence != null
          ? Number(data.vertexConfidence)
          : null,
    validatedAt: data.validatedAt != null ? String(data.validatedAt) : null,
    investigatorUid:
      data.investigatorUid != null ? String(data.investigatorUid) : null,
    investigatorName:
      data.investigatorName != null ? String(data.investigatorName) : null,
    investigatedAt:
      data.investigatedAt != null ? String(data.investigatedAt) : null,
    assignees: mapReportAssignees(
      data.assignees,
      data.investigatorUid != null ? String(data.investigatorUid) : null,
      data.investigatorName != null ? String(data.investigatorName) : null,
      data.investigatedAt != null ? String(data.investigatedAt) : null,
    ),
    autoResponderCallAt:
      data.autoResponderCallAt != null
        ? String(data.autoResponderCallAt)
        : data.autoFireCallAt != null
          ? String(data.autoFireCallAt)
          : null,
    dispatchedAt:
      data.dispatchedAt != null ? String(data.dispatchedAt) : null,
    dispatchLog: mapDispatchLog(data.dispatchLog),
    manualDispatchChecked: Boolean(data.manualDispatchChecked),
    fieldEvidence: mapFieldEvidence(data.fieldEvidence),
    reporterIdVerified,
    reporterEmail,
    reporterPhone,
    reporterEmailVerified,
    trustScore,
    trustBreakdown,
    reactionCounts: {
      like: Number(counts?.like ?? 0),
      helpful: Number(counts?.helpful ?? 0),
      concern: Number(counts?.concern ?? 0),
    },
    commentCount: Number(data.commentCount ?? 0),
    draftStep:
      data.draftStep === "situation" ||
      data.draftStep === "location" ||
      data.draftStep === "review"
        ? data.draftStep
        : null,
    draftIntent:
      data.draftIntent === "needHelp" || data.draftIntent === "reportHazard"
        ? data.draftIntent
        : null,
    draftReportFor:
      data.draftReportFor === "myself" ||
      data.draftReportFor === "someoneElse"
        ? data.draftReportFor
        : null,
    createdAt: String(data.createdAt ?? new Date().toISOString()),
    updatedAt: String(data.updatedAt ?? new Date().toISOString()),
  };
}

/** Drafts have no evidence yet. Never use a stock scene as placeholder media. */
const DRAFT_PLACEHOLDER_MEDIA = "draft://pending-photo";

/** Start a draft incident on step 1 — place id (guest) or uuid (signed-in). */
export async function startIncidentDraft(input: {
  author: UserProfile | null;
  intent: "needHelp" | "reportHazard";
  reportFor: "myself" | "someoneElse";
}): Promise<string> {
  const now = new Date().toISOString();
  const isGuest = !input.author;
  const id = isGuest ? newGuestReportId() : crypto.randomUUID();
  const title =
    input.intent === "needHelp"
      ? input.reportFor === "someoneElse"
        ? "Someone else needs help"
        : "I need help"
      : input.reportFor === "someoneElse"
        ? "Hazard report for someone else"
        : "Hazard report";
  const notes = [
    input.intent === "needHelp"
      ? "Intent: I need help"
      : "Intent: Report a hazard",
    input.reportFor === "someoneElse"
      ? "Report for: someone else"
      : "Report for: myself",
    "Status: draft",
  ].join("\n");

  const citizenUid = isGuest
    ? "web-guest"
    : input.author!.uid;
  const citizenName = isGuest
    ? "Guest"
    : input.author!.displayName || "Citizen";
  const citizenPurok = isGuest
    ? "no login"
    : isCitizen(input.author!)
      ? input.author!.purok
      : isOfficer(input.author!)
        ? input.author!.orgName
        : "Field";

  await setDoc(doc(getClientDb(), COL, id), {
    citizenUid,
    citizenName,
    citizenPurok,
    barangay: DEFAULT_REPORT_BARANGAY,
    lgu: DEFAULT_REPORT_LGU,
    citizenPhotoURL: input.author?.photoURL ?? null,
    title,
    notes,
    hazardHint: "other",
    mediaType: "photo",
    mediaPath: DRAFT_PLACEHOLDER_MEDIA,
    mediaUrl: DRAFT_PLACEHOLDER_MEDIA,
    mediaMime: "image/png",
    mediaSource: null,
    voiceNoteLabel: null,
    voicePath: null,
    voiceUrl: null,
    voiceMime: null,
    voiceTranscript: null,
    lat: null,
    lng: null,
    locationAccuracyM: null,
    locationLabel: null,
    device: "web-ugnai-citizen",
    ipAddress: null,
    reporterIdVerified: Boolean(input.author && isCitizen(input.author) && input.author.idVerified),
    reporterEmail: input.author?.email ?? null,
    reporterPhone:
      input.author && isCitizen(input.author) ? input.author.phone : null,
    reporterEmailVerified: false,
    trustScore: null,
    trustBreakdown: null,
    status: "draft" satisfies ReportStatus,
    aiVerdict: null,
    aiConfidence: null,
    aiReason: null,
    aiSource: null,
    aiModel: null,
    aiPriority: null,
    aiPriorityFactors: null,
    vertexClass: null,
    vertexConfidence: null,
    validatedAt: null,
    assignees: [],
    investigatorUid: null,
    investigatorName: null,
    investigatedAt: null,
    autoResponderCallAt: null,
    dispatchedAt: null,
    dispatchLog: null,
    manualDispatchChecked: false,
    fieldEvidence: [],
    reactionCounts: { ...EMPTY_REACTION_COUNTS },
    commentCount: 0,
    draftStep: "situation" satisfies ReportDraftStep,
    draftIntent: input.intent,
    draftReportFor: input.reportFor,
    source: isGuest ? "web" : "web-auth",
    iosReference: id,
    createdAt: now,
    updatedAt: now,
    createdAtServer: serverTimestamp(),
    updatedAtServer: serverTimestamp(),
  });
  return id;
}

/** Persist wizard progress on an open draft. */
export async function updateIncidentDraft(
  reportId: string,
  patch: {
    draftStep?: ReportDraftStep;
    draftIntent?: "needHelp" | "reportHazard";
    draftReportFor?: "myself" | "someoneElse";
    title?: string;
    notes?: string;
    hazardHint?: ReportHazardHint;
    lat?: number | null;
    lng?: number | null;
    locationAccuracyM?: number | null;
    locationLabel?: string | null;
    reporterPhone?: string | null;
  },
): Promise<void> {
  await updateDoc(doc(getClientDb(), COL, reportId), {
    ...patch,
    updatedAt: new Date().toISOString(),
    updatedAtServer: serverTimestamp(),
  });
}

/** Public track / detail — any report id (place / legacy LUW / signed-in). */
export async function getHazardReportById(
  reportId: string,
): Promise<HazardReport | null> {
  const id = reportId.trim();
  if (!id) return null;
  const snap = await getDoc(doc(getClientDb(), COL, id));
  if (!snap.exists()) return null;
  return mapReport(snap.id, snap.data() as Record<string, unknown>);
}

/** Live single-report feed for admin incident detail (skip all-reports wait). */
export function subscribeHazardReportById(
  reportId: string,
  onChange: (row: HazardReport | null) => void,
): Unsubscribe {
  const id = reportId.trim();
  if (!id) {
    onChange(null);
    return () => {};
  }
  return onSnapshot(doc(getClientDb(), COL, id), (snap) => {
    if (!snap.exists()) {
      onChange(null);
      return;
    }
    onChange(mapReport(snap.id, snap.data() as Record<string, unknown>));
  });
}

/** Unauthenticated guest create — place id CEB-CON-NANG-* + citizenUid web-guest. */
export async function createGuestHazardReport(input: {
  id?: string;
  title: string;
  notes: string;
  hazardHint: ReportHazardHint;
  mediaType: ReportMediaType;
  mediaPath: string;
  mediaUrl: string;
  mediaMime: string;
  mediaSource?: ReportMediaSource | null;
  voiceNoteLabel?: string | null;
  voicePath?: string | null;
  voiceUrl?: string | null;
  voiceMime?: string | null;
  voiceTranscript?: string | null;
  lat: number | null;
  lng: number | null;
  locationAccuracyM?: number | null;
  locationLabel?: string | null;
  device?: string | null;
  reporterPhone?: string | null;
  status?: Extract<ReportStatus, "queued" | "needs_review" | "rejected">;
  aiVerdict?: HazardReport["aiVerdict"];
  aiConfidence?: number | null;
  aiReason?: string | null;
  vertexClass?: string | null;
  vertexConfidence?: number | null;
}): Promise<string> {
  const now = new Date().toISOString();
  const place =
    placeFromCoords(input.lat, input.lng) ?? {
      barangay: DEFAULT_REPORT_BARANGAY,
      lgu: DEFAULT_REPORT_LGU,
    };
  const id =
    input.id ??
    newGuestReportId({ barangay: place.barangay, lgu: place.lgu });
  const status = input.status ?? "queued";
  const aiVerdict = input.aiVerdict ?? null;
  const aiConfidence =
    typeof input.aiConfidence === "number" ? input.aiConfidence : null;
  const reporterPhone = sanitizeGuestReporterPhone(input.reporterPhone);
  const trust = computeReportTrust({
    registered: false,
    idVerified: false,
    email: null,
    phone: reporterPhone,
    emailVerified: false,
    mediaSource: input.mediaSource ?? "desktop-file",
    lat: input.lat,
    lng: input.lng,
    locationAccuracyM: input.locationAccuracyM ?? null,
    aiConfidence,
    aiVerdict,
  });
  // Photo is optional (voice-only / text-only OK). Block bundled demo images only.
  const mediaUrl = input.mediaUrl?.trim() || "";
  if (mediaUrl && isStockReportMediaUrl(mediaUrl)) {
    throw new Error("Demo photos cannot be submitted as evidence.");
  }
  await setDoc(doc(getClientDb(), COL, id), {
    citizenUid: GUEST_UID,
    citizenName: "Guest",
    citizenPurok: "no login",
    barangay: place.barangay,
    lgu: place.lgu,
    citizenPhotoURL: null,
    title: input.title,
    notes: input.notes,
    hazardHint: input.hazardHint,
    mediaType: input.mediaType,
    mediaPath: input.mediaPath,
    mediaUrl: input.mediaUrl,
    mediaMime: input.mediaMime,
    mediaSource: input.mediaSource ?? "desktop-file",
    voiceNoteLabel: input.voiceNoteLabel?.trim() || null,
    voicePath: input.voicePath ?? null,
    voiceUrl: input.voiceUrl ?? null,
    voiceMime: input.voiceMime ?? null,
    voiceTranscript: input.voiceTranscript?.trim() || null,
    lat: input.lat,
    lng: input.lng,
    locationAccuracyM: input.locationAccuracyM ?? null,
    locationLabel: input.locationLabel ?? null,
    device: input.device ?? "web-ugnai-citizen",
    ipAddress: null,
    reporterIdVerified: false,
    reporterEmail: null,
    reporterPhone,
    reporterEmailVerified: false,
    trustScore: trust.total,
    trustBreakdown: trust,
    status,
    aiVerdict,
    aiConfidence,
    aiReason: input.aiReason?.trim() || null,
    // Pending until /api/reports/guest-validate writes the real source.
    aiSource: null,
    aiModel: null,
    aiPriority: null,
    aiPriorityFactors: null,
    vertexClass: input.vertexClass ?? null,
    vertexConfidence: input.vertexConfidence ?? null,
    validatedAt: aiVerdict ? now : null,
    assignees: [],
    investigatorUid: null,
    investigatorName: null,
    investigatedAt: null,
    autoResponderCallAt: null,
    dispatchedAt: null,
    dispatchLog: null,
    manualDispatchChecked: false,
    fieldEvidence: [],
    reactionCounts: { ...EMPTY_REACTION_COUNTS },
    commentCount: 0,
    draftStep: null,
    draftIntent: null,
    draftReportFor: null,
    source: "web",
    iosReference: id,
    createdAt: now,
    updatedAt: now,
    createdAtServer: serverTimestamp(),
    updatedAtServer: serverTimestamp(),
  });
  return id;
}

/**
 * Guest update for a place-prefixed (or legacy LUW-*) report already on this device.
 * Rules allow update while status stays queued / needs_review / rejected / draft.
 */
export async function updateGuestHazardReport(input: {
  id: string;
  title: string;
  notes: string;
  hazardHint: ReportHazardHint;
  mediaType: ReportMediaType;
  mediaPath: string;
  mediaUrl: string;
  mediaMime: string;
  mediaSource?: ReportMediaSource | null;
  voiceNoteLabel?: string | null;
  voicePath?: string | null;
  voiceUrl?: string | null;
  voiceMime?: string | null;
  voiceTranscript?: string | null;
  lat: number | null;
  lng: number | null;
  locationAccuracyM?: number | null;
  locationLabel?: string | null;
  device?: string | null;
  reporterPhone?: string | null;
}): Promise<string> {
  const now = new Date().toISOString();
  const id = input.id.trim();
  const reporterPhone = sanitizeGuestReporterPhone(input.reporterPhone);
  const trust = computeReportTrust({
    registered: false,
    idVerified: false,
    email: null,
    phone: reporterPhone,
    emailVerified: false,
    mediaSource: input.mediaSource ?? "desktop-file",
    lat: input.lat,
    lng: input.lng,
    locationAccuracyM: input.locationAccuracyM ?? null,
    aiConfidence: null,
    aiVerdict: null,
  });
  await updateDoc(doc(getClientDb(), COL, id), {
    citizenUid: GUEST_UID,
    source: "web",
    title: input.title,
    notes: input.notes,
    hazardHint: input.hazardHint,
    mediaType: input.mediaType,
    mediaPath: input.mediaPath,
    mediaUrl: input.mediaUrl,
    mediaMime: input.mediaMime,
    mediaSource: input.mediaSource ?? "desktop-file",
    voiceNoteLabel: input.voiceNoteLabel?.trim() || null,
    voicePath: input.voicePath ?? null,
    voiceUrl: input.voiceUrl ?? null,
    voiceMime: input.voiceMime ?? null,
    voiceTranscript: input.voiceTranscript?.trim() || null,
    lat: input.lat,
    lng: input.lng,
    locationAccuracyM: input.locationAccuracyM ?? null,
    locationLabel: input.locationLabel ?? null,
    device: input.device ?? "web-ugnai-citizen",
    reporterPhone,
    trustScore: trust.total,
    trustBreakdown: trust,
    status: "queued",
    aiVerdict: null,
    aiConfidence: null,
    aiReason: null,
    aiSource: null,
    aiModel: null,
    aiPriority: null,
    aiPriorityFactors: null,
    vertexClass: null,
    vertexConfidence: null,
    validatedAt: null,
    draftStep: null,
    draftIntent: null,
    draftReportFor: null,
    updatedAt: now,
    updatedAtServer: serverTimestamp(),
  });
  return id;
}

export async function createHazardReport(input: {
  id?: string;
  citizenUid: string;
  citizenName: string;
  citizenPurok: string;
  barangay?: string;
  lgu?: string;
  citizenPhotoURL?: string | null;
  title: string;
  notes: string;
  hazardHint: ReportHazardHint;
  mediaType: ReportMediaType;
  mediaPath: string;
  mediaUrl: string;
  mediaMime: string;
  mediaSource?: ReportMediaSource | null;
  voiceNoteLabel?: string | null;
  voicePath?: string | null;
  voiceUrl?: string | null;
  voiceMime?: string | null;
  voiceTranscript?: string | null;
  lat: number | null;
  lng: number | null;
  locationAccuracyM?: number | null;
  locationLabel?: string | null;
  device?: string | null;
  ipAddress?: string | null;
  reporterIdVerified?: boolean;
  reporterEmail?: string | null;
  reporterPhone?: string | null;
  reporterEmailVerified?: boolean;
}): Promise<string> {
  const now = new Date().toISOString();
  const place =
    placeFromCoords(input.lat, input.lng) ?? {
      barangay: input.barangay?.trim() || DEFAULT_REPORT_BARANGAY,
      lgu: input.lgu?.trim() || DEFAULT_REPORT_LGU,
    };
  const id =
    input.id ??
    newPlaceReportId({ barangay: place.barangay, lgu: place.lgu });
  const { id: _unusedId, ...fields } = input;
  void _unusedId;
  const trust = computeReportTrust({
    registered: Boolean(input.citizenUid),
    idVerified: Boolean(input.reporterIdVerified),
    email: input.reporterEmail,
    phone: input.reporterPhone,
    emailVerified: Boolean(input.reporterEmailVerified),
    mediaSource: input.mediaSource,
    lat: input.lat,
    lng: input.lng,
    locationAccuracyM: input.locationAccuracyM,
    aiConfidence: null,
    aiVerdict: null,
  });
  await setDoc(doc(getClientDb(), COL, id), {
    ...fields,
    barangay: place.barangay,
    lgu: place.lgu,
    citizenPhotoURL: input.citizenPhotoURL ?? null,
    mediaSource: input.mediaSource ?? null,
    voiceNoteLabel: input.voiceNoteLabel?.trim() || null,
    voicePath: input.voicePath ?? null,
    voiceUrl: input.voiceUrl ?? null,
    voiceMime: input.voiceMime ?? null,
    voiceTranscript: input.voiceTranscript?.trim() || null,
    locationAccuracyM: input.locationAccuracyM ?? null,
    locationLabel: input.locationLabel ?? null,
    device: input.device ?? null,
    ipAddress: input.ipAddress ?? null,
    reporterIdVerified: Boolean(input.reporterIdVerified),
    reporterEmail: input.reporterEmail?.trim() || null,
    reporterPhone: input.reporterPhone?.trim() || null,
    reporterEmailVerified: Boolean(input.reporterEmailVerified),
    trustScore: trust.total,
    trustBreakdown: trust,
    status: "queued" satisfies ReportStatus,
    aiVerdict: null,
    aiConfidence: null,
    aiReason: null,
    aiSource: null,
    aiModel: null,
    aiPriority: null,
    aiPriorityFactors: null,
    vertexClass: null,
    vertexConfidence: null,
    validatedAt: null,
    assignees: [],
    investigatorUid: null,
    investigatorName: null,
    investigatedAt: null,
    autoResponderCallAt: null,
    dispatchedAt: null,
    dispatchLog: null,
    manualDispatchChecked: false,
    fieldEvidence: [],
    reactionCounts: { ...EMPTY_REACTION_COUNTS },
    commentCount: 0,
    draftStep: null,
    draftIntent: null,
    draftReportFor: null,
    createdAt: now,
    updatedAt: now,
    createdAtServer: serverTimestamp(),
    updatedAtServer: serverTimestamp(),
  });
  return id;
}

const QUEUE_FOR_ASSIGN = new Set<ReportStatus>([
  "queued",
  "validating",
  "needs_review",
  "failed",
]);

/** Replace the full assignee list (multi-assign). Lead fields mirror the first. */
export async function setReportAssignees(input: {
  reportId: string;
  assignees: { uid: string; name: string; assignedAt?: string }[];
  /** When true (default), move queue → assigned when any officer is set. */
  advanceStatus?: boolean;
}): Promise<void> {
  const now = new Date().toISOString();
  const ref = doc(getClientDb(), COL, input.reportId);
  const snap = await getDoc(ref);
  const data = (snap.data() ?? {}) as Record<string, unknown>;
  const existing = mapReportAssignees(
    data.assignees,
    data.investigatorUid != null ? String(data.investigatorUid) : null,
    data.investigatorName != null ? String(data.investigatorName) : null,
    data.investigatedAt != null ? String(data.investigatedAt) : null,
  );
  const priorAt = new Map(existing.map((a) => [a.uid, a.assignedAt]));

  const cleaned: ReportAssignee[] = [];
  for (const row of input.assignees) {
    const uid = row.uid.trim();
    if (!uid || cleaned.some((a) => a.uid === uid)) continue;
    cleaned.push({
      uid,
      name: row.name.trim().slice(0, 120) || uid,
      assignedAt: row.assignedAt || priorAt.get(uid) || now,
    });
  }

  const lead = cleaned[0] ?? null;
  const patch: Record<string, unknown> = {
    assignees: cleaned,
    investigatorUid: lead?.uid ?? null,
    investigatorName: lead?.name ?? null,
    investigatedAt: lead?.assignedAt ?? null,
    updatedAt: now,
    updatedAtServer: serverTimestamp(),
  };

  const cur = (data.status as ReportStatus | undefined) ?? "queued";
  if (input.advanceStatus !== false && cleaned.length > 0) {
    if (QUEUE_FOR_ASSIGN.has(cur)) {
      patch.status = "assigned";
    }
  }
  if (cleaned.length === 0 && cur === "assigned") {
    patch.status = "queued";
  }

  await updateDoc(ref, patch);
}

/** Assign (or clear) a single lead investigator. Prefer setReportAssignees for multi. */
export async function assignReportInvestigator(input: {
  reportId: string;
  investigatorUid: string | null;
  investigatorName: string | null;
  /** When true (default), move queue → assigned on first assign. */
  advanceStatus?: boolean;
}): Promise<void> {
  if (!input.investigatorUid) {
    await setReportAssignees({
      reportId: input.reportId,
      assignees: [],
      advanceStatus: input.advanceStatus,
    });
    return;
  }
  await setReportAssignees({
    reportId: input.reportId,
    assignees: [
      {
        uid: input.investigatorUid,
        name: input.investigatorName?.trim() || input.investigatorUid,
      },
    ],
    advanceStatus: input.advanceStatus,
  });
}

/** Toggle officer “Dispatch someone” checklist (manual, not tied to status). */
export async function setReportManualDispatchChecked(
  reportId: string,
  checked: boolean,
): Promise<void> {
  const now = new Date().toISOString();
  await updateDoc(doc(getClientDb(), COL, reportId), {
    manualDispatchChecked: checked,
    updatedAt: now,
    updatedAtServer: serverTimestamp(),
  });
}

/** Upload on-site field photos (images only) and append to the report. */
export async function addReportFieldEvidence(input: {
  reportId: string;
  uploaderUid: string;
  uploaderName: string | null;
  files: File[];
}): Promise<void> {
  const images = input.files.filter((f) => f.type.startsWith("image/"));
  if (images.length === 0) {
    throw new Error("Images only.");
  }
  const now = new Date().toISOString();
  const entries: FieldEvidenceImage[] = [];
  for (const file of images) {
    const prepared = await compressReportImage(file);
    const body = new FormData();
    body.set("reportId", input.reportId);
    body.set("citizenUid", input.uploaderUid);
    body.set("kind", "field");
    body.set("file", prepared, prepared.name || "field.jpg");
    const res = await fetch("/api/reports/guest-upload", {
      method: "POST",
      body,
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      mediaPath?: string;
      mediaUrl?: string;
      mediaMime?: string;
    };
    if (!res.ok || !data.mediaPath || !data.mediaUrl) {
      throw new Error(data.error || "Field photo upload failed");
    }
    entries.push({
      mediaPath: data.mediaPath,
      mediaUrl: data.mediaUrl,
      mediaMime: data.mediaMime || prepared.type || "image/jpeg",
      uploadedAt: now,
      uploadedByUid: input.uploaderUid,
      uploadedByName: input.uploaderName,
    });
  }
  await updateDoc(doc(getClientDb(), COL, input.reportId), {
    fieldEvidence: arrayUnion(...entries),
    updatedAt: now,
    updatedAtServer: serverTimestamp(),
  });
}

/** Advance ops pipeline: assigned → legit → dispatched → done (or set any allowed status). */
export async function updateReportStatus(
  reportId: string,
  status: ReportStatus,
): Promise<void> {
  const now = new Date().toISOString();
  await updateDoc(doc(getClientDb(), COL, reportId), {
    status,
    updatedAt: now,
    updatedAtServer: serverTimestamp(),
    ...(status === "legit" || status === "dispatched" || status === "done"
      ? { validatedAt: now }
      : {}),
    ...(status === "dispatched" ? { dispatchedAt: now } : {}),
  });
}

export async function updateReportValidation(
  reportId: string,
  patch: {
    status: ReportStatus;
    aiVerdict: HazardReport["aiVerdict"];
    aiConfidence: number | null;
    aiReason: string | null;
    aiSource: HazardReport["aiSource"];
    aiModel: string | null;
    hazardHint?: ReportHazardHint;
    /** When AI upgrades a generic intent title (e.g. "I need help" → "Fire"). */
    title?: string;
    aiPriority?: ReportPriority | null;
    aiPriorityFactors?: ReportPriorityFactors | null;
    vertexClass?: string | null;
    vertexConfidence?: number | null;
    validatedAt: string | null;
    /** When set, recomputes trust with AI slice. */
    trustInput?: {
      registered: boolean;
      idVerified: boolean;
      email: string | null;
      phone: string | null;
      emailVerified?: boolean;
      mediaSource: ReportMediaSource | null;
      lat: number | null;
      lng: number | null;
      locationAccuracyM: number | null;
    };
  },
) {
  const { trustInput, ...rest } = patch;
  const payload: Record<string, unknown> = {
    ...rest,
    updatedAt: new Date().toISOString(),
    updatedAtServer: serverTimestamp(),
  };
  if (trustInput) {
    const trust = computeReportTrust({
      ...trustInput,
      aiConfidence: patch.aiConfidence,
      aiVerdict: patch.aiVerdict,
    });
    payload.trustScore = trust.total;
    payload.trustBreakdown = trust;
  }
  await updateDoc(doc(getClientDb(), COL, reportId), payload);
}

export async function markReportValidating(reportId: string) {
  await updateDoc(doc(getClientDb(), COL, reportId), {
    status: "validating" satisfies ReportStatus,
    updatedAt: new Date().toISOString(),
    updatedAtServer: serverTimestamp(),
  });
}

export function subscribeCitizenReports(
  citizenUid: string,
  onChange: (rows: HazardReport[]) => void,
): Unsubscribe {
  const q = query(
    collection(getClientDb(), COL),
    where("citizenUid", "==", citizenUid),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => mapReport(d.id, d.data())));
  });
}

/** Officer queue — all reports newest first (filter in UI by status). */
export function subscribeAllReports(
  onChange: (rows: HazardReport[]) => void,
): Unsubscribe {
  const q = query(
    collection(getClientDb(), COL),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => mapReport(d.id, d.data())));
  });
}
