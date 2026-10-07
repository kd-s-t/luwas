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
import { EMPTY_REACTION_COUNTS } from "@/lib/reports/socialTypes";
import type {
  HazardReport,
  ReportHazardHint,
  ReportMediaType,
  ReportStatus,
} from "@/lib/reports/types";

const COL = "reports";

function mapReport(id: string, data: Record<string, unknown>): HazardReport {
  const counts = data.reactionCounts as
    | { like?: number; helpful?: number; concern?: number }
    | undefined;
  return {
    id,
    citizenUid: String(data.citizenUid ?? ""),
    citizenName: String(data.citizenName ?? ""),
    citizenPurok: String(data.citizenPurok ?? ""),
    citizenPhotoURL:
      data.citizenPhotoURL != null ? String(data.citizenPhotoURL) : null,
    title: String(data.title ?? ""),
    notes: String(data.notes ?? ""),
    hazardHint: (data.hazardHint as ReportHazardHint) ?? "other",
    mediaType: (data.mediaType as ReportMediaType) ?? "photo",
    mediaPath: String(data.mediaPath ?? ""),
    mediaUrl: String(data.mediaUrl ?? ""),
    mediaMime: String(data.mediaMime ?? ""),
    lat: typeof data.lat === "number" ? data.lat : null,
    lng: typeof data.lng === "number" ? data.lng : null,
    status: (data.status as ReportStatus) ?? "queued",
    aiVerdict: (data.aiVerdict as HazardReport["aiVerdict"]) ?? null,
    aiConfidence:
      typeof data.aiConfidence === "number" ? data.aiConfidence : null,
    aiReason: data.aiReason != null ? String(data.aiReason) : null,
    aiSource: (data.aiSource as HazardReport["aiSource"]) ?? null,
    aiModel: data.aiModel != null ? String(data.aiModel) : null,
    validatedAt: data.validatedAt != null ? String(data.validatedAt) : null,
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
  citizenPhotoURL?: string | null;
  title: string;
  notes: string;
  hazardHint: ReportHazardHint;
  mediaType: ReportMediaType;
  mediaPath: string;
  mediaUrl: string;
  mediaMime: string;
  lat: number | null;
  lng: number | null;
}): Promise<string> {
  const now = new Date().toISOString();
  const id = input.id ?? crypto.randomUUID();
  const { id: _unusedId, ...fields } = input;
  void _unusedId;
  await setDoc(doc(getClientDb(), COL, id), {
    ...fields,
    citizenPhotoURL: input.citizenPhotoURL ?? null,
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
  },
) {
  await updateDoc(doc(getClientDb(), COL, reportId), {
    ...patch,
    updatedAt: new Date().toISOString(),
    updatedAtServer: serverTimestamp(),
  });
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
