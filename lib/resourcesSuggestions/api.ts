import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import type { SupplyShortagePlan } from "@/lib/workspace/supplyShortagePlan";
import type {
  ResourceSuggestion,
  ResourceSuggestionReadiness,
  ResourceSuggestionRequest,
} from "@/lib/resourcesSuggestions/types";

const COL = "resources_suggestions";

function asIso(value: unknown, serverValue: unknown): string {
  if (typeof value === "string") return value;
  if (
    serverValue &&
    typeof serverValue === "object" &&
    "toDate" in serverValue &&
    typeof (serverValue as { toDate: () => Date }).toDate === "function"
  ) {
    return (serverValue as { toDate: () => Date }).toDate().toISOString();
  }
  return "";
}

function asReadiness(raw: unknown): ResourceSuggestionReadiness {
  const v = String(raw ?? "");
  if (v === "ready" || v === "no_transport" || v === "access_unknown") {
    return v;
  }
  return "access_unknown";
}

function mapRequest(raw: unknown): ResourceSuggestionRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const community = String(d.community ?? "").trim();
  if (!community) return null;
  const reportIds = Array.isArray(d.reportIds)
    ? d.reportIds.map(String).filter(Boolean)
    : [];
  const reportId =
    typeof d.reportId === "string" && d.reportId.trim()
      ? d.reportId.trim()
      : (reportIds[0] ?? "");
  return {
    community,
    barangayLabel: String(d.barangayLabel ?? ""),
    reportId,
    reportIds: reportIds.length > 0 ? reportIds : reportId ? [reportId] : [],
    people: Number(d.people) || 0,
    needL: Number(d.needL) || 0,
    localStockL: Number(d.localStockL) || 0,
    gapL: Number(d.gapL) || 0,
    suggestedAllocateL: Number(d.suggestedAllocateL) || 0,
    readiness: asReadiness(d.readiness),
    readinessLabel: String(d.readinessLabel ?? "Access TBD"),
    mediaUrl:
      typeof d.mediaUrl === "string" && d.mediaUrl.trim()
        ? d.mediaUrl.trim()
        : null,
    lat: typeof d.lat === "number" ? d.lat : null,
    lng: typeof d.lng === "number" ? d.lng : null,
  };
}

function mapDoc(id: string, data: Record<string, unknown>): ResourceSuggestion {
  const shortageId = String(data.shortageId ?? data.epicCode ?? id)
    .trim()
    .toUpperCase();
  const fromArray = Array.isArray(data.requests)
    ? data.requests
        .map(mapRequest)
        .filter((r): r is ResourceSuggestionRequest => Boolean(r))
    : [];
  const requests = [...fromArray].sort(
    (a, b) => b.gapL - a.gapL || a.community.localeCompare(b.community),
  );
  return {
    id: shortageId || id,
    shortageId: shortageId || id,
    epicCode: shortageId || id,
    kind: String(data.kind ?? "water"),
    resourceLabel: String(data.resourceLabel ?? "Drinking water"),
    totalNeededL: Number(data.totalNeededL) || 0,
    availableL: Number(data.availableL) || 0,
    shortageL: Number(data.shortageL) || 0,
    requestCount: requests.length || Number(data.requestCount) || 0,
    requests,
    createdAt: asIso(data.createdAt, data.createdAtServer),
    updatedAt: asIso(data.updatedAt, data.updatedAtServer),
  };
}

function suggestedAllocateL(
  gapL: number,
  totalGapL: number,
  availableL: number,
): number {
  if (gapL <= 0 || availableL <= 0 || totalGapL <= 0) return 0;
  return Math.round((gapL / totalGapL) * availableL);
}

/**
 * One doc per plan: resources_suggestions/RS-001 with all sitio requests nested.
 */
export async function upsertSuggestionsFromPlan(
  plan: SupplyShortagePlan,
): Promise<ResourceSuggestion> {
  const id = plan.code.trim().toUpperCase();
  const totalGap = plan.rows.reduce((sum, r) => sum + Math.max(0, r.gapL), 0);
  const requests: ResourceSuggestionRequest[] = plan.rows.map((row) => ({
    community: row.community,
    barangayLabel: row.barangayLabel,
    reportId: row.reportId,
    reportIds: row.reportIds,
    people: Number(row.peopleLabel.replace(/[^\d]/g, "")) || 0,
    needL: row.needL,
    localStockL: row.localStockL,
    gapL: row.gapL,
    suggestedAllocateL: suggestedAllocateL(
      row.gapL,
      totalGap,
      plan.availableL,
    ),
    readiness: row.readiness,
    readinessLabel: row.readinessLabel,
    mediaUrl: row.mediaUrl,
    lat: row.lat,
    lng: row.lng,
  }));
  const now = new Date().toISOString();
  const payload = {
    shortageId: id,
    epicCode: id,
    kind: plan.kind,
    resourceLabel: plan.resourceLabel,
    totalNeededL: plan.totalNeededL,
    availableL: plan.availableL,
    shortageL: plan.shortageL,
    requestCount: requests.length,
    requests,
    updatedAt: now,
    updatedAtServer: serverTimestamp(),
    createdAt: now,
    createdAtServer: serverTimestamp(),
  };
  await setDoc(doc(getClientDb(), COL, id), payload, { merge: true });
  return mapDoc(id, payload as unknown as Record<string, unknown>);
}

/** Live doc for one plan (e.g. RS-001). */
export function listenSuggestionsByEpic(
  epicCode: string,
  onChange: (doc: ResourceSuggestion | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const code = epicCode.trim().toUpperCase();
  return onSnapshot(
    doc(getClientDb(), COL, code),
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      onChange(mapDoc(snap.id, snap.data() as Record<string, unknown>));
    },
    (err) => onError?.(err),
  );
}

/** All plan suggestion docs (one row each). */
export function listenAllSuggestions(
  onChange: (rows: ResourceSuggestion[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getClientDb(), COL),
    (snap) => {
      const rows = snap.docs
        .map((d) => mapDoc(d.id, d.data() as Record<string, unknown>))
        .filter((r) => r.requests.length > 0 || r.requestCount > 0)
        .sort((a, b) => a.id.localeCompare(b.id));
      onChange(rows);
    },
    (err) => onError?.(err),
  );
}
