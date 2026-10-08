import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import type { Household, HouseholdInput } from "@/lib/households/types";

/** Firestore batch limit is 500; stay under for clear+seed headroom. */
const BATCH_SIZE = 400;

export function subscribeHouseholds(
  officerUid: string,
  onData: (rows: Household[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  // Single-field filter; sort client-side so emulator works without composite indexes
  const q = query(
    collection(getClientDb(), "households"),
    where("officerUid", "==", officerUid),
  );

  return onSnapshot(
    q,
    (snap) => {
      const rows: Household[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ownerName: String(data.ownerName ?? ""),
          address: String(data.address ?? ""),
          purok: String(data.purok ?? ""),
          phone: String(data.phone ?? ""),
          email: String(data.email ?? ""),
          notes: String(data.notes ?? ""),
          lat: typeof data.lat === "number" ? data.lat : null,
          lng: typeof data.lng === "number" ? data.lng : null,
          officerUid: String(data.officerUid ?? ""),
          orgName: String(data.orgName ?? ""),
          createdAt:
            typeof data.createdAt === "string"
              ? data.createdAt
              : data.createdAt?.toDate?.()?.toISOString?.() ?? "",
          updatedAt:
            typeof data.updatedAt === "string"
              ? data.updatedAt
              : data.updatedAt?.toDate?.()?.toISOString?.() ??
                (typeof data.createdAt === "string"
                  ? data.createdAt
                  : data.createdAt?.toDate?.()?.toISOString?.() ?? ""),
        };
      });
      rows.sort((a, b) =>
        (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt),
      );
      onData(rows);
    },
    (err) => onError?.(err),
  );
}

export async function addHousehold(
  officerUid: string,
  orgName: string,
  input: HouseholdInput,
): Promise<void> {
  await addDoc(collection(getClientDb(), "households"), {
    ownerName: input.ownerName.trim(),
    address: input.address.trim(),
    purok: input.purok.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    notes: input.notes.trim(),
    lat: typeof input.lat === "number" ? input.lat : null,
    lng: typeof input.lng === "number" ? input.lng : null,
    officerUid,
    orgName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdAtServer: serverTimestamp(),
    updatedAtServer: serverTimestamp(),
  });
}

export async function removeHousehold(id: string): Promise<void> {
  await deleteDoc(doc(getClientDb(), "households", id));
}

export async function clearHouseholds(
  officerUid: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const q = query(
    collection(getClientDb(), "households"),
    where("officerUid", "==", officerUid),
  );
  const snap = await getDocs(q);
  const refs = snap.docs.map((d) => d.ref);
  const total = refs.length;
  if (total === 0) {
    onProgress?.(0, 0);
    return;
  }
  let done = 0;
  for (let i = 0; i < refs.length; i += BATCH_SIZE) {
    const chunk = refs.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(getClientDb());
    for (const ref of chunk) batch.delete(ref);
    await batch.commit();
    done += chunk.length;
    onProgress?.(done, total);
  }
}

function householdDocPayload(
  officerUid: string,
  orgName: string,
  input: HouseholdInput,
) {
  const now = new Date().toISOString();
  return {
    ownerName: input.ownerName.trim(),
    address: input.address.trim(),
    purok: input.purok.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    notes: input.notes.trim(),
    lat: typeof input.lat === "number" ? input.lat : null,
    lng: typeof input.lng === "number" ? input.lng : null,
    officerUid,
    orgName,
    createdAt: now,
    updatedAt: now,
    createdAtServer: serverTimestamp(),
    updatedAtServer: serverTimestamp(),
  };
}

/** Append many households (CSV import). Does not clear existing roster. */
export async function addHouseholds(
  officerUid: string,
  orgName: string,
  inputs: HouseholdInput[],
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const total = inputs.length;
  let done = 0;
  const col = collection(getClientDb(), "households");
  for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
    const chunk = inputs.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(getClientDb());
    for (const input of chunk) {
      const ref = doc(col);
      batch.set(ref, householdDocPayload(officerUid, orgName, input));
    }
    await batch.commit();
    done += chunk.length;
    onProgress?.(done, total);
  }
  return done;
}

export type SeedHouseholdsProgress = {
  phase: "clearing" | "writing";
  done: number;
  total: number;
};

/** Replace this officer's roster with the given seed (clears old rows first). */
export async function seedHouseholds(
  officerUid: string,
  orgName: string,
  inputs: HouseholdInput[],
  onProgress?: (p: SeedHouseholdsProgress) => void,
): Promise<number> {
  await clearHouseholds(officerUid, (done, total) => {
    onProgress?.({ phase: "clearing", done, total });
  });
  return addHouseholds(officerUid, orgName, inputs, (done, total) => {
    onProgress?.({ phase: "writing", done, total });
  });
}
