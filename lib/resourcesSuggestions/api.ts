import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import type { SupplyShortagePlan } from "@/lib/workspace/supplyShortagePlan";
import type {
  ResourceSuggestion,
  ResourceSuggestionReadiness,
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

function slug(community: string): string {
  return community
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function suggestionDocId(epicCode: string, community: string): string {
  return `${epicCode.toLowerCase()}_${slug(community) || "sitio"}`;
}

function mapDoc(id: string, data: Record<string, unknown>): ResourceSuggestion {
  const reportIds = Array.isArray(data.reportIds)
    ? data.reportIds.map(String).filter(Boolean)
    : [];
  const reportId =
    typeof data.reportId === "string" && data.reportId.trim()
      ? data.reportId.trim()
      : (reportIds[0] ?? "");
  const shortageId = String(data.shortageId ?? data.epicCode ?? "")
    .trim()
    .toUpperCase();
  return {
    id,
    shortageId,
    epicCode: shortageId,
    kind: String(data.kind ?? "water"),
    community: String(data.community ?? ""),
    barangayLabel: String(data.barangayLabel ?? ""),
    reportId,
    reportIds: reportIds.length > 0 ? reportIds : reportId ? [reportId] : [],
    people: Number(data.people) || 0,
    needL: Number(data.needL) || 0,
    localStockL: Number(data.localStockL) || 0,
    gapL: Number(data.gapL) || 0,
    suggestedAllocateL: Number(data.suggestedAllocateL) || 0,
    readiness: asReadiness(data.readiness),
    readinessLabel: String(data.readinessLabel ?? "Access TBD"),
    mediaUrl:
      typeof data.mediaUrl === "string" && data.mediaUrl.trim()
        ? data.mediaUrl.trim()
        : null,
    lat: typeof data.lat === "number" ? data.lat : null,
    lng: typeof data.lng === "number" ? data.lng : null,
    createdAt: asIso(data.createdAt, data.createdAtServer),
    updatedAt: asIso(data.updatedAt, data.updatedAtServer),
  };
}

/** Proportional warehouse suggestion by gap share. */
function suggestedAllocateL(
  gapL: number,
  totalGapL: number,
  availableL: number,
): number {
  if (gapL <= 0 || availableL <= 0) return 0;
  if (totalGapL <= 0) return 0;
  return Math.round((gapL / totalGapL) * availableL);
}

/**
 * Upsert one suggestion row per sitio when Review shortage opens.
 * Deterministic ids so revisits update instead of duplicating.
 */
export async function upsertSuggestionsFromPlan(
  plan: SupplyShortagePlan,
): Promise<void> {
  const db = getClientDb();
  const totalGap = plan.rows.reduce((sum, r) => sum + Math.max(0, r.gapL), 0);

  await Promise.all(
    plan.rows.map(async (row) => {
      const id = suggestionDocId(plan.code, row.community);
      const people = Number(row.peopleLabel.replace(/[^\d]/g, "")) || 0;
      const ref = doc(db, COL, id);
      await setDoc(
        ref,
        {
          shortageId: plan.code,
          epicCode: plan.code,
          kind: plan.kind,
          community: row.community,
          barangayLabel: row.barangayLabel,
          reportId: row.reportId,
          reportIds: row.reportIds,
          people,
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
          updatedAt: new Date().toISOString(),
          updatedAtServer: serverTimestamp(),
          createdAt: new Date().toISOString(),
          createdAtServer: serverTimestamp(),
        },
        { merge: true },
      );
    }),
  );
}

function sortSuggestions(rows: ResourceSuggestion[]): ResourceSuggestion[] {
  return [...rows].sort(
    (a, b) =>
      a.shortageId.localeCompare(b.shortageId) ||
      b.gapL - a.gapL ||
      a.community.localeCompare(b.community),
  );
}

/** Live rows for an epic (e.g. RS-001). */
export function listenSuggestionsByEpic(
  epicCode: string,
  onChange: (rows: ResourceSuggestion[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const code = epicCode.trim().toUpperCase();
  const q = query(
    collection(getClientDb(), COL),
    where("epicCode", "==", code),
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = sortSuggestions(
        snap.docs.map((d) =>
          mapDoc(d.id, d.data() as Record<string, unknown>),
        ),
      );
      onChange(rows);
    },
    (err) => onError?.(err),
  );
}

/** All resources_suggestions rows (officer desk). */
export function listenAllSuggestions(
  onChange: (rows: ResourceSuggestion[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getClientDb(), COL),
    (snap) => {
      const rows = sortSuggestions(
        snap.docs.map((d) =>
          mapDoc(d.id, d.data() as Record<string, unknown>),
        ),
      );
      onChange(rows);
    },
    (err) => onError?.(err),
  );
}
