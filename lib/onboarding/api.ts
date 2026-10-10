import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import {
  emptyChecklist,
  type OnboardChecklist,
  type OnboardedBarangay,
} from "@/lib/onboarding/types";

const COL = "barangays";

function asIso(value: unknown, fallback?: unknown): string {
  if (typeof value === "string" && value) return value;
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof fallback === "string" && fallback) return fallback;
  return new Date().toISOString();
}

function mapDoc(
  id: string,
  data: Record<string, unknown>,
): OnboardedBarangay | null {
  const center = data.center as { lat?: unknown; lng?: unknown } | undefined;
  if (
    typeof data.barangay !== "string" ||
    typeof data.lgu !== "string" ||
    typeof center?.lat !== "number" ||
    typeof center?.lng !== "number"
  ) {
    return null;
  }

  const checklistRaw = (data.checklist ?? {}) as Partial<OnboardChecklist>;
  const base = emptyChecklist();

  return {
    id,
    barangay: data.barangay,
    lgu: data.lgu,
    name: String(data.name ?? data.barangay),
    orgName: String(data.orgName ?? ""),
    hallAddress: String(data.hallAddress ?? ""),
    hotline: String(data.hotline ?? ""),
    email: String(data.email ?? ""),
    center: { lat: center.lat, lng: center.lng },
    zoom: typeof data.zoom === "number" ? data.zoom : 15,
    checklist: {
      householdsReady: Boolean(checklistRaw.householdsReady ?? base.householdsReady),
      staffReady: Boolean(checklistRaw.staffReady ?? base.staffReady),
      templatesReviewed: Boolean(
        checklistRaw.templatesReviewed ?? base.templatesReviewed,
      ),
      mapOpened: Boolean(checklistRaw.mapOpened ?? base.mapOpened),
    },
    activatedAt: asIso(data.activatedAt, data.activatedAtServer),
    updatedAt: asIso(data.updatedAt, data.updatedAtServer),
    activatedBy:
      typeof data.activatedBy === "string" ? data.activatedBy : undefined,
  };
}

export async function fetchOnboardedBarangays(): Promise<OnboardedBarangay[]> {
  const snap = await getDocs(collection(getClientDb(), COL));
  const rows: OnboardedBarangay[] = [];
  for (const d of snap.docs) {
    const row = mapDoc(d.id, d.data() as Record<string, unknown>);
    if (row) rows.push(row);
  }
  return rows.sort((a, b) => b.activatedAt.localeCompare(a.activatedAt));
}

export async function fetchOnboardedBarangay(
  id: string,
): Promise<OnboardedBarangay | null> {
  const snap = await getDoc(doc(getClientDb(), COL, id));
  if (!snap.exists()) return null;
  return mapDoc(snap.id, snap.data() as Record<string, unknown>);
}

export async function upsertOnboardedBarangay(
  row: OnboardedBarangay,
): Promise<void> {
  await setDoc(
    doc(getClientDb(), COL, row.id),
    {
      ...row,
      updatedAtServer: serverTimestamp(),
      activatedAtServer: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function deleteOnboardedBarangay(id: string): Promise<void> {
  await deleteDoc(doc(getClientDb(), COL, id));
}

export async function updateOfficerActiveBarangay(
  uid: string,
  activeBarangayId: string,
  orgName?: string,
): Promise<void> {
  const payload: Record<string, unknown> = { activeBarangayId };
  if (orgName?.trim()) payload.orgName = orgName.trim();
  await setDoc(doc(getClientDb(), "users", uid), payload, { merge: true });
}
