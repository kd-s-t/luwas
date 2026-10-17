import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import type {
  ResourceShortage,
  ShortageAllocationDraft,
} from "@/lib/resourcesShortages/types";
import type { SupplyNeedKind } from "@/lib/workspace/reportNeed";
import type { AllocationOption } from "@/lib/workspace/allocationOptions";
import type { SupplyShortagePlan } from "@/lib/workspace/supplyShortagePlan";

const COL = "resources_shortages";

function mapAllocation(raw: unknown): ShortageAllocationDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const options = Array.isArray(d.options) ? d.options : [];
  if (options.length < 3) return null;
  const planKey = String(d.planKey ?? "").trim();
  if (!planKey) return null;
  const source = d.source === "gemini" ? "gemini" : "local";
  return {
    planKey,
    options: options as AllocationOption[],
    source,
    prompt: typeof d.prompt === "string" ? d.prompt : null,
    raw: typeof d.raw === "string" ? d.raw : null,
    model: typeof d.model === "string" ? d.model : null,
    error: typeof d.error === "string" ? d.error : null,
    savedAt: String(d.savedAt ?? ""),
  };
}

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

function asKind(raw: unknown): SupplyNeedKind {
  const v = String(raw ?? "");
  if (v === "water" || v === "food" || v === "medical" || v === "relief") {
    return v;
  }
  return "water";
}

function mapDoc(id: string, data: Record<string, unknown>): ResourceShortage {
  const reportIds = Array.isArray(data.reportIds)
    ? data.reportIds.map(String).filter(Boolean)
    : [];
  return {
    id,
    kind: asKind(data.kind),
    resourceLabel: String(data.resourceLabel ?? "Supplies"),
    resourceBlurb: String(data.resourceBlurb ?? ""),
    totalNeededL: Number(data.totalNeededL) || 0,
    availableL: Number(data.availableL) || 0,
    shortageL: Number(data.shortageL) || 0,
    communityCount: Number(data.communityCount) || 0,
    advisory: String(data.advisory ?? ""),
    reportIds,
    primaryReportId: String(data.primaryReportId ?? reportIds[0] ?? ""),
    compareHref: String(
      data.compareHref ??
        `/admin/resources/compare?rs=${encodeURIComponent(id)}`,
    ),
    allocation: mapAllocation(data.allocation),
    createdAt: asIso(data.createdAt, data.createdAtServer),
    updatedAt: asIso(data.updatedAt, data.updatedAtServer),
  };
}

/**
 * Write shortage under doc id = plan.code (e.g. RS-001).
 * That id is what `/admin/resources?rs=RS-001` loads.
 */
export async function upsertShortageFromPlan(
  plan: SupplyShortagePlan,
): Promise<ResourceShortage> {
  const id = plan.code.trim().toUpperCase();
  const db = getClientDb();
  const ref = doc(db, COL, id);
  const existing = await getDoc(ref);
  const now = new Date().toISOString();
  const reportIds = [
    ...new Set(plan.rows.flatMap((r) => r.reportIds)),
  ];

  await setDoc(
    ref,
    {
      kind: plan.kind,
      resourceLabel: plan.resourceLabel,
      resourceBlurb: plan.resourceBlurb,
      totalNeededL: plan.totalNeededL,
      availableL: plan.availableL,
      shortageL: plan.shortageL,
      communityCount: plan.communityCount,
      advisory: plan.advisory,
      reportIds,
      primaryReportId: plan.primaryReportId,
      compareHref: plan.compareHref,
      updatedAt: now,
      updatedAtServer: serverTimestamp(),
      ...(existing.exists()
        ? {}
        : {
            createdAt: now,
            createdAtServer: serverTimestamp(),
          }),
    },
    { merge: true },
  );

  const snap = await getDoc(ref);
  return mapDoc(id, (snap.data() ?? {}) as Record<string, unknown>);
}

export async function getShortageById(
  id: string,
): Promise<ResourceShortage | null> {
  const code = id.trim().toUpperCase();
  if (!code) return null;
  const snap = await getDoc(doc(getClientDb(), COL, code));
  if (!snap.exists()) return null;
  return mapDoc(snap.id, snap.data() as Record<string, unknown>);
}

/** Persist compare-options Gemini prompt + return on resources_shortages/{id}. */
export async function saveShortageAllocationDraft(
  shortageId: string,
  draft: ShortageAllocationDraft,
): Promise<void> {
  const id = shortageId.trim().toUpperCase();
  if (!id || draft.options.length < 3) return;
  const now = new Date().toISOString();
  await setDoc(
    doc(getClientDb(), COL, id),
    {
      allocation: {
        planKey: draft.planKey,
        options: draft.options,
        source: draft.source,
        prompt: draft.prompt,
        raw: draft.raw,
        model: draft.model,
        error: draft.error,
        savedAt: draft.savedAt || now,
      },
      updatedAt: now,
      updatedAtServer: serverTimestamp(),
    },
    { merge: true },
  );
}

export function listenShortageById(
  id: string,
  onChange: (row: ResourceShortage | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const code = id.trim().toUpperCase();
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
