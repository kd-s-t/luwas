import {
  collection,
  doc,
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
  resolveReportPlace,
} from "@/lib/reports/barangayScope";
import { EMPTY_REACTION_COUNTS } from "@/lib/reports/socialTypes";
import {
  computeReportTrust,
  type ReportTrustBreakdown,
} from "@/lib/reports/trustScore";
import type {
  HazardReport,
  ReportHazardHint,
  ReportMediaSource,
  ReportMediaType,
  ReportStatus,
} from "@/lib/reports/types";

const COL = "reports";

function mapTrustBreakdown(
  raw: unknown,
  fallbackTotal: number | null,
): ReportTrustBreakdown | null {
  if (!raw || typeof raw !== "object") {
    return fallbackTotal != null
      ? {
          identity: 0,
          contact: 0,
          capture: 0,
          ai: 0,
          total: fallbackTotal,
        }
      : null;
  }
  const b = raw as Record<string, unknown>;
  return {
    identity: Number(b.identity ?? 0),
    contact: Number(b.contact ?? 0),
    capture: Number(b.capture ?? 0),
    ai: Number(b.ai ?? 0),
    total: Number(b.total ?? fallbackTotal ?? 0),
  };
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
  const reporterPhone =
    data.reporterPhone != null ? String(data.reporterPhone) : null;
  const reporterEmailVerified = Boolean(data.reporterEmailVerified);
  const storedTrust =
    typeof data.trustScore === "number" ? data.trustScore : null;
  const recomputed =
    storedTrust == null
      ? computeReportTrust({
          registered: Boolean(data.citizenUid),
          idVerified: reporterIdVerified,
          email: reporterEmail,
          phone: reporterPhone,
          emailVerified: reporterEmailVerified,
          mediaSource,
          lat,
          lng,
          locationAccuracyM,
          aiConfidence,
          aiVerdict,
        })
      : null;
  const trustScore = storedTrust ?? recomputed?.total ?? null;
  const trustBreakdown =
    mapTrustBreakdown(data.trustBreakdown, trustScore) ?? recomputed;
  return {
    id,
    citizenUid: String(data.citizenUid ?? ""),
    citizenName: String(data.citizenName ?? ""),
    citizenPurok: String(data.citizenPurok ?? ""),
    barangay: place.barangay,
    lgu: place.lgu,
    citizenPhotoURL:
      data.citizenPhotoURL != null ? String(data.citizenPhotoURL) : null,
    title: String(data.title ?? ""),
    notes: String(data.notes ?? ""),
    hazardHint: (data.hazardHint as ReportHazardHint) ?? "other",
    mediaType: (data.mediaType as ReportMediaType) ?? "photo",
    mediaPath: String(data.mediaPath ?? ""),
    mediaUrl: String(data.mediaUrl ?? ""),
    mediaMime: String(data.mediaMime ?? ""),
    mediaSource,
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
    validatedAt: data.validatedAt != null ? String(data.validatedAt) : null,
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
    createdAt: String(data.createdAt ?? new Date().toISOString()),
    updatedAt: String(data.updatedAt ?? new Date().toISOString()),
  };
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
  const id = input.id ?? crypto.randomUUID();
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
    barangay: input.barangay?.trim() || DEFAULT_REPORT_BARANGAY,
    lgu: input.lgu?.trim() || DEFAULT_REPORT_LGU,
    citizenPhotoURL: input.citizenPhotoURL ?? null,
    mediaSource: input.mediaSource ?? null,
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
    validatedAt: null,
    reactionCounts: { ...EMPTY_REACTION_COUNTS },
    commentCount: 0,
    createdAt: now,
    updatedAt: now,
    createdAtServer: serverTimestamp(),
    updatedAtServer: serverTimestamp(),
  });
  return id;
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
