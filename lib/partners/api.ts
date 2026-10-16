import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import {
  NANGKA_BARANGAY_ID,
  NANGKA_ORG_NAME,
  NANGKA_PARTNER_SEED,
} from "@/lib/partners/nangkaPartners";
import type {
  PartnerSupply,
  PartnerType,
  ResourcePartner,
  ResourcePartnerInput,
} from "@/lib/partners/types";

const COL = "resourcePartners";

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

function asSupplies(raw: unknown): PartnerSupply[] {
  if (!Array.isArray(raw)) return [];
  const allowed: PartnerSupply[] = [
    "medical",
    "food",
    "water",
    "transport",
    "shelter",
    "other",
  ];
  return raw
    .map(String)
    .filter((s): s is PartnerSupply =>
      allowed.includes(s as PartnerSupply),
    );
}

function mapDoc(id: string, data: Record<string, unknown>): ResourcePartner {
  const typeRaw = String(data.type ?? "other");
  const type: PartnerType =
    typeRaw === "ngo" ||
    typeRaw === "dswd" ||
    typeRaw === "lgu" ||
    typeRaw === "private"
      ? typeRaw
      : "other";
  return {
    id,
    name: String(data.name ?? ""),
    type,
    contactName: String(data.contactName ?? ""),
    phone: String(data.phone ?? ""),
    supplies: asSupplies(data.supplies),
    coverage: String(data.coverage ?? ""),
    notes: typeof data.notes === "string" ? data.notes : undefined,
    status: data.status === "inactive" ? "inactive" : "active",
    barangayId: String(data.barangayId ?? NANGKA_BARANGAY_ID),
    orgName: String(data.orgName ?? NANGKA_ORG_NAME),
    createdAt: asIso(data.createdAt, data.createdAtServer),
    updatedAt: asIso(data.updatedAt, data.updatedAtServer),
  };
}

export function subscribeResourcePartners(
  barangayId: string,
  onData: (rows: ResourcePartner[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getClientDb(), COL),
    where("barangayId", "==", barangayId),
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => mapDoc(d.id, d.data() as Record<string, unknown>))
        .filter((p) => p.status === "active")
        .sort((a, b) => a.name.localeCompare(b.name));
      onData(rows);
    },
    (err) => onError?.(err),
  );
}

export async function addResourcePartner(
  barangayId: string,
  orgName: string,
  input: ResourcePartnerInput,
): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new Error("Partner name is required.");
  const now = new Date().toISOString();
  const ref = await addDoc(collection(getClientDb(), COL), {
    name,
    type: input.type,
    contactName: input.contactName.trim(),
    phone: input.phone.trim(),
    supplies: input.supplies,
    coverage: input.coverage.trim(),
    notes: input.notes?.trim() || null,
    status: input.status ?? "active",
    barangayId,
    orgName,
    createdAt: now,
    updatedAt: now,
    createdAtServer: serverTimestamp(),
    updatedAtServer: serverTimestamp(),
  });
  return ref.id;
}

/** Idempotent seed for Nangka demo partners. */
export async function ensureNangkaPartners(): Promise<number> {
  const db = getClientDb();
  let written = 0;
  for (const seed of NANGKA_PARTNER_SEED) {
    const ref = doc(db, COL, seed.id);
    const existing = await getDoc(ref);
    if (existing.exists()) continue;
    const now = new Date().toISOString();
    await setDoc(ref, {
      name: seed.name,
      type: seed.type,
      contactName: seed.contactName,
      phone: seed.phone,
      supplies: seed.supplies,
      coverage: seed.coverage,
      notes: seed.notes ?? null,
      status: seed.status ?? "active",
      barangayId: NANGKA_BARANGAY_ID,
      orgName: NANGKA_ORG_NAME,
      createdAt: now,
      updatedAt: now,
      createdAtServer: serverTimestamp(),
      updatedAtServer: serverTimestamp(),
    });
    written += 1;
  }
  return written;
}
