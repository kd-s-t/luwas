import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import {
  NANGKA_BARANGAY_ID,
  NANGKA_ORG_NAME,
  NANGKA_STAFF_SEED,
} from "@/lib/staff/nangkaStaff";
import type { StaffMember, StaffMemberInput } from "@/lib/staff/types";

const COL = "barangayStaff";

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

function mapDoc(
  id: string,
  data: Record<string, unknown>,
): StaffMember {
  return {
    id,
    displayName: String(data.displayName ?? ""),
    title: String(data.title ?? ""),
    rank: data.rank as StaffMember["rank"],
    scope: data.scope === "lgu" ? "lgu" : "barangay",
    reportsToId:
      typeof data.reportsToId === "string" && data.reportsToId
        ? data.reportsToId
        : null,
    office: String(data.office ?? ""),
    phone: String(data.phone ?? ""),
    email: String(data.email ?? ""),
    accountEmail:
      typeof data.accountEmail === "string" ? data.accountEmail : undefined,
    status:
      data.status === "leave" || data.status === "inactive"
        ? data.status
        : "active",
    notes: typeof data.notes === "string" ? data.notes : undefined,
    barangayId: String(data.barangayId ?? NANGKA_BARANGAY_ID),
    orgName: String(data.orgName ?? NANGKA_ORG_NAME),
    createdAt: asIso(data.createdAt, data.createdAtServer),
    updatedAt: asIso(data.updatedAt, data.updatedAtServer),
  };
}

export function subscribeBarangayStaff(
  barangayId: string,
  onData: (rows: StaffMember[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getClientDb(), COL),
    where("barangayId", "==", barangayId),
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) =>
        mapDoc(d.id, d.data() as Record<string, unknown>),
      );
      onData(rows);
    },
    (err) => onError?.(err),
  );
}

function staffPayload(
  barangayId: string,
  orgName: string,
  input: StaffMemberInput,
) {
  const now = new Date().toISOString();
  return {
    ...input,
    reportsToId: input.reportsToId,
    barangayId,
    orgName,
    createdAt: now,
    updatedAt: now,
    createdAtServer: serverTimestamp(),
    updatedAtServer: serverTimestamp(),
  };
}

/** Seed / refresh Nangka staff directory (idempotent upsert by id). */
export async function ensureNangkaStaffSeed(): Promise<{
  written: number;
}> {
  const barangayId = NANGKA_BARANGAY_ID;
  const orgName = NANGKA_ORG_NAME;
  const existing = await getDocs(
    query(
      collection(getClientDb(), COL),
      where("barangayId", "==", barangayId),
    ),
  );
  const have = new Set(existing.docs.map((d) => d.id));

  const batch = writeBatch(getClientDb());
  let written = 0;
  const now = new Date().toISOString();
  for (const input of NANGKA_STAFF_SEED) {
    const ref = doc(getClientDb(), COL, input.id);
    if (have.has(input.id)) {
      batch.set(
        ref,
        {
          ...input,
          barangayId,
          orgName,
          updatedAt: now,
          updatedAtServer: serverTimestamp(),
        },
        { merge: true },
      );
    } else {
      batch.set(ref, staffPayload(barangayId, orgName, input));
    }
    written += 1;
  }
  await batch.commit();
  return { written };
}

export async function upsertStaffMember(
  barangayId: string,
  orgName: string,
  input: StaffMemberInput,
): Promise<void> {
  await setDoc(
    doc(getClientDb(), COL, input.id),
    staffPayload(barangayId, orgName, input),
    { merge: true },
  );
}
