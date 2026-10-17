import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { sanitizeGuestReporterPhone } from "@/lib/auth/demoAccount";
import { getClientDb } from "@/lib/firebase/client";
import { resolveReportPlace } from "@/lib/reports/barangayScope";
import { mapDispatchLog } from "@/lib/reports/dispatchLog";
import { resolveReportMediaUrl } from "@/lib/reports/mediaUrl";
import { mapReportAssignees } from "@/lib/reports/assignees";
import {
  parsePriorityFactors,
  parseReportPriority,
} from "@/lib/reports/priority";
import { computeReportTrust } from "@/lib/reports/trustScore";
import type { HazardReport } from "@/lib/reports/types";
import {
  EMPTY_REACTION_COUNTS,
  type ReactionCounts,
  type ReactionType,
  type ReportComment,
  type ReportReaction,
} from "@/lib/reports/socialTypes";

const GUEST_UID = "web-guest";

function mapReport(id: string, data: Record<string, unknown>): HazardReport {
  const counts = (data.reactionCounts as ReactionCounts | undefined) ?? {
    ...EMPTY_REACTION_COUNTS,
  };
  const place = resolveReportPlace({
    barangay: data.barangay != null ? String(data.barangay) : "",
    lgu: data.lgu != null ? String(data.lgu) : "",
    citizenPurok: String(data.citizenPurok ?? ""),
    lat: typeof data.lat === "number" ? data.lat : null,
    lng: typeof data.lng === "number" ? data.lng : null,
  });
  const citizenUid = String(data.citizenUid ?? "");
  const rawPhone =
    data.reporterPhone != null ? String(data.reporterPhone) : null;
  const reporterPhone =
    citizenUid === GUEST_UID
      ? sanitizeGuestReporterPhone(rawPhone)
      : rawPhone;
  const mediaSource =
    (data.mediaSource as HazardReport["mediaSource"]) ?? null;
  const lat = typeof data.lat === "number" ? data.lat : null;
  const lng = typeof data.lng === "number" ? data.lng : null;
  const locationAccuracyM =
    typeof data.locationAccuracyM === "number"
      ? data.locationAccuracyM
      : null;
  const aiConfidence =
    typeof data.aiConfidence === "number" ? data.aiConfidence : null;
  const aiVerdict = (data.aiVerdict as HazardReport["aiVerdict"]) ?? null;
  const trustBreakdown = computeReportTrust({
    registered: Boolean(citizenUid) && citizenUid !== GUEST_UID,
    idVerified: Boolean(data.reporterIdVerified),
    email: citizenUid === GUEST_UID ? null : (
      data.reporterEmail != null ? String(data.reporterEmail) : null
    ),
    phone: reporterPhone,
    emailVerified: Boolean(data.reporterEmailVerified),
    mediaSource,
    lat,
    lng,
    locationAccuracyM,
    aiConfidence,
    aiVerdict,
  });
  const trustScore = trustBreakdown.total;
  return {
    id,
    citizenUid,
    citizenName: String(data.citizenName ?? ""),
    citizenPurok: String(data.citizenPurok ?? ""),
    barangay: place.barangay,
    lgu: place.lgu,
    citizenPhotoURL:
      data.citizenPhotoURL != null ? String(data.citizenPhotoURL) : null,
    title: String(data.title ?? ""),
    notes: String(data.notes ?? ""),
    hazardHint: (data.hazardHint as HazardReport["hazardHint"]) ?? "other",
    mediaType: (data.mediaType as HazardReport["mediaType"]) ?? "photo",
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
    status: (data.status as HazardReport["status"]) ?? "queued",
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
    fieldEvidence: Array.isArray(data.fieldEvidence)
      ? (data.fieldEvidence as HazardReport["fieldEvidence"])
      : [],
    reporterIdVerified: Boolean(data.reporterIdVerified),
    reporterEmail:
      data.reporterEmail != null ? String(data.reporterEmail) : null,
    reporterPhone,
    reporterEmailVerified: Boolean(data.reporterEmailVerified),
    trustScore,
    trustBreakdown,
    reactionCounts: {
      like: Number(counts.like ?? 0),
      helpful: Number(counts.helpful ?? 0),
      concern: Number(counts.concern ?? 0),
    },
    commentCount: Number(data.commentCount ?? 0),
    createdAt: String(data.createdAt ?? new Date().toISOString()),
    updatedAt: String(data.updatedAt ?? new Date().toISOString()),
  };
}

/** Public feed — exclude rejected / failed. */
export function subscribePublicReports(
  onChange: (rows: HazardReport[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getClientDb(), "reports"),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => mapReport(d.id, d.data()))
        .filter(
          (r) =>
            r.status !== "rejected" &&
            r.status !== "failed" &&
            r.status !== "draft",
        );
      onChange(rows);
    },
    (err) => {
      onError?.(err);
    },
  );
}

export function subscribeReportComments(
  reportId: string,
  onChange: (rows: ReportComment[]) => void,
): Unsubscribe {
  const q = query(
    collection(getClientDb(), "reports", reportId, "comments"),
    orderBy("createdAt", "asc"),
  );
  return onSnapshot(q, (snap) => {
    onChange(
      snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          uid: String(data.uid ?? ""),
          displayName: String(data.displayName ?? "User"),
          photoURL: data.photoURL != null ? String(data.photoURL) : null,
          text: String(data.text ?? ""),
          createdAt: String(data.createdAt ?? ""),
        };
      }),
    );
  });
}

export function subscribeReportReactions(
  reportId: string,
  onChange: (rows: ReportReaction[]) => void,
): Unsubscribe {
  const q = query(collection(getClientDb(), "reports", reportId, "reactions"));
  return onSnapshot(q, (snap) => {
    onChange(
      snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          uid: String(data.uid ?? d.id),
          displayName: String(data.displayName ?? "User"),
          photoURL: data.photoURL != null ? String(data.photoURL) : null,
          type: (data.type as ReactionType) ?? "like",
          createdAt: String(data.createdAt ?? ""),
        };
      }),
    );
  });
}

export async function addReportComment(input: {
  reportId: string;
  uid: string;
  displayName: string;
  photoURL: string | null;
  text: string;
  previousCount: number;
}) {
  const text = input.text.trim();
  if (!text) throw new Error("Comment cannot be empty");
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await setDoc(doc(getClientDb(), "reports", input.reportId, "comments", id), {
    uid: input.uid,
    displayName: input.displayName,
    photoURL: input.photoURL,
    text,
    createdAt: now,
    createdAtServer: serverTimestamp(),
  });
  await updateDoc(doc(getClientDb(), "reports", input.reportId), {
    commentCount: input.previousCount + 1,
    updatedAt: now,
    updatedAtServer: serverTimestamp(),
  });
}

export async function deleteReportComment(input: {
  reportId: string;
  commentId: string;
  previousCount: number;
}) {
  await deleteDoc(
    doc(getClientDb(), "reports", input.reportId, "comments", input.commentId),
  );
  await updateDoc(doc(getClientDb(), "reports", input.reportId), {
    commentCount: Math.max(0, input.previousCount - 1),
    updatedAt: new Date().toISOString(),
    updatedAtServer: serverTimestamp(),
  });
}

export async function setReportReaction(input: {
  reportId: string;
  uid: string;
  displayName: string;
  photoURL: string | null;
  type: ReactionType;
  /** Existing reaction for this user, if any */
  previous: ReportReaction | null;
  counts: ReactionCounts;
}) {
  const ref = doc(
    getClientDb(),
    "reports",
    input.reportId,
    "reactions",
    input.uid,
  );
  const now = new Date().toISOString();
  const nextCounts = { ...input.counts };

  if (input.previous?.type === input.type) {
    // Toggle off
    await deleteDoc(ref);
    nextCounts[input.type] = Math.max(0, nextCounts[input.type] - 1);
  } else {
    if (input.previous) {
      nextCounts[input.previous.type] = Math.max(
        0,
        nextCounts[input.previous.type] - 1,
      );
    }
    nextCounts[input.type] = nextCounts[input.type] + 1;
    await setDoc(ref, {
      uid: input.uid,
      displayName: input.displayName,
      photoURL: input.photoURL,
      type: input.type,
      createdAt: now,
      createdAtServer: serverTimestamp(),
    });
  }

  await updateDoc(doc(getClientDb(), "reports", input.reportId), {
    reactionCounts: nextCounts,
    updatedAt: now,
    updatedAtServer: serverTimestamp(),
  });
}
